const { contextBridge, ipcRenderer } = require('electron');

// @electron/remote is optional; never let a missing module break the whole preload
try {
  require('@electron/remote');
} catch (err) {
  // Optional dependency missing — only needed for remote-module features.
}

// Set a flag that ad scripts can read reliably even if the user agent is stripped
window.IS_ELECTRON_APP = true;

// Read the version passed from the main process via additionalArguments.
// Must be synchronous and cannot rely on require() because the preload runs sandboxed.
function getInstalledVersion() {
  try {
    const arg = (process.argv || []).find((a) => a.indexOf('--jflix-app-version=') === 0);
    if (arg) {
      const v = arg.split('=')[1];
      if (v) return v;
    }
  } catch (err) { /* ignore */ }
  try {
    const v = require('./package.json').version;
    if (v) return v;
  } catch (err) { /* ignore */ }
  return '0.0.0';
}

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),
  getAppVersion: () => getInstalledVersion(),
  isElectron: () => true,
  setFullScreen: (flag) => ipcRenderer.invoke('set-fullscreen', flag),
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen')
});

// ─── In-app downloads (Electron only) ─────────────────────────────────────
// Renderer-facing API used by the site's download buttons / Downloads page.
// start() returns once the download is queued; progress arrives via onEvent.
contextBridge.exposeInMainWorld('jflixDownloads', {
  isSupported: () => true,
  start: (payload) => ipcRenderer.invoke('dl:start', payload),
  list: () => ipcRenderer.invoke('dl:list'),
  cancel: (id) => ipcRenderer.invoke('dl:cancel', id),
  remove: (id) => ipcRenderer.invoke('dl:delete', id),
  openFolder: () => ipcRenderer.invoke('dl:folder'),
  onEvent: (callback) => {
    const listener = (_event, data) => {
      try { callback(data); } catch (err) { console.error('[Downloads] event callback error:', err); }
    };
    ipcRenderer.on('dl:event', listener);
    return () => ipcRenderer.removeListener('dl:event', listener);
  }
});
