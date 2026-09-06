// JFlix — HLS offline downloader (Electron main process, pure Node).
//
// Downloads an HLS stream as individual segments (like Flickv4's DownloadService):
// master playlist -> pick variant (<=1080p, AVC preferred) -> media playlist ->
// sidecars (init/key) + segments with concurrency/retries -> local.m3u8 with
// relative paths. No ffmpeg needed for the download itself.
//
// Usage:
//   const hls = require('./hls-offline');
//   await hls.downloadHlsToDir({ masterUrl, headers, dir, onProgress, isCancelled });

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SEGMENT_CONCURRENCY = 4;
const RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad(n, width) {
  return String(n).padStart(width == null ? 5 : width, '0');
}

// Fetch a URL into a Buffer. Follows redirects, times out, rejects non-2xx.
// Transient 429/5xx responses are retried (honoring Retry-After) up to 3x.
function fetchBuffer(url, headers, timeoutMs, maxRedirects, triesLeft) {
  const hdrs = Object.assign({}, headers || {});
  const tmo = timeoutMs == null ? 20000 : timeoutMs;
  const hops = maxRedirects == null ? 5 : maxRedirects;
  const tries = triesLeft == null ? 3 : triesLeft;
  const RETRYABLE = [429, 500, 502, 503, 504];
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(url);
    } catch (err) {
      reject(new Error('Bad URL: ' + url));
      return;
    }
    const lib = target.protocol === 'http:' ? http : https;
    const req = lib.request(target, { method: 'GET', headers: hdrs }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && hops > 0) {
        res.resume();
        let next;
        try {
          next = new URL(res.headers.location, target).toString();
        } catch (err) {
          reject(new Error('Bad redirect from ' + url));
          return;
        }
        fetchBuffer(next, headers, tmo, hops - 1, tries).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        if (RETRYABLE.indexOf(status) !== -1 && tries > 1) {
          let wait = 1500 * (4 - tries) * (4 - tries);
          try {
            const ra = res.headers && res.headers['retry-after'];
            if (ra) {
              const secs = parseInt(String(ra).trim(), 10);
              if (!isNaN(secs) && secs >= 0 && secs <= 300) wait = secs * 1000;
            }
          } catch (err) { /* ignore */ }
          setTimeout(() => {
            fetchBuffer(url, headers, tmo, maxRedirects, tries - 1).then(resolve, reject);
          }, Math.min(15000, wait));
          return;
        }
        reject(new Error('HTTP ' + status + ' for ' + url));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), finalUrl: url }));
      res.on('error', (err) => reject(err));
    });
    req.on('timeout', () => {
      req.destroy(new Error('Timed out fetching ' + url));
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(tmo);
    req.end();
  });
}

function attrValue(line, key) {
  const re = new RegExp(key + '=("[^"]*"|[^,]+)', 'i');
  const m = re.exec(line);
  if (!m) return undefined;
  return m[1].replace(/^"|"$/g, '');
}

function codecRank(codecs) {
  const c = String(codecs || '').toLowerCase();
  if (c.indexOf('avc1') !== -1 || c.indexOf('avc3') !== -1) return 0;
  if (c.indexOf('dvh1') !== -1 || c.indexOf('dvhe') !== -1 || c.indexOf('dvav') !== -1) return 2;
  if (c.indexOf('hev1') !== -1 || c.indexOf('hvc1') !== -1) return 1;
  return 1;
}

