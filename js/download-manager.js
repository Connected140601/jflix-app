// JFlix Desktop — In-App Download Manager (Electron main process)
//
// Flow: the renderer asks to download a title. We open a hidden window on the
// same embed URL the player uses and extract the real stream two ways:
//   1. an injected in-page hook (js/stream-hook.js, Flickv4-style) that reports
//      video URLs via console messages — catches XHR/fetch JSON playlists,
//      extensionless/proxied manifests, <video>.src and player SDK sources,
//      and auto-taps play overlays so hidden captures actually start;
//   2. a network watcher for direct media requests.
//
// Direct files (.mp4/.webm/.mkv) are remuxed with ffmpeg. HLS (.m3u8) is
// downloaded segment-by-segment (js/hls-offline.js: variant pick, retries,
// AES-128 keys, local playlist rewrite) and remuxed to MP4. Everything is kept
// inside the app's private data folder and played only through the Downloads
// page over the private jflixdl:// scheme.
//
// Caveats:
//  - Widevine/DRM-protected streams cannot be captured — those servers fail
//    gracefully with a "no stream found" error.

const { app, BrowserWindow, session, ipcMain, shell, protocol, webFrameMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const hls = require('./hls-offline');

let HOOK_JS = '';
try {
  HOOK_JS = require('./stream-hook');
} catch (err) {
  console.error('[Downloads] stream-hook not installed:', err.message);
}

// Normal desktop Chrome UA for capture windows. The default Electron UA
// contains an "Electron" token that anti-bot systems flag, exactly like a
// WebView "; wv" token — presenting a regular browser UA lets challenges run.
const CAPTURE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (err) {
  console.error('[Downloads] ffmpeg-static not installed:', err.message);
}

// Must run before app is ready so <video> can stream/seek over our scheme
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jflixdl',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true }
  }
]);

let getMainWindow = null; // () => BrowserWindow (set by init)
let downloadsDir = null;
let indexPath = null;
let library = [];          // persisted download records
let active = new Map();    // id -> { proc, win, record }
let initialized = false;

function broadcast(event, payload) {
  try {
    const win = getMainWindow ? getMainWindow() : null;
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('dl:event', { event, ...payload });
    }
  } catch (err) {
    console.error('[Downloads] broadcast error:', err.message);
  }
}

function saveIndex() {
  try {
    fs.writeFileSync(indexPath, JSON.stringify(library, null, 2));
  } catch (err) {
    console.error('[Downloads] failed to save index:', err.message);
  }
}

function safeFileName(name) {
  const cleaned = String(name || 'download')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return cleaned || 'download';
}

function buildFileName(rec, ext) {
  let base = safeFileName(rec.title);
  if (rec.season != null && rec.episode != null) {
    const s = String(rec.season).padStart(2, '0');
    const e = String(rec.episode).padStart(2, '0');
    base = `${base} S${s}E${e}`;
  }
  const clean = String(ext || 'mp4').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4';
  return `${base}.${clean}`;
}

function statSize(file) {
  try {
    const st = fs.statSync(file);
    return st ? st.size : 0;
  } catch (err) {
    return 0;
  }
}

