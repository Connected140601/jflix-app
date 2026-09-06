// JFlix Android — download bridge shim.
//
// The Android app injects a *synchronous* native object as `window.AndroidDownloads`
// (see android supa/.../DownloadBridge.java). The site's download code (player.js,
// downloads.js) expects the promise-based `window.jflixDownloads` shape that the
// Electron preload provides, so this shim adapts one to the other.
//
// Must load BEFORE js/player.js and js/downloads.js. It intentionally does nothing
// unless the native Android interface is present, so web browsers and Electron are
// completely unaffected (Electron owns window.jflixDownloads via its preload).
(function () {
  'use strict';
  if (window.electronAPI || window.jflixDownloads) return;
  if (typeof window.AndroidDownloads === 'undefined') return;

  function parseJson(s, fallback) {
    try {
      const v = JSON.parse(s);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  window.jflixDownloads = {
    isSupported: function () {
      return typeof window.AndroidDownloads !== 'undefined';
    },
    start: function (payload) {
      return new Promise(function (resolve, reject) {
        try {
          resolve(window.AndroidDownloads.startDownload(JSON.stringify(payload || {})));
        } catch (e) {
          reject(e);
        }
      });
    },
    list: function () {
      return new Promise(function (resolve) {
        try {
          resolve(parseJson(window.AndroidDownloads.listDownloads(), []));
        } catch (e) {
          resolve([]);
        }
      });
    },
    cancel: function (id) {
      return new Promise(function (resolve) {
        try {
          resolve(window.AndroidDownloads.cancelDownload(String(id)) === 'true');
        } catch (e) {
          resolve(false);
        }
      });
    },
    remove: function (id) {
      return new Promise(function (resolve) {
        try {
          resolve(window.AndroidDownloads.removeDownload(String(id)) === 'true');
        } catch (e) {
          resolve(false);
        }
      });
    },
    openFolder: function () {
      return new Promise(function (resolve) {
        try {
          window.AndroidDownloads.openDownloads();
        } catch (e) { /* ignore */ }
        resolve(true);
      });
    },
    onEvent: function (callback) {
      const handler = function () {
        try { callback({}); } catch (err) { console.error('[Downloads] event callback error:', err); }
      };
      // Native pushes download progress by dispatching this on the main WebView.
      window.addEventListener('jflix-dl-event', handler);
      return function () { window.removeEventListener('jflix-dl-event', handler); };
    }
  };
})();