// Parse an HLS master playlist. [] when the text is already a media playlist.
function parseMasterPlaylist(text, baseUrl) {
  if (!text || text.indexOf('#EXTM3U') !== 0) return [];
  if (text.indexOf('#EXT-X-STREAM-INF') === -1) return [];
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.indexOf('#EXT-X-STREAM-INF') !== 0) continue;
    let uriLine;
    for (let j = i + 1; j < lines.length; j++) {
      const cand = lines[j].trim();
      if (!cand || cand.charAt(0) === '#') continue;
      uriLine = cand;
      break;
    }
    if (!uriLine) continue;
    const res = attrValue(line, 'RESOLUTION') || '';
    const bw = parseInt(attrValue(line, 'BANDWIDTH') || '0', 10) || 0;
    let width = 0;
    let height = 0;
    if (res && res.toLowerCase().indexOf('x') !== -1) {
      const parts = res.toLowerCase().split('x');
      width = parseInt(parts[0], 10) || 0;
      height = parseInt(parts[1], 10) || 0;
    }
    let absolute = uriLine;
    try {
      absolute = new URL(uriLine, baseUrl).toString();
    } catch (err) { /* keep raw */ }
    const codecs = attrValue(line, 'CODECS');
    out.push({
      uri: absolute,
      width,
      height,
      bandwidth: bw,
      label: height > 0 ? height + 'p' : Math.round(bw / 1000) + 'kbps',
      codecs,
    });
  }
  // Dedupe by height, preferring AVC (decodes everywhere offline).
  const byHeight = new Map();
  for (const v of out) {
    const cur = byHeight.get(v.height);
    if (!cur) {
      byHeight.set(v.height, v);
      continue;
    }
    const ra = codecRank(v.codecs);
    const rb = codecRank(cur.codecs);
    if (ra < rb || (ra === rb && v.bandwidth > cur.bandwidth)) byHeight.set(v.height, v);
  }
  return Array.from(byHeight.values()).sort((a, b) => b.height - a.height);
}

// Highest variant at or under targetHeight (default 1080p), AVC preferred.
function pickVariant(variants, targetHeight) {
  const target = targetHeight == null ? 1080 : targetHeight;
  if (!variants || !variants.length) return null;
  const eligible = variants.filter((v) => v.height > 0 && v.height <= target);
  const pool = eligible.length ? eligible : variants.slice();
  const maxH = Math.max.apply(null, pool.map((v) => v.height));
  const atH = pool.filter((v) => v.height === maxH);
  return atH.reduce((best, v) => {
    const ra = codecRank(v.codecs);
    const rb = codecRank(best.codecs);
    if (ra < rb) return v;
    if (ra === rb && v.bandwidth > best.bandwidth) return v;
    return best;
  });
}

// Parse an HLS media playlist: segments, AES keys, init maps.
function parseMediaPlaylist(text, baseUrl) {
  const lines = String(text || '').split(/\r?\n/);
  const segments = [];
  const keys = [];
  const mapInits = [];
  let pendingDuration = 0;
  let endList = false;
  const abs = (u) => {
    try {
      return new URL(u, baseUrl).toString();
    } catch (err) {
      return u;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.indexOf('#EXT-X-ENDLIST') === 0) {
      endList = true;
      continue;
    }
    if (line.indexOf('#EXTINF:') === 0) {
      pendingDuration = parseFloat(line.substring(8).split(',')[0]) || 0;
      continue;
    }
    if (line.indexOf('#EXT-X-KEY:') === 0) {
      const method = attrValue(line, 'METHOD') || 'NONE';
      const uriAttr = attrValue(line, 'URI');
      const iv = attrValue(line, 'IV');
      if (uriAttr) keys.push({ method, uri: abs(uriAttr), iv });
      continue;
    }
    if (line.indexOf('#EXT-X-MAP:') === 0) {
      const uriAttr = attrValue(line, 'URI');
      if (uriAttr) mapInits.push(abs(uriAttr));
      continue;
    }
    if (line.charAt(0) === '#') continue;
    segments.push({ uri: abs(line), duration: pendingDuration });
    pendingDuration = 0;
  }
  return { segments, keys, mapInits, endList, rawText: String(text || '') };
}

// CDN 403/JSON bodies that still got written to disk.
function looksLikeErrorBody(bytes) {
  if (!bytes || !bytes.length) return true;
  let i = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i += 1;
  if (i >= bytes.length) return true;
  const head = bytes.slice(i, i + 32).toString('ascii').toLowerCase();
  return head.charAt(0) === '<' || head.charAt(0) === '{' || head.charAt(0) === '[' || head.indexOf('error') === 0;
}

function isPlausibleDownload(bytes, kind) {
  if (looksLikeErrorBody(bytes)) return false;
  if (kind === 'sidecar') return bytes.length >= 16;
  if (kind === 'file') return bytes.length >= 1024;
  return bytes.length >= 32;
}

