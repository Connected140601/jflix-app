/**
 * ANIU Ads Manager
 * Injects Adsterra ads for web browser and PWA only.
 * Skips Electron and Android native app (JFlix unique user agent).
 *
 * KEY: atOptions MUST be set in global (window) scope immediately before
 * the matching invoke.js is loaded — this is how Adsterra iframe ads work.
 * We use a sequenced loader: set window.atOptions, then append <script src>.
 *
 * NOTE: This is a policy-compliant version. It does NOT use third-party
 * anti-adblock or popunder scripts. For Adsterra's official Anti-AdBlock
 * solution, request it from your Adsterra account manager.
 */

// ── ANIU Page Transition / Button Loader ───────────────────────────────────
(function () {
  'use strict';

  var LOADER_ID = 'aniu-page-loader';
  var LOADING_CLASS = 'aniu-loading';

  function createLoader() {
    if (document.getElementById(LOADER_ID)) return;
    var loader = document.createElement('div');
    loader.id = LOADER_ID;
    loader.className = 'aniu-page-loader';
    loader.innerHTML = '<div class="loader-spinner"></div><div class="loader-text">Loading...</div>';
    document.body.appendChild(loader);
  }

  function showPageLoader(text) {
    createLoader();
    var loader = document.getElementById(LOADER_ID);
    if (!loader) return;
    if (text) {
      var txt = loader.querySelector('.loader-text');
      if (txt) txt.textContent = text;
    }
    loader.classList.add('active');
  }

  function hidePageLoader() {
    var loader = document.getElementById(LOADER_ID);
    if (loader) loader.classList.remove('active');
  }

  function setButtonLoading(el) {
    if (!el || el.classList.contains(LOADING_CLASS)) return;
    el.classList.add(LOADING_CLASS);
    var spinner = document.createElement('span');
    spinner.className = 'aniu-loader';
    el.appendChild(spinner);
  }

  // Show loader whenever window.location is changed to navigate
  function patchLocation() {
    try {
      var loc = window.location;
      var originalAssign = loc.assign.bind(loc);
      loc.assign = function (url) {
        showPageLoader('Loading...');
        return originalAssign(url);
      };
      var originalReplace = loc.replace.bind(loc);
      loc.replace = function (url) {
        showPageLoader('Loading...');
        return originalReplace(url);
      };
      try {
        var originalHref = Object.getOwnPropertyDescriptor(loc, 'href');
        if (originalHref && originalHref.set) {
          Object.defineProperty(loc, 'href', {
            set: function (url) {
              showPageLoader('Loading...');
              originalHref.set.call(loc, url);
              return url;
            },
            get: originalHref.get
          });
        }
      } catch (e) {}
    } catch (e) {}
  }

  // Attach loader on DOM ready
  function initLoader() {
    createLoader();
    patchLocation();

    document.body.addEventListener('click', function (e) {
      var target = e.target.closest && e.target.closest('a, button, .latest-episode-card, .wp-action-btn, .wp-type-btn, .episode-btn, .wp-season-card, .wp-breadcrumb-link, .row-arrow, .card-btn, .hero-btn, .nav-link');
      if (!target) return;

      // Don't interfere with cards/elements that have their own navigation handler
      if (target.classList.contains('anime-card')) return;

      var tag = target.tagName.toLowerCase();
      var href = target.getAttribute('href') || '';
      var onclick = target.getAttribute('onclick') || '';
      var isNavigating = false;

      if (tag === 'a' && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !target.hasAttribute('target')) {
        isNavigating = true;
      }
      if (tag === 'button' && (onclick.indexOf('window.location.href') !== -1 || onclick.indexOf('changeEpisode') !== -1 || onclick.indexOf('changeType') !== -1 || onclick.indexOf('switchSeason') !== -1)) {
        isNavigating = true;
      }
      if (target.classList.contains('latest-episode-card') || target.classList.contains('wp-season-card')) {
        isNavigating = true;
      }
      if (target.classList.contains('row-arrow') && onclick.indexOf('scrollRow') !== -1) {
        isNavigating = false;
      }
      if (target.classList.contains('hero-btn') && onclick.indexOf('window.location.href') !== -1) {
        isNavigating = true;
      }

      if (!isNavigating) return;

      // Show button/element loading state
      if (tag === 'button' || target.classList.contains('card-btn') || target.classList.contains('hero-btn') || target.classList.contains('wp-action-btn') || target.classList.contains('wp-type-btn') || target.classList.contains('episode-btn')) {
        setButtonLoading(target);
      }

      // Show page loader
      showPageLoader('Loading...');
    });

    // Safety fallback: hide loader on visibility change / load errors
    window.addEventListener('pageshow', function () {
      hidePageLoader();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoader);
  } else {
    initLoader();
  }
})();

(function () {
  'use strict';

  // ── Platform Detection ──────────────────────────────────────────────────────
  var ua = navigator.userAgent;
  var IS_ELECTRON = ua.indexOf('Electron') !== -1;
  var IS_ANDROID_WEBVIEW =
    /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua) ||
    /JFlix-Android/i.test(ua) ||
    (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID) ||
    (function () { try { return localStorage.getItem('jflix_is_android') === 'true'; } catch (e) { return false; } })();
  var IS_LOCALHOST =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // iOS/iPad PWA mode detection
  var IS_IOS_PWA = (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) &&
                   (/iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)));

  // Only run on web browser and PWA — skip native apps
  if (window.JFLIX_HIDE_ADS === true || IS_ELECTRON || IS_ANDROID_WEBVIEW || IS_LOCALHOST) return;

  // ── Config ─────────────────────────────────────────────────────────────────
  var HOST = 'https://heavinessslight.com';
  var KEYS = {
    banner:      '3d2cdb24291c0ef1776d8e5f8b73b5f7',
    rectangle:   '985241e815704103478c2ec28530d20a',
    leaderboard: 'a3497336bfd1bd0d9eb6314a119b322d'
  };
  var SOCIAL_BAR_URL = 'https://heavinessslight.com/a07e2698dd341dc16434352384a70cf3/invoke.js';
  var SOCIAL_BAR_CONTAINER_ID = 'container-a07e2698dd341dc16434352384a70cf3';
  var isMobile = window.innerWidth < 768;

  // ── Core: load an iframe ad unit ───────────────────────────────────────────
  // Sets window.atOptions THEN appends the invoke script — the only reliable way.
  function loadIframeAd(key, width, height, container) {
    // Skip if this ad was already loaded into the container.
    if (container.getAttribute('data-ad-loaded') === 'true') return;
    container.setAttribute('data-ad-loaded', 'true');

    window.atOptions = { key: key, format: 'iframe', height: height, width: width, params: {} };
    var s = document.createElement('script');
    s.src = HOST + '/' + key + '/invoke.js';
    container.appendChild(s);
  }

  // ── 1. Social Bar ──────────────────────────────────────────────────────────
  // Adsterra Social Bar is a self-positioning sticky unit — just load the script.
  // Adsterra recommends only ONE Social Bar per page and placement before </body>.
  function isSocialBarLoaded() {
    if (document.getElementById(SOCIAL_BAR_CONTAINER_ID)) return true;
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src === SOCIAL_BAR_URL) return true;
    }
    return false;
  }

  function loadSocialBar() {
    if (window.__aniuSocialBarLoaded) return;
    if (isSocialBarLoaded()) return;
    window.__aniuSocialBarLoaded = true;

    // Inject CSS to constrain Social Bar on mobile so it doesn't cover the whole screen
    if (!document.getElementById('aniu-social-bar-constraints')) {
      var style = document.createElement('style');
      style.id = 'aniu-social-bar-constraints';
      style.textContent = [
        '/* Adsterra Social Bar — mobile constraints (ANIU) */',
        '@media (max-width: 768px) {',
        '  #container-a07e2698dd341dc16434352384a70cf3,',
        '  #container-a07e2698dd341dc16434352384a70cf3 > *,',
        '  [id^="container-a07e"] {',
        '    max-height: 60px !important;',
        '    max-width: 100% !important;',
        '    overflow: hidden !important;',
        '  }',
        '  #container-a07e2698dd341dc16434352384a70cf3 iframe,',
        '  [id^="container-a07e"] iframe {',
        '    max-height: 60px !important;',
        '    height: 60px !important;',
        '  }',
        '  #container-a07e2698dd341dc16434352384a70cf3 {',
        '    position: fixed !important;',
        '    bottom: 0 !important;',
        '    left: 0 !important;',
        '    right: 0 !important;',
        '    top: auto !important;',
        '    height: auto !important;',
        '    max-height: 60px !important;',
        '    z-index: 99990 !important;',
        '    background: transparent !important;',
        '    pointer-events: auto !important;',
        '  }',
        '  body { padding-bottom: 65px !important; }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }

    var container = document.createElement('div');
    container.id = SOCIAL_BAR_CONTAINER_ID;
    document.body.appendChild(container);

    var s = document.createElement('script');
    s.src = SOCIAL_BAR_URL;
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    document.body.appendChild(s);
  }

  // ── 2. Sticky bottom banner — mobile 320×50 ────────────────────────────────
  function loadStickyBanner() {
    if (document.getElementById('aniu-sticky-banner')) return;

    var wrap = document.createElement('div');
    wrap.id = 'aniu-sticky-banner';
    wrap.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'z-index:99990',
      'background:#0d0d0d',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'min-height:58px',
      'box-shadow:0 -2px 16px rgba(0,0,0,0.7)',
      'overflow:hidden'
    ].join(';');

    // Ad slot container
    var slot = document.createElement('div');
    slot.style.cssText = 'width:320px;height:50px;flex-shrink:0;';
    wrap.appendChild(slot);

    // Dismiss button
    var btn = document.createElement('button');
    btn.textContent = '✕';
    btn.setAttribute('aria-label', 'Close ad');
    btn.style.cssText = [
      'position:absolute',
      'top:3px',
      'right:6px',
      'background:none',
      'border:none',
      'color:#666',
      'font-size:12px',
      'cursor:pointer',
      'padding:2px 5px',
      'line-height:1'
    ].join(';');
    btn.onclick = function () {
      wrap.remove();
      document.body.style.paddingBottom = '';
    };
    wrap.appendChild(btn);

    document.body.appendChild(wrap);
    document.body.style.paddingBottom = '62px';

    // Load ad into the slot AFTER element is in the DOM
    loadIframeAd(KEYS.banner, 320, 50, slot);
  }

  // ── 3. Leaderboard — desktop 728×90, below navbar ─────────────────────────
  function loadLeaderboard() {
    if (document.getElementById('aniu-leaderboard')) return;

    var wrap = document.createElement('div');
    wrap.id = 'aniu-leaderboard';
    wrap.style.cssText = [
      'width:100%',
      'background:#0d0d0d',
      'padding:8px 0',
      'text-align:center',
      'overflow:hidden',
      'border-bottom:1px solid rgba(255,255,255,0.05)'
    ].join(';');

    var slot = document.createElement('div');
    slot.style.cssText = 'width:728px;height:90px;margin:0 auto;max-width:100%;';
    wrap.appendChild(slot);

    var navbar = document.getElementById('navbar') || document.querySelector('nav.navbar, .navbar');
    if (navbar && navbar.parentNode) {
      navbar.parentNode.insertBefore(wrap, navbar.nextSibling);
    } else {
      document.body.insertBefore(wrap, document.body.firstChild);
    }

    loadIframeAd(KEYS.leaderboard, 728, 90, slot);
  }

  // ── 4. Rectangle 300×250 — inline mid-content ─────────────────────────────
  function loadRectangle() {
    if (document.getElementById('aniu-rectangle')) return;

    var wrap = document.createElement('div');
    wrap.id = 'aniu-rectangle';
    wrap.style.cssText = [
      'width:100%',
      'max-width:100%',
      'padding:16px 0',
      'text-align:center',
      'overflow:hidden',
      'clear:both'
    ].join(';');

    var slot = document.createElement('div');
    slot.style.cssText = 'width:300px;height:250px;margin:0 auto;max-width:100%;';
    wrap.appendChild(slot);

    // Best placement: after hero, or before footer, or before floating button
    var placed = false;
    var selectors = [
      '.hero', '.hero-section', '.banner-section', '[class*="hero"]',
      '.trending-section', '.section', 'section', 'main', '.content'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.parentNode && !placed) {
        el.parentNode.insertBefore(wrap, el.nextSibling);
        placed = true;
        break;
      }
    }
    if (!placed) {
      var footer = document.querySelector('footer, .footer');
      var floatBtn = document.querySelector('.floating-button');
      var target = footer || floatBtn;
      if (target && target.parentNode) {
        target.parentNode.insertBefore(wrap, target);
      } else {
        document.body.appendChild(wrap);
      }
    }

    loadIframeAd(KEYS.rectangle, 300, 250, slot);
  }

  function detectAdblock(callback) {
    var bait = document.createElement('div');
    bait.className = 'ads ad adsbygoogle advertisement';
    bait.style.cssText = 'position:absolute;top:-1000px;left:-1000px;width:1px;height:1px;opacity:0;pointer-events:none;';
    bait.innerHTML = '&nbsp;';
    document.body.appendChild(bait);

    setTimeout(function() {
      var baitStyle = window.getComputedStyle(bait);
      var blocked = baitStyle.display === 'none' ||
                    baitStyle.visibility === 'hidden' ||
                    bait.offsetHeight === 0 ||
                    bait.offsetParent === null;
      document.body.removeChild(bait);
      callback(blocked);
    }, 300);
  }

  function showAdblockNotice() {
    if (window.__aniuAdblockNoticeShown) return;
    try {
      if (sessionStorage.getItem('aniu-adblock-notice-dismissed')) return;
    } catch (e) {}

    var notice = document.createElement('div');
    notice.id = 'aniu-adblock-notice';
    notice.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99998;background:#0d0d0d;border-top:2px solid #4ecdc4;color:#fff;padding:12px 16px;font-size:14px;text-align:center;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;';
    notice.innerHTML = '<span><i class="fas fa-shield-alt" style="color:#4ecdc4;margin-right:8px;"></i>Ad blocker detected. ANIU is free because of ads. Please disable your ad blocker to support us.</span>' +
                       '<button id="aniu-adblock-close" style="background:#4ecdc4;color:#1a1a2e;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Got it</button>';

    document.body.appendChild(notice);
    window.__aniuAdblockNoticeShown = true;

    document.getElementById('aniu-adblock-close').addEventListener('click', function() {
      notice.style.display = 'none';
      try {
        sessionStorage.setItem('aniu-adblock-notice-dismissed', '1');
      } catch (e) {}
    });

    setTimeout(function() {
      if (notice && notice.style.display !== 'none') {
        notice.style.display = 'none';
      }
    }, 10000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    if (window.__aniuAdsInitialized) return;
    window.__aniuAdsInitialized = true;

    if (isMobile) {
      loadStickyBanner();     // mobile: 320×50 sticky bottom
      loadRectangle();        // mobile: 300×250 inline
    } else {
      loadLeaderboard();      // desktop: 728×90 below navbar
      loadRectangle();        // desktop: 300×250 inline
    }

    // Load ONE Social Bar per page, at the bottom.
    loadSocialBar();

    // Detect ad block after ads have had a moment to load.
    setTimeout(function() {
      var iframes = document.querySelectorAll('iframe[src*="heavinessslight.com"], iframe[src*="adsterra.com"]');
      if (iframes.length > 0) return;
      detectAdblock(function(blocked) {
        if (blocked) showAdblockNotice();
      });
    }, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// ── JFlix floating button: guaranteed trip home ─────────────────────────────
// The markup (<a class="floating-button" href="https://jflix.uk">) navigates
// natively in web browsers, but native app shells (Electron / Android WebView)
// silently block cross-origin hops (e.g. app served from *.pages.dev). This
// capture-phase handler owns the click and navigates to the JFlix home of the
// CURRENT origin instead — on production (jflix.uk/aniu/*) that IS
// https://jflix.uk. Modified/middle clicks are ignored so new-tab behavior
// keeps working.
(function () {
  'use strict';

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    var t = e.target && e.target.closest ? e.target.closest('a.floating-button') : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    var home = window.location.origin + '/';
    try {
      window.location.href = home;
    } catch (err) {
      try { window.location.replace(home); } catch (e2) { /* ignore */ }
    }
  }, true);
})();
