const { app, BrowserWindow, dialog, shell, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Never let a broken stdout/stderr pipe turn a console.log into a fatal crash.
// When the app is launched without a terminal (Finder/Dock) or the parent
// pipe closes, writes fail with EPIPE — and inside an event handler (e.g. a
// WebContents callback) that surfaces as an "Uncaught Exception" dialog.
// Swallowing stream errors makes those writes silent no-ops instead.
for (const stream of [process.stdout, process.stderr]) {
  try {
    stream.on('error', () => { /* broken pipe: drop log output */ });
  } catch (err) { /* ignore */ }
}

const downloadManager = require('./js/download-manager');

// Which web site the app loads. Priority:
//   1. JFLIX_APP_URL environment variable
//   2. <userData>/jflix-env.json  ->  { "url": "https://..." }  (switch packaged apps without rebuilding)
//   3. Staging site (jflixtesting.pages.dev) — production is https://jflix.uk
function resolveAppUrl() {
  if (process.env.JFLIX_APP_URL) return process.env.JFLIX_APP_URL;
  try {
    const envFile = path.join(app.getPath('userData'), 'jflix-env.json');
    if (fs.existsSync(envFile)) {
      const cfg = JSON.parse(fs.readFileSync(envFile, 'utf8'));
      if (cfg && typeof cfg.url === 'string' && /^https?:\/\//.test(cfg.url)) return cfg.url;
    }
  } catch (err) {
    console.error('[App] Failed to read jflix-env.json:', err.message);
  }
  return 'https://jflix.uk';
}

let mainWindow;

// ─── IPC: Open URL in external browser ───────────────────────────
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    console.log('[IPC] Opening external URL:', url);
    await shell.openExternal(url);
    return true;
  } catch (e) {
    console.error('[IPC] Failed to open external URL:', e);
    return false;
  }
});

// ─── IPC: Fullscreen control ─────────────────────────────────────
ipcMain.handle('set-fullscreen', async (event, flag) => {
  try {
    if (mainWindow) {
      mainWindow.setFullScreen(!!flag);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[IPC] Failed to set fullscreen:', e);
    return false;
  }
});

ipcMain.handle('is-fullscreen', async () => {
  try {
    if (mainWindow) {
      return mainWindow.isFullScreen();
    }
    return false;
  } catch (e) {
    return false;
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'JFlix',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
      // Sandbox-safe way to expose the real app version to the preload synchronously
      additionalArguments: ['--jflix-app-version=' + app.getVersion()]
    },
    autoHideMenuBar: true,
    frame: true
  });

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  // Block ad domains
  const filter = {
    urls: ['*://heavinessslight.com/*', '*://*.heavinessslight.com/*']
  };

  // Per-request logging would spam the console (and broken pipes) — log a few, then stay quiet.
  let adBlockLogCount = 0;
  session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
    if (adBlockLogCount < 5) {
      adBlockLogCount += 1;
      console.log('[Ad Blocked] Blocking ad request:', details.url);
      if (adBlockLogCount === 5) {
        console.log('[Ad Blocked] Further blocked ad requests will be silenced.');
      }
    }
    callback({ cancel: true });
  });

  console.log('[App] Loading URL:', resolveAppUrl());
  mainWindow.webContents.on('did-navigate', (_event, url) => {
    console.log('[App] Navigated to:', url);
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.log('[App] did-fail-load', code, desc, url);
  });
  mainWindow.loadURL(resolveAppUrl());

  // Block all modal dialogs (alert, confirm, prompt)
  mainWindow.webContents.on('dialog', (event) => {
    event.preventDefault();
  });

  // ─── Navigation Guard ──────────────────────────────────────────
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const currentUrl = mainWindow.webContents.getURL();
      const currentDomain = new URL(currentUrl).hostname;
      const newDomain = new URL(url).hostname;

      // Allow vidvault.ru as exception
      if (newDomain === 'vidvault.ru' || newDomain === 'www.vidvault.ru') {
        console.log('[Navigation Allowed] vidvault.ru exception:', url);
        return;
      }

      // Allow Google auth domains
      if (newDomain === 'accounts.google.com' || 
          newDomain === 'www.accounts.google.com' ||
          newDomain.endsWith('.google.com')) {
        console.log('[Navigation Allowed] Google auth exception:', url);
        return;
      }

      // Allow Supabase auth domains for OAuth callback
      if (newDomain === 'jflix.uk' ||
          newDomain.endsWith('.supabase.co')) {
        console.log('[Navigation Allowed] Supabase auth exception:', url);
        return;
      }

      // Prevent external navigation from replacing JFlix inside the Electron window;
      // open external destinations (including ad links) in default system browser.
      if (newDomain !== currentDomain) {
        event.preventDefault();
        console.log('[Navigation] Opening external destination in system browser:', url);
        shell.openExternal(url);
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // ─── Window Open Handler ───────────────────────────────────────
  mainWindow.webContents.setWindowOpenHandler(({ url, disposition }) => {
    try {
      const currentUrl = mainWindow.webContents.getURL();
      const currentDomain = new URL(currentUrl).hostname;
      const newDomain = new URL(url).hostname;

      // Allow vidvault.ru as exception - open in external browser
      if (newDomain === 'vidvault.ru' || newDomain === 'www.vidvault.ru') {
        console.log('[Navigation Allowed] vidvault.ru exception - opening externally:', url);
        shell.openExternal(url);
        return { action: 'deny' };
      }

      // Allow Google auth domains - open in Electron dialog
      if (newDomain === 'accounts.google.com' || 
          newDomain === 'www.accounts.google.com' ||
          newDomain.endsWith('.google.com')) {
        console.log('[Navigation Allowed] Google auth exception - opening in Electron dialog:', url);
        return { action: 'allow' };
      }

      // Allow Supabase auth domains for OAuth callback
      if (newDomain === 'jflix.uk' ||
          newDomain === 'www.jflix.uk' ||
          newDomain.endsWith('.supabase.co')) {
        console.log('[Navigation] Opening externally in browser:', url);
        shell.openExternal(url);
        return { action: 'deny' };
      }

      // Allow download links (from download modal) - open in external browser
      if (disposition === 'new-window' && url.includes('download')) {
        console.log('[Navigation Allowed] Download link - opening externally:', url);
        shell.openExternal(url);
        return { action: 'deny' };
      }

      // Open external links (ads, external destinations) in system browser
      if (newDomain !== currentDomain) {
        console.log('[Window Open] External link - opening in system browser:', url);
        shell.openExternal(url);
        return { action: 'deny' };
      }

      return { action: 'allow' };
    } catch (e) {
      return { action: 'deny' };
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // In-app downloads (HLS/MP4 capture + ffmpeg remux, private to the app)
  downloadManager.init({ getMainWindow: () => mainWindow });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Extra safety: block any web-contents navigation
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        event.preventDefault();
      }
    } catch (e) {
      event.preventDefault();
    }
  });
});
