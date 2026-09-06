// JFlix — in-page stream scraper hook (injected into embed pages + iframes).
//
// Adapted from Flickv4's WebViewScraper: hooks XHR/fetch/<video>.src and the
// Performance API to catch video URLs (including extensionless/proxied HLS
// manifests and JSON-embedded playlist URLs), and auto-taps play overlays so
// hidden captures actually start the stream.
//
// Reporting channel: console.log('[JFLIX-STREAM] ' + url). The Electron main
// process listens for console-message events; the Android ghost WebView uses
// its WebChromeClient console hook. Found URLs are first-match-wins.
//
// NOTE: this string is injected verbatim — no template placeholders inside.
module.exports = '(' + function () {
  function post(url) {
    try { console.log('[JFLIX-STREAM] ' + url); } catch (e) {}
    // iOS ghost WebView: report straight to the native bridge as well
    // (guarded — window.webkit.messageHandlers only exists under WKWebView).
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.jflixStream) {
        window.webkit.messageHandlers.jflixStream.postMessage({ url: url });
      }
    } catch (e) {}
  }
  function log(m) {
    try { console.log('[JFLIX-HOOK] ' + m); } catch (e) {}
  }

  var VIDEO_RE = /\.(m3u8|mpd|mp4|webm|mkv)($|\?)/i;
  var VIDEO_HINT_RE = /m3u8|mpegurl|\.mpd($|\?)/i;
  var SKIP_RE = /\.(jpe?g|png|gif|webp|svg|ico|css|woff2?|js|vtt|srt)($|\?)/i;
  var SKIP_HOST_RE = /image\.tmdb\.org|wsrv\.nl|googletagmanager|doubleclick|adsystem|google-analytics|clarity\.ms|yandex/i;

  function isStreamFound() { return !!window.__jflixStreamFound; }
  function isHttpUrl(url) { return typeof url === 'string' && /^https?:\/\//i.test(url); }
  function isSkippable(url) {
    return !isHttpUrl(url) || SKIP_RE.test(url) || SKIP_HOST_RE.test(url);
  }
  function emitVideo(url, source) {
    if (isStreamFound() || isSkippable(url)) return;
    window.__jflixStreamFound = true;
    log(source + ' ' + url);
    post(url);
  }
  function reportIfVideo(url, source) {
    if (!url || (!VIDEO_RE.test(url) && !VIDEO_HINT_RE.test(url))) return;
    emitVideo(url, source);
  }

  function walkJson(node) {
    if (!node || isStreamFound()) return;
    if (typeof node === 'string') { reportIfVideo(node, 'json'); return; }
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length && !isStreamFound(); i++) walkJson(node[i]);
      return;
    }
    if (typeof node !== 'object') return;
    if (typeof node.playlist === 'string' && node.requiresProxy !== true) {
      if (!isSkippable(node.playlist)) emitVideo(node.playlist, 'json.playlist');
      if (isStreamFound()) return;
    }
    if (typeof node.file === 'string') reportIfVideo(node.file, 'json.file');
    if (isStreamFound()) return;
    if (typeof node.url === 'string' && isHttpUrl(node.url)) {
      var kind = String(node.type || node.kind || node.format || '').toLowerCase();
      if (VIDEO_RE.test(node.url) || VIDEO_HINT_RE.test(node.url) ||
          /^(hls|dash|mp4|mpegurl|m3u8|mpd)$/i.test(kind)) {
        emitVideo(node.url, 'json.url');
        if (isStreamFound()) return;
      }
    }
    for (var key in node) {
      if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
      if (key === 'playlist' || key === 'file') continue;
      walkJson(node[key]);
      if (isStreamFound()) return;
    }
  }

  function inspectBody(text, url, source) {
    if (!text || isStreamFound()) return;
    var trimmed = String(text).trim();
    if (trimmed.indexOf('#EXTM3U') === 0) { emitVideo(url, source + '-hls'); return; }
    if (trimmed.indexOf('<') === 0 && /<MPD[\s>]/i.test(trimmed.slice(0, 400))) {
      emitVideo(url, source + '-dash'); return;
    }
    if (trimmed.charAt(0) !== '{' && trimmed.charAt(0) !== '[') return;
    try { walkJson(JSON.parse(trimmed)); } catch (e) {}
  }

  function muteMedia() {
    var nodes = document.querySelectorAll('video, audio');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].muted = true;
      nodes[i].defaultMuted = true;
      try { nodes[i].volume = 0; } catch (e) {}
    }
  }
  if (!window.__jflixScraperMuted) {
    window.__jflixScraperMuted = true;
    muteMedia();
    setInterval(muteMedia, 1000);
    try {
      new MutationObserver(muteMedia).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  function withAutoplay(url) {
    if (!url || url === 'about:blank' || url === 'about:srcdoc') return url;
    try {
      var u = new URL(url, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return url;
      var current = u.searchParams.get('autoplay') || u.searchParams.get('autoPlay');
      if (current === 'true') return url;
      u.searchParams.set('autoplay', 'true');
      return u.toString();
    } catch (e) { return url; }
  }

  function harvestPlayingVideo() {
    if (isStreamFound()) return;
    var nodes = document.querySelectorAll('video');
    for (var i = 0; i < nodes.length; i++) {
      var v = nodes[i];
      var url = v.currentSrc || v.getAttribute('src') || '';
      if (!url || url.indexOf('blob:') === 0) continue;
      reportIfVideo(url, 'video.currentSrc');
      if (!v.paused && isHttpUrl(url) && !isSkippable(url) &&
          url.split('#')[0] !== location.href.split('#')[0]) {
        emitVideo(url, 'video.playing');
      }
    }
    try {
      if (window.videojs && typeof window.videojs.getPlayers === 'function') {
        var players = window.videojs.getPlayers();
        for (var k in players) {
          var p = players[k];
          if (!p || typeof p.currentSource !== 'function') continue;
          var src = p.currentSource();
          var u = src && (src.src || src.url);
          var mime = (src && src.type) || '';
          if (!u) continue;
          reportIfVideo(u, 'videojs.currentSource');
          if (isHttpUrl(u) && !isSkippable(u) && /mpegurl|m3u8|mp4|dash|mpd/i.test(mime)) {
            emitVideo(u, 'videojs.currentSource');
          }
        }
      }
    } catch (e) {}
  }

  if (!window.__jflixScraperHooked) {
    window.__jflixScraperHooked = true;

    var originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function () {
      this.addEventListener('load', function () {
        try {
          var responseURL = this.responseURL;
          if (!responseURL) return;
          reportIfVideo(responseURL, 'xhr');
          var text = typeof this.responseText === 'string' ? this.responseText : '';
          inspectBody(text, responseURL, 'xhr');
        } catch (err) { log('xhr listener error: ' + err); }
      });
      originalOpen.apply(this, arguments);
    };

    if (window.fetch) {
      var originalFetch = window.fetch;
      window.fetch = function (input, init) {
        var requestUrl = typeof input === 'string' ? input : (input && input.url);
        return originalFetch.apply(this, arguments).then(function (response) {
          try {
            var responseURL = response.url || requestUrl;
            reportIfVideo(responseURL, 'fetch');
            var ct = '';
            try { ct = (response.headers && response.headers.get('content-type')) || ''; } catch (e) {}
            if (!ct || /json|mpegurl|m3u8|dash|mpd|text|octet-stream|video|vnd/i.test(ct) || /\/api\//i.test(responseURL || '')) {
              response.clone().text().then(function (text) {
                inspectBody(text, responseURL, 'fetch');
              }).catch(function () {});
            }
          } catch (err) { log('fetch listener error: ' + err); }
          return response;
        });
      };
    }

    try {
      var mediaProto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (mediaProto && !mediaProto.__jflixSrcHooked) {
        mediaProto.__jflixSrcHooked = true;
        var srcDesc = Object.getOwnPropertyDescriptor(mediaProto, 'src');
        if (srcDesc && srcDesc.set) {
          Object.defineProperty(mediaProto, 'src', {
            configurable: true,
            enumerable: srcDesc.enumerable,
            get: function () { return srcDesc.get.call(this); },
            set: function (v) {
              if (v) reportIfVideo(String(v), 'video.src');
              srcDesc.set.call(this, v);
            }
          });
        }
      }
    } catch (e) {}

    try {
      new PerformanceObserver(function (list) {
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) reportIfVideo(entries[i].name, 'perf');
      }).observe({ type: 'resource', buffered: true });
    } catch (e) {}

    // Rewrite nested iframes to autoplay + strip sandbox before navigation.
    try {
      var iframeProto = window.HTMLIFrameElement && window.HTMLIFrameElement.prototype;
      if (iframeProto && !iframeProto.__jflixSrcHooked) {
        iframeProto.__jflixSrcHooked = true;
        var origIframeSetAttr = iframeProto.setAttribute;
        iframeProto.setAttribute = function (name, value) {
          var n = String(name).toLowerCase();
          if (n === 'sandbox') { log('blocked iframe sandbox'); return; }
          if (n === 'src') value = withAutoplay(String(value || ''));
          return origIframeSetAttr.apply(this, arguments);
        };
      }
    } catch (e) {}
  }

  // Drives playback overlays: find play buttons, rewrite iframes, play media,
  // promote the real player iframe to top when nested cross-origin.
  var PLAYER_IFRAME_RE = /\/embed|\/player|\/watch|\/tv\/|\/movie\/|nxsha|videasy|vidfast|vidsrc|vidlink|multiembed|zxcstream|111movies/i;
  var PLAY_SELECTORS = [
    '.vjs-big-play-button', '.jw-icon-playback', '.jw-display-icon-container',
    '.plyr__control--overlaid', '.mejs-overlay-play', '.fluid_initial_play',
    '.fluid_initial_play_button', '.vjs-poster', '[aria-label*="play" i]', '[title="Play" i]'
  ];
  var PLAY_CLASS_RE = /play-btn|playbtn|playbutton|play-button|big-play|overlay-play|icon-play|play-icon/i;

  function classNameOf(el) {
    var cls = el.className;
    if (!cls) return '';
    if (typeof cls === 'string') return cls;
    if (typeof cls.baseVal === 'string') return cls.baseVal;
    return String(cls);
  }
  function inPlayerChrome(el) {
    var n = el;
    while (n && n !== document && n !== document.documentElement) {
      var c = classNameOf(n).toLowerCase();
      if (c.indexOf('control-bar') !== -1 || c.indexOf('vjs-control') !== -1) return true;
      n = n.parentElement;
    }
    return false;
  }
  function isVisible(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    return true;
  }
  function findPlayButton() {
    for (var i = 0; i < PLAY_SELECTORS.length; i++) {
      try {
        var matches = document.querySelectorAll(PLAY_SELECTORS[i]);
        for (var j = 0; j < matches.length; j++) {
          if (isVisible(matches[j]) && !inPlayerChrome(matches[j])) return matches[j];
        }
      } catch (e) {}
    }
    var all = document.querySelectorAll('button, [role="button"], div, span, i');
    for (var k = 0; k < all.length; k++) {
      if (PLAY_CLASS_RE.test(classNameOf(all[k])) && isVisible(all[k]) && !inPlayerChrome(all[k])) return all[k];
    }
    var nodes = document.querySelectorAll('video');
    for (var m = 0; m < nodes.length; m++) {
      if (isVisible(nodes[m]) || nodes[m].readyState > 0) return nodes[m];
    }
    return null;
  }
  function dispatchClick(el) {
    var opts = { bubbles: true, cancelable: true, view: window, button: 0 };
    try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (e) {}
    try { el.click(); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('click', opts)); } catch (e) {}
  }
  function playAllMedia() {
    var nodes = document.querySelectorAll('video, audio');
    for (var i = 0; i < nodes.length; i++) {
      try {
        // Never play() a sourceless element: it flips paused=false without
        // starting anything, which trips the media-started check below.
        var src = nodes[i].currentSrc || nodes[i].getAttribute('src');
        if (!src) continue;
        nodes[i].setAttribute('playsinline', '');
        var p = nodes[i].play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
    try {
      if (typeof window.jwplayer === 'function') {
        var jw = window.jwplayer();
        if (jw && jw.play) jw.play();
      }
    } catch (e) {}
  }
  function unlockIframes() {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      try { if (f.hasAttribute('sandbox')) f.removeAttribute('sandbox'); } catch (e) {}
      try {
        var allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        if (f.getAttribute('allow') !== allow) f.setAttribute('allow', allow);
      } catch (e) {}
      var src = f.getAttribute('src') || '';
      if (!src) continue;
      var next = withAutoplay(src);
      if (next && next !== src) { log('iframe autoplay rewrite'); f.src = next; }
    }
    promotePlayerIframe();
  }
  function promotePlayerIframe() {
    if (isStreamFound()) return false;
    var count = window.__jflixPromoteCount || 0;
    if (count >= 3) return false;
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;
    var frames = document.querySelectorAll('iframe');
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < frames.length; i++) {
      var src = frames[i].src || frames[i].getAttribute('src') || '';
      if (!src || src === 'about:blank') continue;
      try { src = new URL(src, location.href).href; } catch (e) { continue; }
      if (!isHttpUrl(src) || SKIP_HOST_RE.test(src)) continue;
      if (src.split('#')[0] === location.href.split('#')[0]) continue;
      var rect = frames[i].getBoundingClientRect();
      var fills = rect.width >= vw * 0.45 && rect.height >= vh * 0.45;
      var looksPlayer = PLAYER_IFRAME_RE.test(src);
      if (!fills && !looksPlayer) continue;
      var score = rect.width * rect.height + (looksPlayer ? 10000000 : 0);
      if (score > bestScore) { best = src; bestScore = score; }
    }
    if (!best) return false;
    window.__jflixPromoteCount = count + 1;
    log('promoting iframe to top: ' + best);
    try { location.replace(best); } catch (e) {}
    return true;
  }

  var tapStartedAt = Date.now();
  var tapTimer = null;
  function tapOnce() {
    if (isStreamFound()) { if (tapTimer) clearInterval(tapTimer); return; }
    if (Date.now() - tapStartedAt > 30000) { if (tapTimer) clearInterval(tapTimer); return; }
    try {
      unlockIframes();
      if (promotePlayerIframe()) return;
      playAllMedia();
      harvestPlayingVideo();
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        if (!videos[i].paused || videos[i].readyState > 0 || videos[i].currentSrc) return;
      }
      var target = findPlayButton();
      if (!target) return;
      dispatchClick(target);
      if ((target.tagName || '').toLowerCase() === 'video') {
        try {
          var p = target.play();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {}
      }
      log('click dispatched on ' + (target.tagName || 'unknown'));
    } catch (e) { log('tap error: ' + e); }
  }
  tapOnce();
  tapTimer = setInterval(tapOnce, 1000);
  harvestPlayingVideo();
  setInterval(harvestPlayingVideo, 1000);
  log('hook installed');
}.toString() + ')();';
