// JFlix Downloads page — renders the library managed by the native app.
(function () {
  'use strict';

  const demo = /[?&]demo=1/.test(window.location.search);
  const bridge = demo ? makeDemoBridge() : (typeof window.jflixDownloads !== 'undefined') ? window.jflixDownloads : null;
  const isNative = !!bridge;

  // Demo bridge so the UI can be previewed in a browser (no native app needed)
  function makeDemoBridge() {
    const listeners = [];
    const library = [
      { id: 'demo1', title: 'Breaking Bad', type: 'tv', season: 1, episode: 1, status: 'completed', progress: 100, file: 'breaking-bad-s01e01.mp4', size: 245 * 1024 * 1024, createdAt: Date.now() - 86400000, fileUrl: '' },
      { id: 'demo2', title: 'Stranger Things', type: 'tv', season: 4, episode: 9, status: 'downloading', progress: 42, file: null, size: 0, createdAt: Date.now() - 60000, error: null },
      { id: 'demo3', title: 'The Bear', type: 'tv', season: 3, episode: 5, status: 'error', progress: 0, file: null, size: 0, createdAt: Date.now() - 5000, error: 'Network interrupted' }
    ];
    const emit = () => listeners.forEach((fn) => { try { fn({}); } catch (e) { /* ignore */ } });

    // Simulate the demo download progressing to completion
    let sim = setInterval(() => {
      const d = library.find((r) => r.id === 'demo2');
      if (!d) { clearInterval(sim); return; }
      d.progress += Math.floor(Math.random() * 4) + 1;
      if (d.progress >= 100) {
        d.status = 'completed';
        d.progress = 100;
        d.size = 512 * 1024 * 1024;
        d.file = 'stranger-things-s04e09.mp4';
        clearInterval(sim);
      }
      emit();
    }, 1800);

    return {
      isSupported: () => true,
      start: (payload) => {
        library.unshift({ id: 'demo-new' + Date.now(), title: payload.title || 'Media', type: payload.type, season: payload.season, episode: payload.episode, status: 'downloading', progress: 1, file: null, size: 0, createdAt: Date.now(), error: null });
        emit();
        return Promise.resolve('ok');
      },
      list: () => Promise.resolve(library.map((r) => ({ ...r }))),
      cancel: (id) => { const r = library.find((x) => x.id === id); if (r) r.status = 'canceled'; emit(); return Promise.resolve(true); },
      remove: (id) => { const i = library.findIndex((x) => x.id === id); if (i >= 0) library.splice(i, 1); emit(); return Promise.resolve(true); },
      openFolder: () => Promise.resolve(true),
      onEvent: (fn) => { listeners.push(fn); return () => {}; }
    };
  }

  function el(id) { return document.getElementById(id); }

  function fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function subtitleFor(r) {
    const parts = [];
    if (r.season != null && r.episode != null) {
      const typeName = r.type === 'movie' ? '' : (r.type ? r.type.toUpperCase() + ' ' : '');
      parts.push(`${typeName}S${String(r.season).padStart(2, '0')}E${String(r.episode).padStart(2, '0')}`);
    } else if (r.type === 'movie') {
      parts.push('Movie');
    } else if (r.type && r.type !== 'movie') {
      parts.push(r.type.toUpperCase());
    }
    if (r.server) parts.push(r.server);
    return parts.join(' • ');
  }

  function statusLabel(r) {
    switch (r.status) {
      case 'starting': return 'Starting…';
      case 'connecting': return 'Locating stream…';
      case 'downloading': return 'Downloading…';
      case 'completed': return 'Ready to watch';
      case 'canceled': return 'Canceled';
      case 'error': return 'Failed';
      default: return r.status;
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderCard(r) {
    const isActive = r.status === 'starting' || r.status === 'connecting' || r.status === 'downloading';
    const isDone = r.status === 'completed';
    const isErr = r.status === 'error' || r.status === 'canceled';
    const progress = r.progress || 0;

    let actions = '';
    if (isActive) {
      actions = `<button class="dl-act-cancel" data-id="${r.id}" data-act="cancel"><i class="fas fa-times-circle"></i> Cancel</button>`;
    } else if (isDone) {
      actions = `
        <button class="dl-act" data-id="${r.id}" data-act="play"><i class="fas fa-play"></i> Play</button>
        <button class="dl-act dl-act-danger" data-id="${r.id}" data-act="delete"><i class="fas fa-trash"></i> Delete</button>`;
    } else if (isErr) {
      actions = `<button class="dl-act-danger-ghost" data-id="${r.id}" data-act="delete"><i class="fas fa-trash"></i> Remove</button>`;
    }

    const meta = subtitleFor(r);
    return `
      <div class="dl-card ${isActive ? 'dl-card-active' : ''} ${isErr ? 'dl-card-err' : ''}" data-id="${r.id}">
        <div class="dl-thumb">
          <i class="fas ${isDone ? 'fa-circle-check' : isActive ? 'fa-spinner fa-spin' : isErr ? 'fa-circle-xmark' : 'fa-download'}"></i>
        </div>
        <div class="dl-body">
          <div class="dl-row1">
            <div class="dl-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</div>
            ${meta ? `<div class="dl-meta">${escapeHtml(meta)}</div>` : ''}
          </div>
          <div class="dl-row2">
            ${isActive ? `
              <div class="dl-progress-track"><div class="dl-progress-fill" style="width:${progress}%"></div></div>
              <div class="dl-percent">${progress}%</div>
            ` : ''}
            <div class="dl-status ${isErr ? 'dl-status-err' : ''}">
              <i class="fas ${isDone ? 'fa-check' : isActive ? 'fa-circle-notch fa-spin' : isErr ? 'fa-exclamation-triangle' : 'fa-pause'}"></i>
              ${statusLabel(r)}
              ${r.error ? ` <span class="dl-error-msg">— ${escapeHtml(r.error)}</span>` : ''}
            </div>
            ${r.size && isDone ? `<div class="dl-size">${fmtSize(r.size)}</div>` : ''}
            ${r.fileUrl ? `<div class="dl-file">${escapeHtml(r.file)}</div>` : ''}
          </div>
        </div>
        <div class="dl-actions">${actions}</div>
      </div>`;
  }

  function render() {
    if (!bridge) {
      el('dl-unsupported').style.display = 'block';
      el('dl-main').style.display = 'none';
      el('dl-open-folder').style.display = 'none';
      return;
    }
    el('dl-unsupported').style.display = 'none';

    bridge.list().then((items) => {
      const all = items || [];
      const active = all.filter((r) => r.status === 'starting' || r.status === 'connecting' || r.status === 'downloading');
      const saved = all.filter((r) => r.status === 'completed');
      const others = all.filter((r) => r.status === 'error' || r.status === 'canceled');

      const activeList = el('dl-active-list');
      const savedList = el('dl-saved-list');

      if (active.length > 0) {
        el('dl-active-section').style.display = 'block';
        activeList.innerHTML = active.map(renderCard).join('');
      } else {
        el('dl-active-section').style.display = 'none';
        activeList.innerHTML = '';
      }

      const html = [...saved, ...others].map(renderCard).join('');
      if (html) {
        el('dl-saved-section').style.display = 'block';
        savedList.innerHTML = html;
        el('dl-clear-completed').style.display = saved.length > 0 ? 'inline-flex' : 'none';
      } else {
        el('dl-saved-section').style.display = 'none';
        savedList.innerHTML = '';
      }

      el('dl-empty').style.display = (active.length === 0 && saved.length === 0 && others.length === 0) ? 'block' : 'none';
    }).catch((err) => {
      console.error('[Downloads] list failed:', err);
    });
  }

  // Click handling for list items
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-act');
    if (act === 'cancel' && bridge) bridge.cancel(id).then(render);
    else if (act === 'delete' && bridge) bridge.remove(id).then(render);
    else if (act === 'play') {
      bridge.list().then((items) => {
        const item = (items || []).find((r) => r.id === id);
        if (item && item.fileUrl) {
          el('dl-player-title').textContent = `${item.title} ${subtitleFor(item) ? '— ' + subtitleFor(item) : ''}`.trim();
          const video = el('dl-video');
          closeDlHls();
          // HLS sidecar (no-ffmpeg fallback): play local.m3u8 through hls.js
          // when the browser can't do it natively (Chrome/Electron).
          if (/\.m3u8($|\?)/i.test(item.fileUrl) && !(video.canPlayType && video.canPlayType('application/vnd.apple.mpegurl'))) {
            if (window.Hls && window.Hls.isSupported()) {
              try {
                const hls = new window.Hls({ enableWorker: true });
                window.__dlHls = hls;
                hls.on(window.Hls.Events.ERROR, (evt, data) => {
                  if (data && data.fatal) {
                    console.error('[Downloads] hls.js fatal:', data.type, data.details);
                    try { hls.destroy(); } catch (e) { /* ignore */ }
                    window.__dlHls = null;
                  }
                });
                hls.loadSource(item.fileUrl);
                hls.attachMedia(video);
              } catch (e) {
                console.error('[Downloads] hls.js attach failed:', e);
                video.src = item.fileUrl;
              }
            } else {
              video.src = item.fileUrl; // Safari / native HLS
            }
          } else {
            video.src = item.fileUrl;
          }
          el('dl-player-overlay').style.display = 'flex';
        }
      });
    }
  });

  window.closeDlPlayer = function () {
    closeDlHls();
    const video = el('dl-video');
    video.pause();
    video.removeAttribute('src');
    video.load();
    el('dl-player-overlay').style.display = 'none';
  };

  function closeDlHls() {
    if (window.__dlHls) {
      try { window.__dlHls.destroy(); } catch (e) { /* ignore */ }
      window.__dlHls = null;
    }
  }

  el('dl-open-folder').addEventListener('click', () => { if (bridge) bridge.openFolder(); });
  el('dl-clear-completed').addEventListener('click', () => {
    if (!bridge) return;
    bridge.list().then((items) => {
      const done = (items || []).filter((r) => r.status === 'completed');
      return Promise.all(done.map((r) => bridge.remove(r.id)));
    }).then(render);
  });

  if (bridge) {
    bridge.onEvent(() => render());
  }

  // Load initial list
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
