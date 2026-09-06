/**
 * Platform Guard — hides all ads in Electron and Android apps.
 *
 * Detects:
 *   - Electron user agent
 *   - window.IS_ELECTRON_APP
 *   - JFlix native Android app user agent
 *   - window.IS_ANDROID / localStorage jflix_is_android
 *   - Android WebView (Android + wv)
 *   - localhost (for development)
 *
 * When detected, sets window.JFLIX_HIDE_ADS = true and removes/blocks
 * any Adsterra scripts, iframes, containers, and Smartlinks.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.JFLIX_HIDE_ADS === true) return;

  var ua = navigator.userAgent || '';

  // ── Detection ───────────────────────────────────────────────────────────────
  var IS_ELECTRON =
    /Electron/i.test(ua) ||
    /JFlixElectron/i.test(ua) ||
    ua.indexOf('Electron') !== -1 ||
    ua.indexOf('electron') !== -1 ||
    (typeof window.IS_ELECTRON_APP !== 'undefined' && window.IS_ELECTRON_APP === true);

  var IS_ANDROID_NATIVE =
    /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua) ||
    /JFlix-Android/i.test(ua) ||
    /JFlixAndroid/i.test(ua) ||
    /JFlix/i.test(ua) ||
    (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID === true);

  var IS_ANDROID_WEBVIEW = /Android/i.test(ua) && /wv/i.test(ua);

  var IS_ANDROID_FROM_STORAGE = false;
  try {
    IS_ANDROID_FROM_STORAGE = localStorage.getItem('jflix_is_android') === 'true';
  } catch (e) {}

  var IS_LOCALHOST =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '';

  // Any JFlix-branded native wrapper (covers future UA variants)
  var IS_JFLIX_NATIVE = /JFlix/i.test(ua);

  // ── Decision ────────────────────────────────────────────────────────────────
  if (IS_ELECTRON || IS_ANDROID_NATIVE || IS_ANDROID_WEBVIEW || IS_ANDROID_FROM_STORAGE || IS_LOCALHOST || IS_JFLIX_NATIVE) {
    window.JFLIX_HIDE_ADS = true;
  } else {
    window.JFLIX_HIDE_ADS = false;
    return;
  }

  // ── CSS hide ────────────────────────────────────────────────────────────────
  function addHideAdsCSS() {
    if (document.getElementById('jflix-hide-ads-css')) return;
    var style = document.createElement('style');
    style.id = 'jflix-hide-ads-css';
    style.textContent = [
      'html.hide-ads, html.hide-ads body { --ad-display: none !important; }',
      'html.hide-ads .ad-section::before,',
      'html.hide-ads .ad-container::before,',
      'html.hide-ads .ad-desktop::before,',
      'html.hide-ads .ad-mobile::before,',
      'html.hide-ads .ad-medium-rectangle::before,',
      'html.hide-ads .ad-legal-page-middle::before,',
      'html.hide-ads .ad-legal-page-bottom::before,',
      'html.hide-ads .ad-before-footer::before,',
      'html.hide-ads #aniu-sticky-banner::before,',
      'html.hide-ads #aniu-leaderboard::before,',
      'html.hide-ads #aniu-rectangle::before { content: none !important; display: none !important; }',
      'html.hide-ads .ad-section,',
      'html.hide-ads .ad-container,',
      'html.hide-ads .ad-desktop,',
      'html.hide-ads .ad-mobile,',
      'html.hide-ads .ad-medium-rectangle,',
      'html.hide-ads .ad-legal-page-middle,',
      'html.hide-ads .ad-legal-page-bottom,',
      'html.hide-ads .ad-before-footer { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; pointer-events: none !important; }',
      'html.hide-ads [id*="aniu-sticky-banner"],',
      'html.hide-ads [id*="aniu-leaderboard"],',
      'html.hide-ads [id*="aniu-rectangle"],',
      'html.hide-ads [id*="aniu-adblock-notice"],',
      'html.hide-ads [id*="container-a07e"],',
      'html.hide-ads [id*="container-55db"],',
      'html.hide-ads [id*="Adsterra"],',
      'html.hide-ads [class*="adsterra"],',
      'html.hide-ads iframe[src*="heavinessslight.com"],',
      'html.hide-ads script[src*="heavinessslight.com"],',
      'html.hide-ads a[href*="heavinessslight.com"],',
      'html.hide-ads a[href*="b8efvmfmh"],',
      'html.hide-ads a[href*="55db4af92ab5047a54bf7fe8d75e9b9d"],',
      'html.hide-ads a[href*="a07e2698dd341dc16434352384a70cf3"] {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  opacity: 0 !important;',
      '  pointer-events: none !important;',
      '  height: 0 !important;',
      '  width: 0 !important;',
      '  max-height: 0 !important;',
      '  max-width: 0 !important;',
      '  overflow: hidden !important;',
      '  position: absolute !important;',
      '  z-index: -9999 !important;',
      '  top: -99999px !important;',
      '  left: -99999px !important;',
      '}',
      'html.hide-ads body { padding-bottom: 0 !important; }'
    ].join('\n');

    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.documentElement.appendChild(style);
    }
  }

  document.documentElement.classList.add('hide-ads');
  addHideAdsCSS();

  // ── Helper: is an ad URL? ───────────────────────────────────────────────────
  function isAdUrl(value) {
    if (!value) return false;
    value = String(value).toLowerCase();
    return value.indexOf('heavinessslight.com') !== -1 ||
           value.indexOf('b8efvmfmh') !== -1 ||
           value.indexOf('55db4af92ab5047a54bf7fe8d75e9b9d') !== -1 ||
           value.indexOf('a07e2698dd341dc16434352384a70cf3') !== -1;
  }

  function isAdElement(el) {
    if (!el) return false;
    if (el.tagName === 'SCRIPT' && isAdUrl(el.src)) return true;
    if (el.tagName === 'IFRAME' && isAdUrl(el.src)) return true;
    if (el.tagName === 'A' && isAdUrl(el.href)) return true;
    if (el.id) {
      var id = el.id.toLowerCase();
      if (id.indexOf('aniu-sticky-banner') !== -1) return true;
      if (id.indexOf('aniu-leaderboard') !== -1) return true;
      if (id.indexOf('aniu-rectangle') !== -1) return true;
      if (id.indexOf('aniu-adblock-notice') !== -1) return true;
      if (id.indexOf('container-a07e') !== -1) return true;
      if (id.indexOf('container-55db') !== -1) return true;
      if (id.indexOf('adsterra') !== -1) return true;
    }
    return false;
  }

  function removeAdElement(el) {
    if (el && el.parentNode) {
      try { el.parentNode.removeChild(el); } catch (e) {}
    }
  }

  // ── Patch document.createElement ────────────────────────────────────────────
  var originalCreateElement = document.createElement;
  document.createElement = function (tagName) {
    var el = originalCreateElement.apply(document, arguments);
    var tag = String(tagName).toLowerCase();
    if (tag !== 'script' && tag !== 'iframe' && tag !== 'a') return el;

    var originalSetAttribute = el.setAttribute;
    el.setAttribute = function (name, value) {
      if ((name === 'src' || name === 'href') && isAdUrl(value)) {
        return;
      }
      return originalSetAttribute.call(el, name, value);
    };

    if (tag === 'script' || tag === 'iframe') {
      try {
        Object.defineProperty(el, 'src', {
          set: function (value) {
            if (isAdUrl(value)) return;
            originalSetAttribute.call(el, 'src', value);
          },
          get: function () {
            return el.getAttribute('src') || '';
          }
        });
      } catch (e) {}
    }

    if (tag === 'a') {
      try {
        Object.defineProperty(el, 'href', {
          set: function (value) {
            if (isAdUrl(value)) return;
            originalSetAttribute.call(el, 'href', value);
          },
          get: function () {
            return el.getAttribute('href') || '';
          }
        });
      } catch (e) {}
    }

    return el;
  };

  // ── MutationObserver to remove ad nodes as the DOM is built ─────────────────
  function scanAndRemoveAds(root) {
    if (!root || !root.querySelectorAll) return;
    var ads = root.querySelectorAll('script[src*="heavinessslight.com"], iframe[src*="heavinessslight.com"], a[href*="heavinessslight.com"], a[href*="b8efvmfmh"], a[href*="55db4af92ab5047a54bf7fe8d75e9b9d"], a[href*="a07e2698dd341dc16434352384a70cf3"], [id*="aniu-sticky-banner"], [id*="aniu-leaderboard"], [id*="aniu-rectangle"], [id*="aniu-adblock-notice"], [id*="container-a07e"], [id*="container-55db"]');
    for (var i = 0; i < ads.length; i++) {
      removeAdElement(ads[i]);
    }
  }

  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        if (!nodes) continue;
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (node.nodeType !== 1) continue;
          if (isAdElement(node)) {
            removeAdElement(node);
            continue;
          }
          if (node.querySelectorAll) {
            scanAndRemoveAds(node);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ── Initial scan of existing DOM ────────────────────────────────────────────
  if (document.body) {
    scanAndRemoveAds(document.body);
  }

  // ── Also block document.write for ad scripts (lightweight) ──────────────────
  var originalDocWrite = document.write;
  document.write = function (content) {
    if (typeof content === 'string' && content.indexOf('heavinessslight.com') !== -1) {
      return;
    }
    return originalDocWrite.apply(document, arguments);
  };
})();
