// Exit Confirmation Modal - Detects leaving JFlix domain v1.8
// Silently blocks external navigation (no modal) - follows Electron navigation guard pattern
// ACTIVE ONLY in Electron app and Android native app
(function() {
  'use strict';

  // Detect Electron app
  const IS_ELECTRON = window.electronAPI && typeof window.electronAPI.isElectron === 'function' && window.electronAPI.isElectron();

  // Detect Android native app
  const IS_ANDROID_NATIVE = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                            /JFlix-Android/i.test(navigator.userAgent);

  // Only activate navigation blocking for Electron app or Android native app
  if (!IS_ELECTRON && !IS_ANDROID_NATIVE) {
    console.log('[Exit Confirmation] Regular web browser detected — navigation blocking DISABLED');
    return;
  }

  if (IS_ELECTRON) {
    console.log('[Exit Confirmation] Electron app detected — silent navigation blocking ACTIVE');
  }

  if (IS_ANDROID_NATIVE) {
    console.log('[Exit Confirmation] JFlix Android app detected — silent navigation blocking ACTIVE');
  }

  // Silently skip exit confirmation on player pages (main player.html and
  // aniu watch.html — video pages keep embed behavior identical everywhere;
  // the native app shells still guard top-level navigation there)
  if (window.location.pathname.includes('player.html') ||
      window.location.pathname.includes('watch.html')) {
    console.log('[Exit Confirmation] On player/watch page — navigation confirmation disabled');
    return;
  }

  const currentDomain = window.location.hostname;
  const currentOrigin = window.location.origin;

  // Allowed external domains (exceptions)
  const ALLOWED_DOMAINS = ['vidvault.ru', 'www.vidvault.ru'];

  function isLeavingJFlix(url) {
    if (!url) return false;
    if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('#')) {
      return false;
    }
    try {
      const urlObj = new URL(url, currentOrigin);
      const newDomain = urlObj.hostname;

      // Check if domain is in allowed list
      if (ALLOWED_DOMAINS.includes(newDomain)) {
        console.log('[Navigation Allowed] Exception domain:', newDomain);
        return false;
      }

      // Check if the new hostname is different from current JFlix domain
      return urlObj.hostname !== currentDomain;
    } catch (e) {
      return false;
    }
  }

  // Intercept all link clicks that leave JFlix - SILENTLY BLOCK
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || link.hasAttribute('download')) return;

    if (isLeavingJFlix(href)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[Navigation Blocked] External link prevented:', href);
      return false;
    }
  }, true);

  // Intercept window.location.href changes - SILENTLY BLOCK
  const hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  if (hrefDescriptor && hrefDescriptor.set) {
    const originalHrefSetter = hrefDescriptor.set;
    Object.defineProperty(window.location, 'href', {
      set: function(value) {
        if (isLeavingJFlix(value)) {
          console.log('[Navigation Blocked] External location.href prevented:', value);
          return;
        } else {
          originalHrefSetter.call(this, value);
        }
      }
    });
  }

  // Intercept window.location.assign - SILENTLY BLOCK
  const originalAssign = window.location.assign;
  window.location.assign = function(url) {
    if (isLeavingJFlix(url)) {
      console.log('[Navigation Blocked] External location.assign prevented:', url);
      return;
    }
    return originalAssign.call(this, url);
  };

  // Intercept window.open - SILENTLY BLOCK
  const originalOpen = window.open;
  window.open = function(url, ...args) {
    if (isLeavingJFlix(url)) {
      console.log('[Navigation Blocked] External window.open prevented:', url);
      return null;
    }
    return originalOpen.call(this, url, ...args);
  };

  // Remove beforeunload listener - no confirmation needed
  // Navigation is now silently blocked

  console.log('[Exit Confirmation] Loaded - silently blocks external navigation');

})();
