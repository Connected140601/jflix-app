// JFlix iOS — download bridge shim.
//
// The iOS app exposes an async native bridge over
// `window.webkit.messageHandlers.iosDownloads` (see ios-app/.../DownloadBridge.swift).
// Unlike Android's synchronous interface, calls carry a callback id and the
// native side replies through `window.__iosDlCb`. This shim adapts that to the
// promise-based `window.jflixDownloads` shape that player.js / downloads.js
// already use on Electron and Android.
//
// Must load BEFORE js/player.js and js/downloads.js. It intentionally does
// nothing unless the native iOS interface is present, so web browsers,
// Electron, and Android are completely unaffected.
(function () {
  'use strict';
  if (window.electronAPI || window.jflixDownloads) return;

  function handler() {
    try {
      var w = window.webkit;
      if (w && w.messageHandlers && w.messageHandlers.iosDownloads) {
        return w.messageHandlers.iosDownloads;
      }
    } catch (e) { /* no iOS bridge */ }
    return null;
  }

  if (!handler()) return;

  // Marker read by nativeDownloadSupported() in player.js.
  window.IOSDownloads = true;

  var seq = 0;
  var pending = {};

  window.__iosDlCb = function (payload) {
    var msg = payload;
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); } catch (e) { return; }
    }
    if (!msg || typeof msg.cb === 'undefined') return;
    var fn = pending[msg.cb];
    if (fn) {
      delete pending[msg.cb];
      try { fn(msg.value); } catch (e) { /* ignore */ }
    }
  };

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var h = handler();
      if (!h) {
        reject(new Error('iOS downloads not available'));
        return;
      }
      var cb = 'cb' + (++seq) + '_' + Date.now();
      pending[cb] = resolve;
      try {
        h.postMessage({ cb: cb, method: method, params: (params == null ? null : params) });
      } catch (e) {
        delete pending[cb];
        reject(e);
        return;
      }
      // Never hang the UI if native fails to answer.
      setTimeout(function () {
        if (pending[cb]) {
          delete pending[cb];
          reject(new Error('iOS bridge timeout'));
        }
      }, 30000);
    });
  }

  window.jflixDownloads = {
    isSupported: function () {
      return !!handler();
    },
    start: function (payload) {
      return call('start', payload ? JSON.stringify(payload) : '{}');
    },
    list: function () {
      return call('list', null).then(function (v) {
        return Array.isArray(v) ? v : [];
      });
    },
    cancel: function (id) {
      return call('cancel', String(id)).then(function (v) { return !!v; });
    },
    remove: function (id) {
      return call('remove', String(id)).then(function (v) { return !!v; });
    },
    openFolder: function () {
      return call('openFolder', null).then(function () { return true; });
    },
    onEvent: function (callback) {
      var h = function () {
        try { callback({}); } catch (err) { console.error('[Downloads] event callback error:', err); }
      };
      // Native pushes download progress by dispatching this on the main WebView.
      window.addEventListener('jflix-dl-event', h);
      return function () { window.removeEventListener('jflix-dl-event', h); };
    }
  };
})();
