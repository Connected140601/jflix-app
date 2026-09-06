// HLS Stream Extractor — VidLink.pro
// Extracts direct MP4 URLs and returns them AS-IS for direct browser playback.
// No proxying: the video CDN (bcdn.hakunaymatata.com) blocks ANY request
// carrying a Referer header, regardless of value or origin (Cloudflare or
// otherwise). A real browser can play these URLs directly in a <video> tag
// as long as the tag uses referrerpolicy="no-referrer" so no Referer is sent.
import nacl from 'tweetnacl';

const VL_KEY_HEX = 'c75136c5668bbfe65a7ecad431a745db68b5f381555b38d8f6c699449cf11fcd';
const VL_NONCE = new Uint8Array(24);

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) b[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return b;
}

function vlEncryptToken(mediaId) {
  const ts = Math.floor(Date.now() / 1000) + 480;
  const idBytes = new TextEncoder().encode(mediaId);
  const tsBuf = new Uint8Array(8);
  const dv = new DataView(tsBuf.buffer);
  dv.setUint32(0, Math.floor(ts / 0x100000000));
  dv.setUint32(4, ts >>> 0);
  const msg = new Uint8Array(idBytes.length + 8);
  msg.set(idBytes); msg.set(tsBuf, idBytes.length);
  const key = hexToBytes(VL_KEY_HEX);
  const enc = nacl.secretbox(msg, VL_NONCE, key);
  const payload = new Uint8Array(24 + enc.length);
  payload.set(VL_NONCE); payload.set(enc, 24);
  let bin = ''; for (let i = 0; i < payload.length; i++) bin += String.fromCharCode(payload[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://vidlink.pro', 'Referer': 'https://vidlink.pro/',
};

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const corsH = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (url.searchParams.get('cdncheck')) {
    return checkCdns(corsH);
  }

  const tmdbId = url.searchParams.get('id');
  const type = url.searchParams.get('type') || 'movie';
  const season = url.searchParams.get('season') || '1';
  const episode = url.searchParams.get('episode') || '1';

  if (!tmdbId) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsH });

  try {
    const token = vlEncryptToken(tmdbId);
    const apiUrl = type === 'tv'
      ? `https://vidlink.pro/api/b/tv/${token}/${season}/${episode}?multiLang=1&_cb=${Date.now()}`
      : `https://vidlink.pro/api/b/movie/${token}?multiLang=1&_cb=${Date.now()}`;

    const resp = await fetch(apiUrl, { headers: VL_HEADERS, cf: { cacheTtl: 0, cacheEverything: false } });
    if (!resp.ok) return new Response(JSON.stringify({ error: `VidLink ${resp.status}` }), { status: resp.status, headers: corsH });

    const data = await resp.json();
    if (!data) return new Response(JSON.stringify({ error: 'No stream' }), { status: 404, headers: corsH });

    const streams = [];
    const q = data?.stream?.qualities || {};
    for (const [qual, info] of Object.entries(q)) {
      if (info.url && info.url.startsWith('http')) {
        streams.push({
          url: info.url, // direct CDN URL — play with referrerpolicy="no-referrer"
          type: info.type === 'mp4' ? 'mp4' : 'hls',
          label: `${qual}p`,
          quality: qual,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, tmdbId, type, streams }, null, 2), { status: 200, headers: corsH });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsH });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  }});
}

async function checkCdns(corsH) {
  const targets = [
    'https://streamtape.com/',
    'https://doodstream.com/',
    'https://filemoon.sx/',
    'https://mixdrop.co/',
    'https://vidplay.site/',
    'https://short.icu/',
    'https://vtbe.to/',
  ];
  const results = {};
  for (const t of targets) {
    try {
      const r = await fetch(t, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
      results[t] = { status: r.status };
    } catch (e) {
      results[t] = { error: e.message };
    }
  }
  return new Response(JSON.stringify(results, null, 2), { status: 200, headers: corsH });
}
// force