function extForUrl(url, fallback) {
  const fb = fallback || 'ts';
  const clean = String(url || '').split('?')[0].toLowerCase();
  const dot = clean.lastIndexOf('.');
  if (dot === -1) return fb;
  const ext = clean.slice(dot + 1);
  if (!ext || ext.length > 5 || ext.indexOf('/') !== -1) return fb;
  return ext;
}

// Rewrite a media playlist so every remote URI points at a local relative file.
// Returns { playlist, leftoverRemoteUris } — leftovers (e.g. external audio
// groups) mean the offline copy would still need the network, so callers must
// fail the job instead of shipping a half-offline file.
function rewriteMediaPlaylist(rawText, baseUrl, urlMap) {
  const abs = (u) => {
    try {
      return new URL(u, baseUrl).toString();
    } catch (err) {
      return u;
    }
  };
  const leftovers = [];
  const outLines = String(rawText || '').split(/\r?\n/).map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return rawLine;
    if (line.charAt(0) !== '#') {
      const rel = urlMap.get(abs(line));
      if (rel) return rel;
      leftovers.push(line);
      return rawLine;
    }
    // URI="..." attributes on EXT-X-KEY / EXT-X-MAP / EXT-X-MEDIA tags.
    return rawLine.replace(/URI="([^"]+)"/gi, (m, u) => {
      const key = abs(u);
      // Already-local values (rewritten on a previous pass) pass through.
      if (!/^https?:/i.test(key)) return m;
      const rel = urlMap.get(key);
      if (rel) return 'URI="' + rel + '"';
      leftovers.push(u);
      return m;
    });
  });
  return { playlist: outLines.join('\n'), leftoverRemoteUris: leftovers };
}

async function downloadOneFile(url, destPath, headers, kind, isCancelled) {  if (isCancelled && isCancelled()) throw new Error('cancelled');
  if (fs.existsSync(destPath)) {
    const existing = fs.readFileSync(destPath);
    if (isPlausibleDownload(existing, kind)) return existing.length;
    try { fs.unlinkSync(destPath); } catch (err) { /* ignore */ }
  }
  let lastErr = null;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    if (isCancelled && isCancelled()) throw new Error('cancelled');
    try {
      const res = await fetchBuffer(url, headers);
      if (!isPlausibleDownload(res.buffer, kind)) {
        throw new Error('Server returned an error page (' + res.buffer.length + ' bytes) for ' + url);
      }
      fs.writeFileSync(destPath, res.buffer);
      return res.buffer.length;
    } catch (err) {
      lastErr = err;
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) { /* ignore */ }
      if (isCancelled && isCancelled()) throw new Error('cancelled');
      if (attempt < RETRIES) await sleep(300 * attempt);
    }
  }
  throw lastErr || new Error('Download failed: ' + url);
}