function updateRecord(id, patch) {
  const rec = library.find((r) => r.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  saveIndex();
  broadcast('update', { id, ...rec });
  return rec;
}

// Parse ffmpeg `-progress pipe:1` stdout lines.
// extraHeaders (Referer/Origin) are sent because many CDNs 403 without them.
function runFfmpeg(streamUrl, outFile, rec, extraHeaders) {
  return new Promise((resolve) => {
    // -user_agent / -headers only exist for network inputs — ffmpeg errors
    // out on local files (e.g. remuxing a downloaded local.m3u8).
    const isRemote = /^https?:/i.test(streamUrl);
    const args = ['-y'];
    if (isRemote) {
      args.push('-user_agent', CAPTURE_UA);
      if (extraHeaders) args.push('-headers', extraHeaders);
    }
    args.push(
      '-i', streamUrl,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',
      '-nostats',
      outFile
    );

    let proc;
    try {
      proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      // spawn() only throws synchronously for a bad binary path (missing or
      // unsupported-arch ffmpeg build). Say so plainly instead of a mystery error.
      updateRecord(rec.id, {
        status: 'error',
        error: 'Could not start ffmpeg: ' + (err && err.message ? err.message : String(err)) +
          ' [ffmpeg=' + String(ffmpegPath) + ']'
      });
      resolve(false);
      return;
    }

    active.set(rec.id, { ...(active.get(rec.id) || {}), proc });
    let totalSec = 0;
    let lastSend = 0;
    let stderrBuf = '';

    proc.stdout.on('data', (buf) => {
      const text = buf.toString();
      const m = text.match(/out_time_ms=(\d+)/);
      if (!m) return;
      const sec = parseInt(m[1], 10) / 1e6;
      let pct = 0;
      if (totalSec > 0) {
        pct = Math.min(99, Math.round((sec / totalSec) * 100));
      } else {
        pct = Math.min(99, Math.round(sec / 3600 * 100)); // fallback filler
      }
      const now = Date.now();
      if (now - lastSend > 400) {
        lastSend = now;
        updateRecord(rec.id, { status: 'downloading', progress: pct });
      }
    });

    proc.stderr.on('data', (buf) => {
      stderrBuf += buf.toString();
      const dm = stderrBuf.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (dm && !totalSec) {
        totalSec = parseInt(dm[1], 10) * 3600 + parseInt(dm[2], 10) * 60 + parseFloat(dm[3]);
      }
      if (stderrBuf.length > 20000) stderrBuf = stderrBuf.slice(-10000);
    });

    proc.on('error', (err) => {
      console.error('[Downloads] ffmpeg error:', err.message);
      updateRecord(rec.id, { status: 'error', error: err.message });
      resolve(false);
    });

    proc.on('close', (code) => {
      active.delete(rec.id);
      if (code === 0 && fs.existsSync(outFile)) {
        updateRecord(rec.id, {
          status: 'completed',
          progress: 100,
          file: path.basename(outFile),
          size: statSize(outFile)
        });
        resolve(true);
      } else {
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
        updateRecord(rec.id, { status: 'error', error: code === 0 ? 'Output file missing.' : `ffmpeg exited with code ${code}` });
        resolve(false);
      }
    });
  });
}

function stopActive(id) {
  const entry = active.get(id);
  if (!entry) return;
  try {
    if (entry.slot && entry.slot.current) entry.slot.current.destroy();
  } catch (err) { /* ignore */ }
  try {
    if (entry.proc) entry.proc.kill('SIGKILL');
  } catch (err) { /* ignore */ }
  try {
    if (entry.win && !entry.win.isDestroyed()) entry.win.destroy();
  } catch (err) { /* ignore */ }
  active.delete(id);
}

function startDownload(payload) {
  const rec = {
    id: 'dl_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
    title: (payload && (payload.title || payload.tmdbId)) || 'Media',
    type: (payload && payload.type) || 'movie',
    tmdbId: payload && payload.tmdbId,
    season: payload && payload.season != null ? payload.season : null,
    episode: payload && payload.episode != null ? payload.episode : null,
    embedUrl: payload && payload.embedUrl,
    server: payload && (payload.serverLabel || payload.server) || '',
    status: 'starting',
    progress: 0,
    file: null,
    size: 0,
    error: null,
    createdAt: Date.now()
  };
  library.unshift(rec);
  saveIndex();
  broadcast('added', { id: rec.id });

  const embedUrl = rec.embedUrl;
  if (!embedUrl || !/^https?:/i.test(embedUrl)) {
    updateRecord(rec.id, { status: 'error', error: 'No embed URL available for this server.' });
    return rec.id;
  }

  // Request headers reused for ffmpeg + segment fetches. Many CDNs 403
  // without a Referer, so derive one from the embed page origin.
  let embedOrigin = '';
  try {
    const u = new URL(embedUrl);
    embedOrigin = u.origin + '/';
  } catch (e) { /* ignore */ }
  const reqHeaders = { 'User-Agent': CAPTURE_UA };
  if (embedOrigin) {
    reqHeaders.Referer = embedOrigin;
    reqHeaders.Origin = embedOrigin.replace(/\/$/, '');
  }
  const ffmpegHeaderStr = embedOrigin ? 'Referer: ' + embedOrigin + '\r\n' : null;

  // Hidden window that loads the same embed page so we can observe the stream request.
  // autoplayPolicy + backgroundThrottling are critical: a hidden, throttled window may
  // never start the media (and therefore never request the manifest).
  //
  // Each download gets its own in-memory session partition so concurrent downloads
  // never overwrite each other's webRequest listener (Electron allows only one
  // onBeforeRequest listener per session — sharing defaultSession broke parallel
  // downloads and leaked listeners across captures).
  //
  // Anti-bot measures (Flickv4-style): a normal Chrome UA (no Electron token),
  // muted audio, and an injected in-page hook that catches JSON-embedded and
  // extensionless stream URLs and auto-taps play overlays.
  const dlSession = session.fromPartition('jflix-dl-' + rec.id);
  const dlWin = new BrowserWindow({
    show: false,
    webPreferences: {
      session: dlSession,
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    }
  });
  try {
    dlWin.webContents.setUserAgent(CAPTURE_UA);
  } catch (e) { /* ignore */ }
  try {
    dlWin.webContents.setAudioMuted(true);
  } catch (e) { /* ignore */ }

  const watcherFilter = { urls: ['*://*/*', 'http://*/*', 'https://*/*'] };

  // Broadened matcher: direct files + HLS/DASH manifests + extensionless
  // proxied manifests (m3u8/mpegurl hints), minus images/fonts/scripts/ads.
  const SKIP_URL_RE = /\.(jpe?g|png|gif|webp|svg|ico|css|woff2?|js|vtt|srt)($|\?|#)/i;
  const SKIP_HOST_RE = /googletagmanager|doubleclick|adsystem|google-analytics|clarity\.ms|facebook\.net|tiktok/i;
  function classifyStreamUrl(url) {
    if (!url || !/^https?:/i.test(url)) return null;
    if (SKIP_URL_RE.test(url) || SKIP_HOST_RE.test(url)) return null;
    if (/\.(m3u8)($|\?|#)/i.test(url) || /mpegurl/i.test(url)) return 'hls';
    if (/\.(mpd)($|\?|#)/i.test(url)) return 'hls'; // unsupported later, but fails cleanly
    if (/\.(mp4|webm|mkv)($|\?|#)/i.test(url)) return 'file';
    return null;
  }

  let captured = false;
  let injectTimer = null;
  // Diagnostic trail from the injected hook ([JFLIX-HOOK] console lines).
  // Saved onto the record when capture fails so we can tell "hook never ran"
  // apart from "page never requested a stream".
  let hookLog = [];
  const CAPTURE_TIMEOUT_MS = 45000;

  function stopWatching() {
    try { dlSession.webRequest.onBeforeRequest.removeListener(onRequest); } catch (e) { /* ignore */ }
    try { dlWin.webContents.removeListener('console-message', onConsole); } catch (e) { /* ignore */ }
    if (injectTimer) {
      clearInterval(injectTimer);
      injectTimer = null;
    }
  }

  function captureStream(url, source) {
    if (captured) return;
    const kind = classifyStreamUrl(url);
    if (!kind) return;
    captured = true;
    stopWatching();
    console.log('[Downloads] stream found via ' + source + ': ' + String(url).slice(0, 160));
    updateRecord(rec.id, { status: 'connecting', progress: 0, streamUrl: String(url).slice(0, 300) });
    finishCapture(rec, url, kind, dlWin);
  }

  const onRequest = (details, callback) => {
    const kind = classifyStreamUrl(details.url);
    if (kind) {
      // Found the stream — kill the hidden window's own copy of this request
      // (signed URLs are often single-use or rate-limited; save it for the
      // real download) and hand the URL off.
      captureStream(details.url, 'net');
      try {
        callback({ cancel: true });
      } catch (e) {
        try { callback({ cancel: false }); } catch (e2) { /* ignore */ }
      }
      return;
    }
    callback({ cancel: false });
  };

  const onConsole = (event, level, message) => {
    if (!message) return;
    const s = /\[JFLIX-STREAM\]\s*(https?:\S+)/.exec(message);
    if (s) {
      captureStream(s[1], 'hook');
      return;
    }
    const h = /\[JFLIX-HOOK\]\s*([\s\S]*)/.exec(message);
    if (h) {
      hookLog.push(h[1].slice(0, 160));
      if (hookLog.length > 25) hookLog.shift();
    }
  };

  function hookDiag() {
    if (!hookLog.length) return 'hook produced no output (injection may have failed)';
    return hookLog.slice(-8).join(' | ').slice(0, 500);
  }

  function injectHooks() {
    if (!HOOK_JS || dlWin.isDestroyed() || captured) return;
    try {
      const main = dlWin.webContents.mainFrame;
      const frames = [main].concat((main && main.framesInSubtree) || []);
      for (const f of frames) {
        try {
          if (f && !f.isDestroyed()) f.executeJavaScript(HOOK_JS, false);
        } catch (e) { /* ignore */ }
      }
    } catch (e) { /* older Electron without webFrameMain */ }
  }

  try {
    dlSession.webRequest.onBeforeRequest(watcherFilter, onRequest);
  } catch (err) {
    updateRecord(rec.id, { status: 'error', error: 'Could not attach network watcher.' });
    return rec.id;
  }

  const timeout = setTimeout(() => {
    stopWatching();
    try { if (!dlWin.isDestroyed()) dlWin.destroy(); } catch (e) { /* ignore */ }
    active.delete(rec.id);
    const r = library.find((x) => x.id === rec.id);
    if (r && r.status === 'starting') {
      updateRecord(rec.id, {
        status: 'error',
        error: 'Could not find a downloadable stream on this server (may be DRM-protected or unsupported).',
        debug: hookDiag()
      });
    }
  }, CAPTURE_TIMEOUT_MS);

  dlWin.webContents.on('did-finish-load', () => {
    hookLog.push('page loaded, hooks injected');
    injectHooks();
    // Frames navigate after load (nested players, delayed iframes) — re-inject
    // until we capture or time out.
    if (!injectTimer && !captured) {
      injectTimer = setInterval(injectHooks, 2000);
    }
  });
  // did-finish-load may never fire on slow/hanging embeds — start injecting
  // right away and re-inject on every subframe load too.
  injectHooks();
  if (!injectTimer) {
    injectTimer = setInterval(injectHooks, 2000);
  }
  try {
    dlWin.webContents.on('did-frame-finish-load', () => injectHooks());
  } catch (e) { /* older Electron */ }
  dlWin.webContents.on('console-message', onConsole);
  dlWin.webContents.on('render-process-gone', () => {
    clearTimeout(timeout);
    stopWatching();
    active.delete(rec.id);
    if (captured) return; // download already handed off; leave its status alone
    const r = library.find((x) => x.id === rec.id);
    if (r && (r.status === 'starting' || r.status === 'connecting')) {
      updateRecord(rec.id, { status: 'error', error: 'The video server page closed unexpectedly before a stream was found. Try another server.' });
    }
  });
  dlWin.loadURL(embedUrl);

  // Keep ref so cancel can close the window
  active.set(rec.id, { win: dlWin, rec });
  dlWin.webContents.once('destroyed', () => {
    clearTimeout(timeout);
    if (injectTimer) {
      clearInterval(injectTimer);
      injectTimer = null;
    }
  });

  // HLS -> segment pipeline (no ffmpeg needed), then remux to MP4 so plain
  // <video> can play it offline. Falls back to the raw local.m3u8 (played
  // via hls.js on the Downloads page) when ffmpeg is unavailable.
  async function downloadHlsJob(r, streamUrl, jobHeaders) {
    const jobDir = path.join(downloadsDir, r.id);
    const isCancelled = () => {
      const cur = library.find((x) => x.id === r.id);
      return !cur || cur.status === 'canceled';
    };
    const wipeJobDir = () => {
      try {
        if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
      } catch (e) { /* ignore */ }
    };
    updateRecord(r.id, { status: 'downloading', progress: 1 });
    try {
      const res = await hls.downloadHlsToDir({
        masterUrl: streamUrl,
        headers: jobHeaders || reqHeaders,
        dir: jobDir,
        targetHeight: 1080,
        isCancelled,
        onProgress: (p) => {
          const pct = p.totalSegments > 0
            ? Math.min(99, Math.round((p.completedSegments / p.totalSegments) * 100))
            : 1;
          updateRecord(r.id, { status: 'downloading', progress: pct });
        },
      });
      if (isCancelled()) {
        wipeJobDir();
        return;
      }
      if (ffmpegPath) {
        const outFile = path.join(downloadsDir, buildFileName(r));
        const ok = await runFfmpeg(path.join(jobDir, res.playlistFile), outFile, r, null);
        active.delete(r.id);
        wipeJobDir();
        if (ok) return; // runFfmpeg already marked completed
        // Remux failed — re-download state lost; surface a clear error.
        updateRecord(r.id, { status: 'error', error: 'Downloaded the stream but could not package it. Try again or another server.' });
        return;
      }
      active.delete(r.id);
      updateRecord(r.id, {
        status: 'completed',
        progress: 100,
        file: r.id + '/local.m3u8',
        size: dirSize(jobDir)
      });
    } catch (err) {
      active.delete(r.id);
      const msg = (err && err.message) || String(err);
      if (/cancelled/i.test(msg)) {
        wipeJobDir();
        return; // cancelDownload already marked it
      }
      wipeJobDir();
      updateRecord(r.id, { status: 'error', error: msg });
    }
  }

  async function finishCapture(r, streamUrl, kind, win) {
    clearTimeout(timeout);
    // Forward the capture session's cookies (Cloudflare clearance, session-
    // bound URL signatures). Signed-URL CDNs often reject cookie-less fetches
    // with 429/403 even when Referer/UA match.
    let cookieHeader = '';
    try {
      if (dlSession && dlSession.cookies && typeof dlSession.cookies.get === 'function') {
        const cookies = await dlSession.cookies.get({ url: streamUrl });
        if (cookies && cookies.length) {
          cookieHeader = cookies.map((c) => c.name + '=' + c.value).join('; ');
        }
      }
    } catch (e) { /* ignore */ }
    const jobHeaders = Object.assign({}, reqHeaders);
    if (cookieHeader) jobHeaders.Cookie = cookieHeader;
    try { if (!win.isDestroyed()) win.destroy(); } catch (e) { /* ignore */ }
    const cur = library.find((x) => x.id === r.id);
    if (!cur || cur.status === 'canceled') {
      active.delete(r.id);
      return;
    }
    if (kind === 'hls') {
      await downloadHlsJob(r, streamUrl, jobHeaders);
      return;
    }
    // Progressive file: plain HTTPS download, no ffmpeg involved at all.
    await downloadDirectFile(r, streamUrl, jobHeaders);
  }

  async function downloadDirectFile(r, streamUrl, jobHeaders) {
    const clean = String(streamUrl).split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    let ext = 'mp4';
    if (dot !== -1) {
      const e = clean.slice(dot + 1).toLowerCase();
      if (['mp4', 'webm', 'mkv'].includes(e)) ext = e;
    }
    const outFile = path.join(downloadsDir, buildFileName(r, ext));
    const slot = {};
    active.set(r.id, { ...(active.get(r.id) || {}), slot });
    updateRecord(r.id, { status: 'downloading', progress: 1 });
    const isCancelled = () => {
      const cur = library.find((x) => x.id === r.id);
      return !cur || cur.status === 'canceled';
    };
    try {
      await hls.downloadFileStreamed(streamUrl, outFile, jobHeaders || reqHeaders, {
        slot,
        isCancelled,
        onProgress: (written, total) => {
          const pct = total > 0
            ? Math.min(99, Math.round((written / total) * 100))
            : Math.min(99, Math.round(written / (50 * 1024 * 1024) * 100)); // ~50MB per point when size unknown
          updateRecord(r.id, { status: 'downloading', progress: pct });
        },
      });
      if (isCancelled()) {
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
        return;
      }
      active.delete(r.id);
      updateRecord(r.id, {
        status: 'completed',
        progress: 100,
        file: path.basename(outFile),
        size: statSize(outFile)
      });
    } catch (err) {
      active.delete(r.id);
      const msg = (err && err.message) || String(err);
      if (/cancelled/i.test(msg)) {
        try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
        return; // cancelDownload already marked it
      }
      try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
      updateRecord(r.id, { status: 'error', error: msg });
    }
  }

  return rec.id;
}

function cancelDownload(id) {
  const entry = active.get(id);
  if (entry) stopActive(id);
  const rec = library.find((r) => r.id === id);
  if (rec && (rec.status === 'downloading' || rec.status === 'starting' || rec.status === 'connecting')) {
    updateRecord(id, { status: 'canceled', progress: 0 });
  }
  return true;
}

function deleteDownload(id) {
  const entry = active.get(id);
  if (entry) stopActive(id);
  const rec = library.find((r) => r.id === id);
  if (rec) {
    // HLS jobs live in downloads/<id>/ — remove the whole folder.
    try {
      const jobDir = path.join(downloadsDir, rec.id);
      if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
    if (rec.file) {
      try {
        const full = path.join(downloadsDir, path.basename(rec.file));
        if (fs.existsSync(full)) fs.unlinkSync(full);
      } catch (e) { /* ignore */ }
    }
  }
  library = library.filter((r) => r.id !== id);
  saveIndex();
  broadcast('removed', { id });
  return true;
}

function openDownloadsFolder() {
  try { shell.openPath(downloadsDir); } catch (e) { /* ignore */ }
}

function filePathForDownload(rec) {
  if (!rec || !rec.file) return null;
  const full = path.join(downloadsDir, path.basename(rec.file));
  return fs.existsSync(full) ? full : null;
}

function init(deps) {
  getMainWindow = deps.getMainWindow;
  downloadsDir = path.join(app.getPath('userData'), 'downloads');
  indexPath = path.join(downloadsDir, 'downloads-index.json');
  fs.mkdirSync(downloadsDir, { recursive: true });

  try {
    library = JSON.parse(fs.readFileSync(indexPath, 'utf8')) || [];
  } catch (e) {
    library = [];
  }

  // Serve saved files to the renderer over jflixdl:// so they can be <video>-played.
  // Two shapes: legacy flat files (jflixdl://<file>) and per-job folders
  // (jflixdl://<jobId>/<path>) used by HLS segment downloads.
  const MIME_BY_EXT = {
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/MP2T',
    '.m4s': 'video/iso.segment',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.vtt': 'text/vtt',
    '.bin': 'application/octet-stream',
    '.key': 'application/octet-stream',
  };
  function mimeFor(file) {
    const ext = path.extname(String(file || '')).toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
  }
  function resolveDlPath(first, rest) {
    if (!first) return null;
    if (!rest || !rest.length) {
      // Legacy flat file in the downloads root.
      const full = path.join(downloadsDir, path.basename(first));
      return full.startsWith(downloadsDir) ? full : null;
    }
    // Per-job folder: downloads/<jobId>/<rel path>, traversal-guarded.
    const jobDir = path.join(downloadsDir, path.basename(first));
    const full = path.normalize(path.join(jobDir, rest.join(path.sep)));
    if (full !== jobDir && !full.startsWith(jobDir + path.sep)) return null;
    if (!full.startsWith(downloadsDir)) return null;
    return full;
  }
  function fileResponse(full, mime, request) {
    let stat;
    try {
      stat = fs.statSync(full);
      if (!stat.isFile()) return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response('Not found', { status: 404 });
    }
    const size = stat.size;
    // Byte ranges so <video> can seek inside offline files.
    try {
      const range = request.headers.get('range');
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          let start = m[1] === '' ? 0 : parseInt(m[1], 10);
          let end = m[2] === '' ? size - 1 : parseInt(m[2], 10);
          if (isNaN(start) || start < 0) start = 0;
          if (isNaN(end) || end >= size) end = size - 1;
          if (start >= size || end < start) {
            return new Response('Range Not Satisfiable', { status: 416 });
          }
          return new Response(fs.createReadStream(full, { start, end }), {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(end - start + 1),
              'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
              'Accept-Ranges': 'bytes'
            }
          });
        }
      }
    } catch (err) { /* fall through to full body */ }
    return new Response(fs.createReadStream(full), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes'
      }
    });
  }
  try {
    protocol.handle('jflixdl', (request) => {
      try {
        const url = new URL(request.url);
        const first = decodeURIComponent(url.host || '');
        const rest = url.pathname.split('/').filter(Boolean).map((s) => {
          try { return decodeURIComponent(s); } catch (e) { return ''; }
        }).filter((s) => s && s !== '.' && s !== '..');
        const full = resolveDlPath(first, rest);
        if (!full) {
          return new Response('Not allowed', { status: 403 });
        }
        return fileResponse(full, mimeFor(full), request);
      } catch (err) {
        return new Response('Bad request', { status: 400 });
      }
    });
  } catch (err) {
    // fallback for older Electron: registerFileProtocol
    try {
      protocol.registerFileProtocol('jflixdl', (request, callback) => {
        try {
          const url = new URL(request.url);
          const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
          callback({ path: path.join(downloadsDir, path.basename(name)) });
        } catch (e) {
          callback({ statusCode: 400 });
        }
      });
    } catch (e2) {
      console.error('[Downloads] Could not register jflixdl protocol:', e2.message);
    }
  }

  // IPC surface for the renderer bridge
  ipcMain.handle('dl:start', (event, payload) => startDownload(payload || {}));
  ipcMain.handle('dl:list', () => library.map((r) => ({
    ...r,
    fileUrl: r.file
      ? 'jflixdl://' + String(r.file).split('/').map((s) => encodeURIComponent(s)).join('/')
      : null
  })));
  ipcMain.handle('dl:cancel', (event, id) => cancelDownload(id));
  ipcMain.handle('dl:delete', (event, id) => deleteDownload(id));
  ipcMain.handle('dl:folder', () => openDownloadsFolder());

  initialized = true;
  try {
    const st = fs.statSync(ffmpegPath);
    let exec = false;
    try {
      fs.accessSync(ffmpegPath, fs.constants.X_OK);
      exec = true;
    } catch (e) { /* not executable */ }
    console.log('[Downloads] ffmpeg:', ffmpegPath, st.size + ' bytes, executable=' + exec);
  } catch (err) {
    console.log('[Downloads] ffmpeg unavailable:', String(ffmpegPath), '-', err.message,
      '(direct MP4 downloads still work; HLS remux falls back to local.m3u8)');
  }
  console.log('[Downloads] Download manager ready. Files saved to:', downloadsDir);
}

function dirSize(dir) {
  let total = 0;
  try {
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        try {
          const st = fs.statSync(full);
          if (st.isDirectory()) walk(full);
          else total += st.size;
        } catch (e) { /* ignore */ }
      }
    };
    walk(dir);
  } catch (e) { /* ignore */ }
  return total;
}

module.exports = { init, isInitialized: () => initialized };
