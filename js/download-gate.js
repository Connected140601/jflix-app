/**
 * JFlix Download Gate
 * On page load, auto-shows the Download App modal for web browser and PWA users.
 * Skips Electron desktop app and Android WebView (unique JFlix user agent).
 * The modal is the existing OS-aware openDownloadAppModal() from download-app-modal.js.
 * After showing, patches the modal to be fully blocking (no dismiss).
 */
(function () {
  'use strict';

  // ── Platform Detection ──────────────────────────────────────────────────────
  const ua = navigator.userAgent;
  const IS_ELECTRON = ua.includes('Electron');
  const IS_ANDROID_WEBVIEW =
    (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID) ||
    /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua) ||
    /JFlix-Android/i.test(ua) ||
    (() => { try { return localStorage.getItem('jflix_is_android') === 'true'; } catch { return false; } })();
  const IS_LOCALHOST =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  // iOS/iPad detection — skip gate entirely so iOS users browse directly
  const IS_IOS = /iPhone|iPad|iPod/i.test(ua) ||
                 (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));

  // Only gate web browser and PWA — skip iOS entirely, Electron, Android WebView, localhost
  if (IS_ELECTRON || IS_ANDROID_WEBVIEW || IS_LOCALHOST || IS_IOS) return;

  // ── Make the modal blocking (patch close buttons / overlay click) ───────────
  function lockModal() {
    // Only lock if this modal was opened by the gate (not user action)
    if (!window._jflixGateOpenedModal) return;

    // Patch the two known modal IDs
    ['jflix-download-premium-modal', 'jflix-ios-premium-modal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;

      // Remove overlay-click dismiss, but only block clicks on the modal backdrop itself
      modal.onclick = null;
      modal.addEventListener('click', e => {
        if (e.target === modal) e.stopPropagation();
      }, true);

      // Hide close buttons but NOT the Watch for Free button
      modal.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'watch-for-free-btn') return; // Never hide Watch for Free
        const txt = btn.textContent.trim();
        if (txt === '×' || txt === '✕' || txt === 'Close' || btn.getAttribute('onclick')?.includes('display')) {
          btn.style.display = 'none';
        }
      });

      // Lock body scroll
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      // Block ESC key
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }, true);
    });

    // Attach Watch for Free handler after modal is in DOM
    ['jflix-download-premium-modal', 'jflix-ios-premium-modal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      const watchFreeBtn = modal.querySelector('#watch-for-free-btn');
      if (watchFreeBtn && !watchFreeBtn.dataset.gateHandlerAttached) {
        watchFreeBtn.dataset.gateHandlerAttached = 'true';
        watchFreeBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          try {
            localStorage.setItem('jflix_watch_free_timestamp', Date.now().toString());
          } catch (err) {}
          modal.style.display = 'none';
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
          window._jflixGateOpenedModal = false; // Clear flag after closing
        });
      }
    });
  }

  // ── Show gate on DOM ready ──────────────────────────────────────────────────
  function showGate() {
    // Bypass if user clicked "Watch for Free" within last 24 hours
    try {
      var ts = localStorage.getItem('jflix_watch_free_timestamp');
      if (ts) {
        var hoursElapsed = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60);
        if (hoursElapsed < 24) return;
      }
    } catch (e) {}

    // Wait for download-app-modal.js to register openDownloadAppModal
    if (typeof window.openDownloadAppModal !== 'function') {
      setTimeout(showGate, 50);
      return;
    }

    // Set flag to indicate this modal was opened by the gate (not user action)
    window._jflixGateOpenedModal = true;
    window.openDownloadAppModal();

    // Lock immediately + once more after a tick (modal may build asynchronously)
    lockModal();
    setTimeout(lockModal, 100);
    setTimeout(lockModal, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGate);
  } else {
    showGate();
  }

})();