// Stream a single (potentially large) file to disk without buffering it in
// memory — used for progressive downloads that need no remuxing.
// opts: { headers, timeoutMs, onProgress(written, total), isCancelled, slot }
// slot = {} receives slot.current = active ClientRequest so cancel can destroy it.
function downloadFileStreamed(url, destPath, headers, opts) {
  const o = opts || {};
  const timeoutMs = o.timeoutMs == null ? 30000 : o.timeoutMs;
  const onProgress = o.onProgress || (() => {});
  const isCancelled = o.isCancelled || (() => false);
  const slot = o.slot || {};
  const MAX_HOPS = 5;
  const MAX_ATTEMPTS = 4;
  const RETRYABLE = [429, 500, 502, 503, 504];

  function retryDelayMs(res, attempt) {
    try {
      const ra = res.headers && res.headers['retry-after'];
      if (ra) {
        const secs = parseInt(String(ra).trim(), 10);
        if (!isNaN(secs) && secs >= 0 && secs <= 300) return secs * 1000;
        const when = Date.parse(String(ra));
        if (!isNaN(when)) {
          const wait = when - Date.now();
          if (wait > 0 && wait <= 300000) return wait;
        }
      }
    } catch (err) { /* ignore */ }
    return Math.min(15000, 1500 * attempt * attempt); // 1.5s, 6s, 13.5s...
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err, bytes) => {
      if (settled) return;
      settled = true;
      slot.current = null;
      if (err) reject(err);
      else resolve(bytes == null ? 0 : bytes);
    };
    const fail = (err) => {
      try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (e) { /* ignore */ }
      done(err);
    };

    function attempt(target, hopsLeft, triesLeft) {
      if (isCancelled()) return done(new Error('cancelled'));
      let u;
      try {
        u = new URL(target);
      } catch (err) {
        return fail(new Error('Bad URL: ' + target));
      }
      const lib = u.protocol === 'http:' ? http : https;
      let req;
      try {
        req = lib.request(u, { method: 'GET', headers: headers || {} }, (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location && hopsLeft > 0) {
            res.resume();
            let next = null;
            try {
              next = new URL(res.headers.location, u).toString();
            } catch (err) { /* fall through */ }
            if (next) {
              slot.current = null;
              attempt(next, hopsLeft - 1, triesLeft);
              return;
            }
          }
          if (status < 200 || status >= 300) {
            res.resume();
            // Rate limits / transient CDN errors: back off (honor Retry-After)
            // and retry instead of failing the whole download.
            if (RETRYABLE.indexOf(status) !== -1 && triesLeft > 1 && !isCancelled()) {
              const wait = retryDelayMs(res, MAX_ATTEMPTS - triesLeft + 1);
              setTimeout(() => {
                slot.current = null;
                attempt(target, MAX_HOPS, triesLeft - 1);
              }, wait);
              return;
            }
            fail(new Error('HTTP ' + status + ' for ' + target));
            return;
          }
          const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
          const out = fs.createWriteStream(destPath);
          let written = 0;
          let firstChunk = null;
          out.on('error', (err) => {
            try { req.destroy(); } catch (e) { /* ignore */ }
            fail(err);
          });
          res.on('data', (chunk) => {
            if (firstChunk === null) firstChunk = chunk.slice(0, 64);
            written += chunk.length;
            onProgress(written, total);
          });
          res.on('end', () => {
            out.end(() => {
              if (isCancelled()) return fail(new Error('cancelled'));
              if (written < 1024) {
                return fail(new Error('Server returned an empty file (' + written + ' bytes).'));
              }
              if (firstChunk && looksLikeErrorBody(firstChunk)) {
                return fail(new Error('Server returned an error page instead of the video.'));
              }
              done(null, written);
            });
          });
          res.on('error', (err) => {
            if (isCancelled()) return fail(new Error('cancelled'));
            fail(err);
          });
          res.pipe(out);
        });
      } catch (err) {
        return fail(err);
      }
      slot.current = req;
      req.on('timeout', () => {
        try { req.destroy(new Error('Timed out fetching ' + target)); } catch (e) { /* ignore */ }
      });
      req.on('error', (err) => {
        if (isCancelled()) return fail(new Error('cancelled'));
        fail(err);
      });
      req.setTimeout(timeoutMs);
      req.end();
    }

    attempt(url, MAX_HOPS, MAX_ATTEMPTS);
  });
}

