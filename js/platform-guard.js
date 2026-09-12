/**
 * Platform Guard & Monetag Ad Controller
 *
 * Requirements:
 * 1. Premium members or active voucher holders:
 *    - Completely block / deactivate all Monetag ads and network calls.
 *    - Completely block / hide all Adsterra ads (ad-free premium experience).
 * 2. Free members / no active voucher:
 *    - All ads from Monetag ONLY are active, working, and earning revenue.
 *    - Adsterra ads remain strictly blocked in apps (Electron, Android, iOS).
 * 3. Dynamic real-time reactivity:
 *    - When a user redeems a voucher or logs in as premium, Monetag ads are purged and blocked immediately.
 *    - When a user logs out, Monetag ads reactivate and continue earning.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__jflixPlatformGuardInitialized === true) {
    if (typeof window.syncMonetagAdsState === 'function') {
      window.syncMonetagAdsState();
    }
    return;
  }
  window.__jflixPlatformGuardInitialized = true;

  var ua = navigator.userAgent || '';

  // ── 1. Platform Detection ───────────────────────────────────────────────────
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

  var IS_JFLIX_NATIVE = /JFlix/i.test(ua);
  var IS_IOS_WRAPPER = /JFlix-iOS/i.test(ua) ||
                       (/JFlixNativeApp/i.test(ua) && /iPhone|iPad|iPod/i.test(ua)) ||
                       (typeof window.IS_IOS_APP !== 'undefined' && window.IS_IOS_APP === true) ||
                       (typeof window.IS_IOS_NATIVE !== 'undefined' && window.IS_IOS_NATIVE === true);

  var IS_IOS_PWA =
    ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true) &&
    (/iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)));

  if (IS_IOS_WRAPPER || IS_IOS_PWA) {
    document.documentElement.classList.add('is-ios-app');
    window.IS_IOS_APP = true;
    window.IS_IOS_NATIVE = true;
    window.IS_NATIVE_APP = true;
  }

  var isAppUser = IS_ELECTRON || IS_ANDROID_NATIVE || IS_ANDROID_WEBVIEW || IS_ANDROID_FROM_STORAGE || IS_JFLIX_NATIVE || IS_IOS_WRAPPER || IS_IOS_PWA;
  var isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(ua);
  window.isAppUser = isAppUser;

  // ── 2. Monetag Configuration & Ad Network Domains ───────────────────────────
  var MONETAG_SCRIPT_URL = 'https://quge5.com/88/tag.min.js';
  var MONETAG_ZONE = '279268';
  var MONETAG_DOMAINS = [
    'quge5.com',
    '5gvci.com',
    '3nbf4.com',
    '6opo.com',
    'ay267.com',
    'ekhay.com',
    'b3mny.com',
    'auqot.com',
    'al5sm.com',
    'monetag.com',
    'propellerads.com',
    'proparm.com',
    'tsyndicate.com'
  ];

  function isMonetagUrl(value) {
    if (!value) return false;
    var str = String(value).toLowerCase();
    for (var i = 0; i < MONETAG_DOMAINS.length; i++) {
      if (str.indexOf(MONETAG_DOMAINS[i]) !== -1) return true;
    }
    return false;
  }

  function isAdsterraUrl(value) {
    if (!value) return false;
    var str = String(value).toLowerCase();
    return str.indexOf('heavinessslight.com') !== -1 ||
           str.indexOf('b8efvmfmh') !== -1 ||
           str.indexOf('55db4af92ab5047a54bf7fe8d75e9b9d') !== -1 ||
           str.indexOf('a07e2698dd341dc16434352384a70cf3') !== -1;
  }

  function isAdsterraBlocked() {
    // Adsterra is strictly blocked in Electron, Android, and iOS applications
    if (isAppUser) return true;
    // In web browser: blocked if user has active voucher or premium account
    return hasActiveVoucherOrPremium();
  }

  function isMonetagBlocked() {
    // Monetag is strictly NOT applied in regular web browsers
    if (!isAppUser) return true;
    // In applications: blocked if user has active voucher or premium account
    return hasActiveVoucherOrPremium();
  }

  function isBlockedUrl(value) {
    if (isAdsterraBlocked() && isAdsterraUrl(value)) return true;
    if (isMonetagBlocked() && isMonetagUrl(value)) return true;
    return false;
  }

  // Helper to safely read from localStorage or sessionStorage
  function safeGetStorage(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var v = localStorage.getItem(key);
        if (v !== null && v !== undefined) return v;
      }
    } catch (e) {}
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        var s = sessionStorage.getItem(key);
        if (s !== null && s !== undefined) return s;
      }
    } catch (e) {}
    return null;
  }

  // ── 3. Check Premium or Active Voucher Status ───────────────────────────────
  function hasActiveVoucherOrPremium() {
    try {
      // A. Direct voucher keys in localStorage or sessionStorage
      var vKeys = [
        'jflix_voucher',
        'jflix_voucher_code',
        'jflix_active_voucher',
        'jflix_user_voucher',
        'jflix_redeemed_voucher'
      ];
      for (var i = 0; i < vKeys.length; i++) {
        var v = safeGetStorage(vKeys[i]);
        if (v && typeof v === 'string' && v.trim().length > 0) {
          // Check if stored as JSON
          var exp = null;
          try {
            var parsed = JSON.parse(v);
            if (parsed && typeof parsed === 'object') {
              exp = parsed.expires_at || parsed.expiresAt || parsed.expiry || parsed.expiration;
            }
          } catch (_) {}

          if (!exp) {
            exp = safeGetStorage(vKeys[i] + '_expiry') || 
                  safeGetStorage('jflix_voucher_expiry');
          }

          var isExpired = exp ? (new Date(exp) < new Date()) : false;
          if (!isExpired) {
            return true;
          }
        }
      }

      // B. User profile object in localStorage / sessionStorage
      var userJson = safeGetStorage('jflix_user') || 
                     safeGetStorage('jflix_auth_user');
      if (userJson) {
        var user = typeof userJson === 'string' ? JSON.parse(userJson) : userJson;
        if (user && typeof user === 'object') {
          // Admin access
          if (user.is_admin === 1 || user.is_admin === true || user.role === 'admin') {
            return true;
          }

          // Lifetime access
          if (user.is_premium_lifetime === 1 || user.is_premium_lifetime === true || user.isPremiumLifetime === true) {
            return true;
          }

          // Active subscription or voucher
          var subType = (user.subscription_type || user.subscriptionType || '').toLowerCase();
          var isPremFlag = user.isPremium === true || user.is_premium === true;
          var hasVoucherCode = Boolean(user.voucher_code || user.voucherCode || user.voucher);
          var isVoucherSource = (user.premium_source === 'voucher' || user.premiumSource === 'voucher');

          if (subType === 'premium' || isPremFlag || hasVoucherCode || isVoucherSource) {
            var expiry = user.subscription_expires_at || 
                         user.subscriptionExpiresAt || 
                         user.premiumExpiry || 
                         user.voucher_expires_at || 
                         user.voucherExpiresAt || 
                         user.expiresAt;
            var isExpired = expiry ? (new Date(expiry) < new Date()) : false;
            if (!isExpired) {
              return true;
            }
          }
        }
      }

      // C. Live window.jflixAuth state if initialized
      if (window.jflixAuth && typeof window.jflixAuth.getCurrentUser === 'function') {
        var u = window.jflixAuth.getCurrentUser() || window.jflixAuth.user;
        if (u) {
          if (u.is_admin === 1 || u.is_admin === true || u.role === 'admin') return true;
          if (u.is_premium_lifetime === 1 || u.is_premium_lifetime === true || u.isPremiumLifetime === true) return true;
          var uSub = (u.subscription_type || u.subscriptionType || '').toLowerCase();
          var uPrem = (uSub === 'premium') || (u.isPremium === true) || (u.is_premium === true);
          var uVoucher = Boolean(u.voucher_code || u.voucherCode || u.voucher);
          if (uPrem || uVoucher) {
            var uExp = u.subscription_expires_at || u.subscriptionExpiresAt || u.premiumExpiry || u.voucher_expires_at || u.voucherExpiresAt || u.expiresAt;
            if (!uExp || new Date(uExp) > new Date()) {
              return true;
            }
          }
        }
      }

      // D. window.userHasPremiumAccess helper
      if (typeof window.userHasPremiumAccess === 'function' && window.userHasPremiumAccess()) {
        return true;
      }
    } catch (e) {
      console.warn('[Platform Guard] Error checking voucher/premium state:', e);
    }
    return false;
  }

  window.hasActiveVoucherOrPremium = hasActiveVoucherOrPremium;
  window.isMonetagEligible = function () {
    if (!isAppUser) return false;
    return !hasActiveVoucherOrPremium();
  };

  // ── 4. Monetag Ad Activation & Deactivation Controllers ─────────────────────

  /**
   * Deactivates and blocks all Monetag ads completely.
   * Invoked in regular web browsers and for premium members / active vouchers.
   */
  function deactivateMonetagAds() {
    window.JFLIX_BLOCK_MONETAG = true;
    window.MONETAG_ACTIVE = false;
    document.documentElement.classList.add('hide-monetag-ads');

    // 1. Remove all Monetag script tags from DOM
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s.src || s.getAttribute('src') || '';
      var zone = s.getAttribute('data-zone') || '';
      if (isMonetagUrl(src) || zone === MONETAG_ZONE || s.id === 'jflix-monetag-tag') {
        try { s.parentNode.removeChild(s); } catch (e) {}
      }
    }

    // 2. Remove all Monetag iframes
    var iframes = document.querySelectorAll('iframe');
    for (var j = 0; j < iframes.length; j++) {
      var f = iframes[j];
      var fSrc = f.src || f.getAttribute('src') || '';
      if (isMonetagUrl(fSrc)) {
        try { f.parentNode.removeChild(f); } catch (e) {}
      }
    }

    // 3. Remove all Monetag ad containers, in-page push popups, overlays
    var adElements = document.querySelectorAll('[class*="monetag"], [id*="monetag"], [class*="zone-279268"], [id*="zone-279268"]');
    for (var k = 0; k < adElements.length; k++) {
      try { adElements[k].parentNode.removeChild(adElements[k]); } catch (e) {}
    }

    // 4. Neutralize global Monetag handlers
    try {
      delete window._monetag;
      delete window.__monetag;
      delete window.show_optin;
    } catch (e) {}

    // 5. Notify service worker if active
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'JFLIX_AUTH_UPDATE',
          hasActiveVoucherOrPremium: true
        });
      }
    } catch (e) {}
  }

  /**
   * Activates Monetag MultiTag ads for free members in apps only (Electron, Android, iOS).
   * Never activates in regular web browsers.
   */
  function activateMonetagAds() {
    // Monetag is strictly applied in Electron, Android, and iOS applications only
    if (!isAppUser) {
      deactivateMonetagAds();
      return;
    }

    window.JFLIX_BLOCK_MONETAG = false;
    window.MONETAG_ACTIVE = true;
    document.documentElement.classList.remove('hide-monetag-ads');

    // Check if script is already present
    var existing = document.getElementById('jflix-monetag-tag') || 
                   document.querySelector('script[src*="quge5.com"], script[data-zone="' + MONETAG_ZONE + '"]');
    if (!existing) {
      var script = document.createElement('script');
      script.id = 'jflix-monetag-tag';
      script.src = MONETAG_SCRIPT_URL;
      script.setAttribute('data-zone', MONETAG_ZONE);
      script.async = true;
      script.setAttribute('data-cfasync', 'false');

      var target = document.head || document.documentElement;
      if (target) {
        target.appendChild(script);
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          (document.head || document.documentElement).appendChild(script);
        });
      }
      console.log('[Platform Guard] Monetag MultiTag ads active in app for free member (Zone ' + MONETAG_ZONE + ').');
    }

    // Notify service worker if active
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'JFLIX_AUTH_UPDATE',
          hasActiveVoucherOrPremium: false
        });
      }
    } catch (e) {}
  }

  /**
   * Evaluates current auth/voucher state and platform:
   * - In Web Browser: Monetag is completely disabled. Only Adsterra works (for free members).
   * - In Apps (Electron, Android, iOS): Adsterra is blocked. Monetag works for free members, blocked for premium/voucher.
   */
  function syncMonetagAdsState() {
    var hasPremOrVoucher = hasActiveVoucherOrPremium();

    // ── Platform: Web Browser ───────────────────────────────────
    if (!isAppUser) {
      // Never apply Monetag in web browser
      deactivateMonetagAds();

      if (hasPremOrVoucher) {
        // Premium or active voucher: block Adsterra as well (ad-free)
        window.JFLIX_HIDE_ADS = true;
        document.documentElement.classList.add('hide-ads');
      } else {
        // Free member / guest in web browser: Adsterra ads WORK and earn
        window.JFLIX_HIDE_ADS = false;
        document.documentElement.classList.remove('hide-ads');
      }
      return !hasPremOrVoucher;
    }

    // ── Platform: Apps (Electron, Android, iOS) ─────────────────
    // Always hide Adsterra in native apps
    window.JFLIX_HIDE_ADS = true;
    document.documentElement.classList.add('hide-ads');

    if (hasPremOrVoucher) {
      // Premium / active voucher in apps: ad-free (block Monetag)
      deactivateMonetagAds();
    } else {
      // Free / guest in apps: Monetag is active and earning
      activateMonetagAds();
    }
    return !hasPremOrVoucher;
  }

  window.deactivateMonetagAds = deactivateMonetagAds;
  window.activateMonetagAds = activateMonetagAds;
  window.syncMonetagAdsState = syncMonetagAdsState;

  // ── 5. Network & Window Interception for Blocked Ad Domains ─────────────────

  // Intercept window.open
  if (typeof window.open === 'function') {
    var originalWindowOpen = window.open;
    window.open = function (url, target, features) {
      if (isMonetagBlocked() && isMonetagUrl(url)) {
        return null;
      }
      if (isAdsterraBlocked() && isAdsterraUrl(url)) {
        return null;
      }
      // In Electron, if Monetag is active, open ad in external system browser so Monetag earns
      if (!isMonetagBlocked() && isMonetagUrl(url) && window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
        window.electronAPI.openExternal(url);
        return null;
      }
      return originalWindowOpen.apply(this, arguments);
    };
  }

  // Intercept fetch
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function (resource, init) {
      var urlStr = (typeof resource === 'string') ? resource : (resource && resource.url ? resource.url : '');
      if (isBlockedUrl(urlStr)) {
        return Promise.resolve(new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return origFetch.apply(this, arguments);
    };
  }

  // Intercept XMLHttpRequest
  if (typeof window.XMLHttpRequest !== 'undefined') {
    var origXHROpen = XMLHttpRequest.prototype.open;
    var origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__jflixTargetUrl = url;
      return origXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (isBlockedUrl(this.__jflixTargetUrl)) {
        try { this.abort(); } catch (e) {}
        return;
      }
      return origXHRSend.apply(this, arguments);
    };
  }

  // ── 6. CSS Hiding Rules for Adsterra, Monetag (when premium), & Ad Elements ─
  function addHideAdsCSS() {
    if (document.getElementById('jflix-hide-ads-css')) return;
    var style = document.createElement('style');
    style.id = 'jflix-hide-ads-css';
    style.textContent = [
      'html.hide-monetag-ads [class*="monetag"],',
      'html.hide-monetag-ads [id*="monetag"],',
      'html.hide-monetag-ads [class*="zone-279268"],',
      'html.hide-monetag-ads [id*="zone-279268"],',
      'html.hide-monetag-ads iframe[src*="quge5.com"],',
      'html.hide-monetag-ads iframe[src*="5gvci.com"],',
      'html.hide-monetag-ads iframe[src*="3nbf4.com"],',
      'html.hide-monetag-ads iframe[src*="6opo.com"],',
      'html.hide-monetag-ads iframe[src*="ay267.com"],',
      'html.hide-monetag-ads iframe[src*="ekhay.com"],',
      'html.hide-monetag-ads iframe[src*="b3mny.com"],',
      'html.hide-monetag-ads iframe[src*="auqot.com"],',
      'html.hide-monetag-ads iframe[src*="al5sm.com"],',
      'html.hide-monetag-ads iframe[src*="monetag.com"],',
      'html.hide-monetag-ads iframe[src*="propellerads.com"],',
      'html.hide-monetag-ads iframe[src*="proparm.com"],',
      'html.hide-monetag-ads iframe[src*="tsyndicate.com"] {',
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

  addHideAdsCSS();

  // ── 7. DOM Ad Element Helpers & Interceptors ────────────────────────────────
  function isAdElement(el) {
    if (!el) return false;
    if (el.tagName === 'SCRIPT' && isBlockedUrl(el.src)) return true;
    if (el.tagName === 'IFRAME' && isBlockedUrl(el.src)) return true;
    if (el.tagName === 'A' && isBlockedUrl(el.href)) return true;
    if (isMonetagBlocked() && (isMonetagUrl(el.src) || isMonetagUrl(el.href))) return true;
    if (el.id) {
      var id = el.id.toLowerCase();
      var isAdsterraId = (
        id.indexOf('aniu-sticky-banner') !== -1 ||
        id.indexOf('aniu-leaderboard') !== -1 ||
        id.indexOf('aniu-rectangle') !== -1 ||
        id.indexOf('aniu-adblock-notice') !== -1 ||
        id.indexOf('container-a07e') !== -1 ||
        id.indexOf('container-55db') !== -1 ||
        id.indexOf('adsterra') !== -1
      );
      if (isAdsterraBlocked() && isAdsterraId) return true;
      if (isMonetagBlocked() && id.indexOf('monetag') !== -1) return true;
    }
    if (isMonetagBlocked() && el.className && typeof el.className === 'string') {
      var cls = el.className.toLowerCase();
      if (cls.indexOf('monetag') !== -1 || cls.indexOf('zone-279268') !== -1) return true;
    }
    return false;
  }

  function removeAdElement(el) {
    if (el && el.parentNode) {
      try { el.parentNode.removeChild(el); } catch (e) {}
    }
  }

  // ── 8. Patch document.createElement ─────────────────────────────────────────
  var originalCreateElement = document.createElement;
  document.createElement = function (tagName) {
    var el = originalCreateElement.apply(document, arguments);
    var tag = String(tagName).toLowerCase();
    if (tag !== 'script' && tag !== 'iframe' && tag !== 'a' && tag !== 'img') return el;

    var originalSetAttribute = el.setAttribute;
    el.setAttribute = function (name, value) {
      if ((name === 'src' || name === 'href') && isBlockedUrl(value)) {
        return;
      }
      return originalSetAttribute.call(el, name, value);
    };

    if (tag === 'script' || tag === 'iframe' || tag === 'img') {
      try {
        Object.defineProperty(el, 'src', {
          set: function (value) {
            if (isBlockedUrl(value)) return;
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
            if (isBlockedUrl(value)) return;
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

  // ── 9. MutationObserver to Remove Ad Nodes ──────────────────────────────────
  function scanAndRemoveAds(root) {
    if (!root || !root.querySelectorAll) return;
    var selectors = [];
    if (isAdsterraBlocked()) {
      selectors.push(
        'script[src*="heavinessslight.com"]',
        'iframe[src*="heavinessslight.com"]',
        'a[href*="heavinessslight.com"]',
        'a[href*="b8efvmfmh"]',
        'a[href*="55db4af92ab5047a54bf7fe8d75e9b9d"]',
        'a[href*="a07e2698dd341dc16434352384a70cf3"]',
        '[id*="aniu-sticky-banner"]',
        '[id*="aniu-leaderboard"]',
        '[id*="aniu-rectangle"]',
        '[id*="aniu-adblock-notice"]',
        '[id*="container-a07e"]',
        '[id*="container-55db"]'
      );
    }
    if (isMonetagBlocked()) {
      selectors.push(
        'script[src*="quge5.com"]',
        'script[src*="5gvci.com"]',
        'script[src*="3nbf4.com"]',
        'script[src*="6opo.com"]',
        'script[src*="ay267.com"]',
        'iframe[src*="quge5.com"]',
        'iframe[src*="6opo.com"]',
        '[class*="monetag"]',
        '[id*="monetag"]',
        '[class*="zone-279268"]',
        '[id*="zone-279268"]'
      );
    }
    if (selectors.length === 0) return;
    var ads = root.querySelectorAll(selectors.join(', '));
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

  // Initial scan
  if (document.body) {
    scanAndRemoveAds(document.body);
  }

  // Block document.write for ad scripts
  var originalDocWrite = document.write;
  document.write = function (content) {
    if (typeof content === 'string') {
      if (isAdsterraBlocked() && isAdsterraUrl(content)) return;
      if (isMonetagBlocked() && isMonetagUrl(content)) return;
    }
    return originalDocWrite.apply(document, arguments);
  };

  // ── 10. Reactive Event Listeners for State Changes ─────────────────────────
  window.addEventListener('storage', function (e) {
    if (!e) return;
    if (
      e.key === 'jflix_user' || 
      e.key === 'jflix_voucher' || 
      e.key === 'jflix_voucher_code' || 
      e.key === 'jflix_active_voucher' || 
      e.key === 'jflix_voucher_expiry'
    ) {
      syncMonetagAdsState();
    }
  });

  window.addEventListener('jflix-auth-change', function () {
    syncMonetagAdsState();
  });

  window.addEventListener('jflix-voucher-redeemed', function () {
    deactivateMonetagAds();
  });

  // ── 11. Initial Execution ───────────────────────────────────────────────────
  syncMonetagAdsState();
})();
