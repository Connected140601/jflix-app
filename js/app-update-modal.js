// JFlix App Update Modal
// Forces update overlay when installed app version is outdated
// Version 1.0

(function() {
  'use strict';

  // Get latest version from download-app-modal.js (single source of truth)
  const LATEST_VERSION = window.JFLIX_LATEST_APP_VERSION || '1.4.1';
  const DOWNLOAD_URLS = window.JFLIX_DOWNLOAD_URLS || {
    macSilicon: 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-1.4.1-arm64.pkg',
    macIntel: 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-1.4.1-x64.pkg',
    winSetup: 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-Setup-1.4.1.exe',
    winPortable: 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-1.4.1-Portable.exe',
    android: 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix%201.4.4.apk'
  };

  // ── Version comparison ──────────────────────────────────────────────────────
  function parseVersion(v) {
    return (v || '0.0.0').split('.').map(Number);
  }

  function isOutdated(installedVersion) {
    if (!installedVersion || installedVersion === '0.0.0') {
      // If no version detected (or detection returned the 0.0.0 fallback) assume it's
      // latest. Prevents the forced update overlay from locking the app on false positives.
      console.log('[App Update Modal] No reliable version detected, assuming latest version to avoid false positive');
      return false;
    }
    const [ma, mi, pa] = parseVersion(installedVersion);
    const [lma, lmi, lpa] = parseVersion(LATEST_VERSION);
    
    console.log('[App Update Modal] Version comparison:', {
      installed: { major: ma, minor: mi, patch: pa },
      latest: { major: lma, minor: lmi, patch: lpa },
      installedString: installedVersion,
      latestString: LATEST_VERSION
    });
    
    if (ma !== lma) return ma < lma;
    if (mi !== lmi) return mi < lmi;
    return pa < lpa;
  }

  // ── Platform detection ──────────────────────────────────────────────────────
  function getOS() {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua) || (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS/i.test(ua)) {
      // Try to detect Silicon vs Intel
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            const r = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
            if (/Apple M|Apple GPU/i.test(r)) return 'mac-silicon';
          }
        }
      } catch(e) {}
      return 'mac-intel';
    }
    return 'unknown';
  }

  function isNativeApp() {
    const ua = navigator.userAgent;
    const isElectron = ua.includes('Electron') || (window.electronAPI && typeof window.electronAPI.isElectron === 'function' && window.electronAPI.isElectron());
    const isAndroid  = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua) ||
                       /JFlix-Android/i.test(ua) ||
                       (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID);
    return isElectron || isAndroid;
  }

  // ── Build download rows ─────────────────────────────────────────────────────
  function buildDownloadButtons(os) {
    const btn = (url, icon, label, sub, color) => `
      <div data-url="${url}"
        style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04));border:1px solid rgba(255,215,0,0.3);border-radius:16px;padding:18px 20px;margin-bottom:12px;transition:all 0.2s;box-shadow:0 4px 16px rgba(0,0,0,0.3);cursor:pointer;"
        onmouseover="this.style.background='linear-gradient(135deg,rgba(255,215,0,0.15),rgba(255,215,0,0.08))';this.style.borderColor='rgba(255,215,0,0.6)';this.style.transform='translateY(-2px)';"
        onmouseout="this.style.background='linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))';this.style.borderColor='rgba(255,215,0,0.3)';this.style.transform='translateY(0)';"
        onclick="navigator.clipboard.writeText(this.getAttribute('data-url')).then(() => { const badge = this.querySelector('.copy-badge'); badge.textContent = 'COPIED!'; setTimeout(() => badge.textContent = 'COPY', 2000); });">
        <div style="width:48px;height:48px;border-radius:14px;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="${icon}" style="font-size:22px;color:#fff;"></i>
        </div>
        <div style="flex:1;">
          <div style="color:#fff;font-size:15px;font-weight:700;">${label}</div>
          <div style="color:#aaa;font-size:12px;margin-top:3px;">${sub}</div>
        </div>
        <div class="copy-badge" style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#000;font-size:12px;font-weight:800;padding:8px 14px;border-radius:10px;flex-shrink:0;">
          COPY
        </div>
      </div>`;

    if (os === 'android') {
      return btn(DOWNLOAD_URLS.android, 'fab fa-android', 'Android APK', `v${LATEST_VERSION} • Ad-Free`, 'linear-gradient(135deg,#3ddc97,#2ab87a)');
    }
    if (os === 'windows') {
      return btn(DOWNLOAD_URLS.winSetup,    'fab fa-windows', 'Windows Setup',    `v${LATEST_VERSION} • Installer (.exe) — Recommended`, 'linear-gradient(135deg,#0078d4,#005a9e)') +
             btn(DOWNLOAD_URLS.winPortable, 'fab fa-windows', 'Windows Portable', `v${LATEST_VERSION} • No installation needed`,          'linear-gradient(135deg,#0078d4,#005a9e)');
    }
    if (os === 'mac-silicon') {
      return btn(DOWNLOAD_URLS.macSilicon, 'fab fa-apple', 'macOS Silicon',        `v${LATEST_VERSION} • M1/M2/M3/M4/M5 (.pkg)`, 'linear-gradient(135deg,#555,#333)') +
             btn(DOWNLOAD_URLS.macIntel,   'fab fa-apple', 'macOS Intel (also works on Silicon)', `v${LATEST_VERSION} • x64 (.pkg)`, 'linear-gradient(135deg,#555,#333)');
    }
    // mac-intel or unknown
    return btn(DOWNLOAD_URLS.macSilicon, 'fab fa-apple', 'macOS Silicon', `v${LATEST_VERSION} • M1/M2/M3/M4/M5 (.pkg)`, 'linear-gradient(135deg,#555,#333)') +
           btn(DOWNLOAD_URLS.macIntel,   'fab fa-apple', 'macOS Intel',   `v${LATEST_VERSION} • x64 (.pkg)`,            'linear-gradient(135deg,#555,#333)') +
           btn(DOWNLOAD_URLS.winSetup,    'fab fa-windows', 'Windows Setup',    `v${LATEST_VERSION} • Installer (.exe)`, 'linear-gradient(135deg,#0078d4,#005a9e)') +
           btn(DOWNLOAD_URLS.winPortable, 'fab fa-windows', 'Windows Portable', `v${LATEST_VERSION} • No install needed`, 'linear-gradient(135deg,#0078d4,#005a9e)') +
           btn(DOWNLOAD_URLS.android,     'fab fa-android',  'Android APK',      `v${LATEST_VERSION} • Ad-Free`,          'linear-gradient(135deg,#3ddc97,#2ab87a)');
  }

  // ── Create forced update overlay ────────────────────────────────────────────
  function showUpdateModal(installedVersion, os) {
    if (document.getElementById('jflix-update-modal')) return;

    const noVersionDetected = !installedVersion;
    const title    = noVersionDetected ? 'App Update Required' : 'New Version Available!';
    const subtitle = noVersionDetected
      ? 'Your app version could not be detected. Copy the link below and paste it in your browser to download the latest version.'
      : `You are using v${installedVersion}. Copy the link below and paste it in your browser to download v${LATEST_VERSION}.`;

    const overlay = document.createElement('div');
    overlay.id = 'jflix-update-modal';
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.97)',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'backdrop-filter:blur(16px)',
      '-webkit-backdrop-filter:blur(16px)',
      'padding:16px',
      'box-sizing:border-box',
      'overflow-y:auto'
    ].join(';');

    // Block all keyboard shortcuts
    overlay.addEventListener('keydown', e => e.stopPropagation(), true);

    overlay.innerHTML = `
      <div style="background:linear-gradient(135deg,#0f0f1a,#1a1a2e);border-radius:24px;max-width:520px;width:100%;padding:0;box-shadow:0 40px 120px rgba(0,0,0,0.8);border:2px solid rgba(229,9,20,0.4);overflow:hidden;my:16px;">

        <!-- Top Banner -->
        <div style="background:linear-gradient(135deg,rgba(229,9,20,0.3),rgba(229,9,20,0.1));padding:28px;text-align:center;border-bottom:1px solid rgba(229,9,20,0.2);">
          <div style="width:64px;height:64px;background:linear-gradient(135deg,#e50914,#b0060f);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
            <i class="fas fa-arrow-up" style="color:#fff;font-size:26px;"></i>
          </div>
          <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;">${title}</div>
          <div style="color:#aaa;font-size:14px;line-height:1.5;">${subtitle}</div>
        </div>

        <!-- Version Badge -->
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:18px 28px;border-bottom:1px solid rgba(255,255,255,0.06);">
          ${installedVersion ? `
            <div style="text-align:center;">
              <div style="color:#e50914;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Installed</div>
              <div style="color:#fff;font-size:18px;font-weight:800;">v${installedVersion}</div>
            </div>
            <div style="color:#555;font-size:24px;">→</div>
          ` : ''}
          <div style="text-align:center;">
            <div style="color:#FFD700;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Latest</div>
            <div style="color:#FFD700;font-size:18px;font-weight:800;">v${LATEST_VERSION}</div>
          </div>
        </div>

        <!-- What's new -->
        <div style="padding:16px 28px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(255,215,0,0.04);">
          <div style="color:#FFD700;font-size:12px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">What's New in v${LATEST_VERSION}</div>
          ${['App version detection', 'Ad-free native experience', 'Performance improvements', 'Security updates'].map(f =>
            `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <i class="fas fa-check-circle" style="color:#3ddc97;font-size:13px;flex-shrink:0;"></i>
              <span style="color:#ccc;font-size:13px;">${f}</span>
            </div>`).join('')}
        </div>

        <!-- Important Installation Warning -->
        <div style="padding:16px 28px;border-bottom:1px solid rgba(255,0,0,0.3);background:rgba(255,0,0,0.1);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <i class="fas fa-exclamation-triangle" style="color:#FF4444;font-size:18px;flex-shrink:0;"></i>
            <div style="color:#FF4444;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">IMPORTANT: Before Installing</div>
          </div>
          <div style="color:#fff;font-size:13px;line-height:1.5;padding-left:28px;">
            <strong style="color:#FF4444;">Please UNINSTALL the old JFlix application first</strong> before installing the new version to avoid conflicts and ensure a clean installation.
          </div>
        </div>

        <!-- Download Buttons -->
        <div style="padding:20px 28px 24px;">
          <div style="color:#fff;font-size:13px;font-weight:700;margin-bottom:14px;text-transform:uppercase;letter-spacing:1px;">Copy Download Link</div>
          ${buildDownloadButtons(os)}
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    // Prevent scrolling on body
    document.body.style.overflow = 'hidden';
  }

  // ── Main init ───────────────────────────────────────────────────────────────
  function init() {
    console.log('[App Update Modal] Init called');
    console.log('[App Update Modal] isNativeApp():', isNativeApp());

    if (!isNativeApp()) {
      console.log('[App Update Modal] Not a native app, skipping');
      return; // Only runs inside Electron or Android APK
    }

    // iOS wrapper: this modal only offers desktop (macOS/Windows) downloads,
    // and iPhone UAs misdetect as Mac — never nag inside the iOS app.
    // (iOS updates ship as new IPAs via GitHub releases, not this modal.)
    var uaNow = '';
    try { uaNow = navigator.userAgent || ''; } catch (e) {}
    var isIOSWrapper = /JFlix-iOS/i.test(uaNow) ||
      (typeof window.IS_IOS_APP !== 'undefined' && window.IS_IOS_APP === true);
    if (isIOSWrapper) {
      console.log('[App Update Modal] iOS wrapper detected — desktop updater disabled');
      return;
    }

    const appInfo = window.JFlixAppInfo || null;
    const installedVersion = appInfo ? appInfo.version : null;

    console.log('[App Update Modal] Debug:');
    console.log('  isNativeApp:', isNativeApp());
    console.log('  appInfo:', appInfo);
    console.log('  installedVersion:', installedVersion);
    console.log('  latestVersion:', LATEST_VERSION);
    console.log('  isOutdated:', isOutdated(installedVersion));

    if (isOutdated(installedVersion)) {
      console.log('[App Update Modal] App is outdated, showing update modal');
      const os = getOS();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => showUpdateModal(installedVersion, os));
      } else {
        showUpdateModal(installedVersion, os);
      }
    } else {
      console.log('[App Update Modal] App is up to date or no version detected');
    }
  }

  // Wait for app-version-detector.js to finish first
  window.addEventListener('jflixAppInfoReady', init);

  // Fallback: run after DOM if event already fired
  if (document.readyState !== 'loading') {
    setTimeout(init, 300);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 300));
  }

})();