// Full pipeline: masterUrl -> dir/{segments/*, local.m3u8}.
async function downloadHlsToDir(opts) {  const o = opts || {};
  if (!o.masterUrl) throw new Error('masterUrl is required');
  if (!o.dir) throw new Error('dir is required');
  const headers = Object.assign({ 'User-Agent': DEFAULT_UA }, o.headers || {});
  const isCancelled = o.isCancelled || (() => false);
  const onProgress = o.onProgress || (() => {});
  const targetHeight = o.targetHeight == null ? 1080 : o.targetHeight;

  fs.mkdirSync(o.dir, { recursive: true });
  fs.mkdirSync(path.join(o.dir, 'segments'), { recursive: true });

  const failIfCancelled = () => {
    if (isCancelled()) throw new Error('cancelled');
  };

  // 1) Master playlist -> variant (or treat masterUrl as media playlist).
  let variantUrl = o.masterUrl;
  const masterRes = await fetchBuffer(o.masterUrl, headers);
  failIfCancelled();
  const masterText = masterRes.buffer.toString('utf8');
  const variants = parseMasterPlaylist(masterText, o.masterUrl);
  if (variants.length) {
    const picked = pickVariant(variants, targetHeight);
    if (!picked) throw new Error('No playable variant in master playlist.');
    variantUrl = picked.uri;
  }

  // 2) Media playlist.
  const mediaRes = variants.length || masterText.indexOf('#EXTM3U') !== 0
    ? await fetchBuffer(variantUrl, headers)
    : { buffer: masterRes.buffer, finalUrl: o.masterUrl };
  failIfCancelled();
  const mediaText = mediaRes.buffer.toString('utf8');
  if (mediaText.indexOf('#EXTM3U') !== 0) {
    throw new Error('URL did not return an HLS playlist.');
  }
  const media = parseMediaPlaylist(mediaText, variantUrl);
  if (!media.segments.length) throw new Error('No segments in playlist.');

  const badKey = media.keys.find((k) => {
    const m = String(k.method || '').toUpperCase();
    return m !== 'AES-128' && m !== 'NONE';
  });
  if (badKey) throw new Error('HLS encryption ' + badKey.method + ' cannot be saved for offline play.');

  // 3) URL map: remote -> relative local path.
  const urlMap = new Map();
  media.mapInits.forEach((uri, i) => {
    urlMap.set(uri, 'segments/init-' + i + '.' + extForUrl(uri, 'mp4'));
  });
  media.keys.forEach((k, i) => {
    urlMap.set(k.uri, 'segments/key-' + i + '.bin');
  });
  media.segments.forEach((seg, idx) => {
    urlMap.set(seg.uri, 'segments/' + pad(idx) + '.' + extForUrl(seg.uri, 'ts'));
  });

  const total = media.segments.length;
  let done = 0;
  let bytesWritten = 0;
  const report = () => onProgress({ completedSegments: done, totalSegments: total, bytesWritten });

  const localPath = (rel) => path.join(o.dir, rel.split('/').join(path.sep));

  // 4) Sidecars first (init + keys).
  for (const uri of media.mapInits) {
    const n = await downloadOneFile(uri, localPath(urlMap.get(uri)), headers, 'sidecar', isCancelled);
    bytesWritten += n;
    report();
  }
  for (const k of media.keys) {
    const n = await downloadOneFile(k.uri, localPath(urlMap.get(k.uri)), headers, 'sidecar', isCancelled);
    bytesWritten += n;
    report();
  }

  // 5) Segments with a small worker pool.
  let cursor = 0;
  const errors = [];
  async function runner() {
    while (cursor < media.segments.length) {
      if (isCancelled()) throw new Error('cancelled');
      const idx = cursor;
      cursor += 1;
      const seg = media.segments[idx];
      try {
        const n = await downloadOneFile(seg.uri, localPath(urlMap.get(seg.uri)), headers, 'segment', isCancelled);
        bytesWritten += n;
        done += 1;
        report();
      } catch (err) {
        errors.push({ idx, message: (err && err.message) || String(err) });
      }
    }
  }
  const workers = [];
  const pool = Math.min(SEGMENT_CONCURRENCY, media.segments.length);
  for (let w = 0; w < pool; w++) workers.push(runner());
  await Promise.all(workers);
  if (isCancelled()) throw new Error('cancelled');
  if (done < total) {
    const first = errors[0];
    throw new Error(
      'Only ' + done + '/' + total + ' segments downloaded' +
      (first ? ' (seg ' + first.idx + ': ' + first.message + ')' : '') + '.'
    );
  }

  // 6) Rewrite playlist to local relative paths (reuse fetched text, no new fetch).
  const rewritten = rewriteMediaPlaylist(mediaText, variantUrl, urlMap);
  if (rewritten.leftoverRemoteUris.length) {
    throw new Error('Playlist still needs the network (' + rewritten.leftoverRemoteUris[0] + ').');
  }
  fs.writeFileSync(path.join(o.dir, 'local.m3u8'), rewritten.playlist, 'utf8');

  return { playlistFile: 'local.m3u8', totalSegments: total, bytesWritten };
}

module.exports = {
  DEFAULT_UA,
  fetchBuffer,
  parseMasterPlaylist,
  pickVariant,
  parseMediaPlaylist,
  looksLikeErrorBody,
  isPlausibleDownload,
  rewriteMediaPlaylist,
  downloadHlsToDir,
  downloadFileStreamed,
};
