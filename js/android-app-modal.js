// JFlix Android App Download Modal
// Version 2.1

(function() {
  'use strict';

  const APK_URL = 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix%201.4.4.apk';
  const APP_VERSION = '1.4.4';

  function isAndroidBrowser() {
    const ua = navigator.userAgent;
    // Must be Android
    if (!/Android/i.test(ua)) return false;
    // Must NOT already be in the JFlix native app
    if (/JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua)) return false;
    // Must NOT be JFlix-Android native app
    if (/JFlix-Android/i.test(ua)) return false;
    // Must NOT be Electron
    if (/Electron/i.test(ua)) return false;
    return true;
  }

  function isPremiumUser() {
    // Check if user has premium access
    try {
      const userStr = localStorage.getItem('jflix_user');
      if (!userStr) return false;
      const user = JSON.parse(userStr);
      const isPremium = user.subscriptionType === 'premium' || user.subscription_type === 'premium';
      const expiryDate = user.subscriptionExpiresAt || user.subscription_expires_at;
      const isExpired = expiryDate && new Date(expiryDate) < new Date();
      return isPremium && !isExpired;
    } catch (e) {
      return false;
    }
  }

  function createModal() {
    if (document.getElementById('android-app-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'android-app-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);padding:16px;box-sizing:border-box;';

    modal.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;max-width:420px;width:100%;padding:0;box-shadow:0 30px 100px rgba(0,0,0,0.7);border:2px solid rgba(61,220,151,0.3);overflow:hidden;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,rgba(61,220,151,0.15) 0%,rgba(61,220,151,0.05) 100%);padding:32px 28px 24px;text-align:center;border-bottom:1px solid rgba(61,220,151,0.15);">
          <img src="https://jflix.uk/images/icon-512x512.png" alt="JFlix" style="width:80px;height:80px;border-radius:20px;box-shadow:0 10px 30px rgba(61,220,151,0.4);margin-bottom:16px;">
          <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">JFlix Android App</div>
          <div style="color:#3ddc97;font-size:13px;font-weight:600;margin-top:4px;">v${APP_VERSION} • Ad-Free Experience</div>
        </div>

        <!-- Body -->
        <div style="padding:24px 28px;">

          <!-- Features -->
          <div style="margin-bottom:22px;">
            ${[
              ['🚫 Ads', 'Completely ad-free streaming'],
              ['⚡ Fast', 'Optimized native performance'],
              ['🔒 Secure', 'Safe & verified APK'],
            ].map(([icon, text]) => `
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="font-size:18px;">${icon}</span>
                <span style="color:#ccc;font-size:14px;">${text}</span>
              </div>`).join('')}
          </div>

          <!-- Download Button -->
          <a href="${APK_URL}" target="_blank" id="android-download-btn"
            style="display:flex;align-items:center;justify-content:center;gap:12px;background:linear-gradient(135deg,#3ddc97,#2ab87a);color:#000;text-decoration:none;font-size:16px;font-weight:800;padding:16px 24px;border-radius:14px;margin-bottom:12px;box-shadow:0 8px 24px rgba(61,220,151,0.4);transition:all 0.2s;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 32px rgba(61,220,151,0.5)';"
            onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 8px 24px rgba(61,220,151,0.4)';">
            <i class="fab fa-android" style="font-size:20px;"></i>
            Download APK — v${APP_VERSION}
          </a>

          <!-- Install Note -->
          <div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
            <div style="color:#FFD700;font-size:12px;font-weight:700;margin-bottom:4px;">⚠ Installation Note</div>
            <div style="color:#aaa;font-size:12px;line-height:1.5;">Enable <strong style="color:#fff;">Install unknown apps</strong> in your Android settings before installing.</div>
          </div>

          <!-- Continue in Browser -->
          <button onclick="document.getElementById('android-app-modal').remove();localStorage.setItem('jflix-android-modal-dismissed','true');"
            style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.15);color:#888;font-size:14px;padding:12px;border-radius:12px;cursor:pointer;transition:all 0.2s;"
            onmouseover="this.style.borderColor='rgba(255,255,255,0.3)';this.style.color='#fff';"
            onmouseout="this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='#888';">
            Continue in Browser
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  }

  function init() {
    if (localStorage.getItem('jflix-android-modal-dismissed') === 'true') return;
    if (!isAndroidBrowser()) return;
    // Don't show modal for premium users
    if (isPremiumUser()) {
      console.log('[Android Modal] User is premium, skipping download modal');
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(createModal, 1200));
    } else {
      setTimeout(createModal, 1200);
    }
  }

  // Auto-init disabled - modal only opens on button clicks (Android download, Get Premium, premium banner)
  // init();

  // Expose function to manually open modal (for button clicks)
  window.openAndroidAppModal = function() {
    if (localStorage.getItem('jflix-android-modal-dismissed') === 'true') {
      localStorage.removeItem('jflix-android-modal-dismissed');
    }
    if (!isAndroidBrowser()) {
      // If not on Android browser, show the download app modal instead
      if (typeof window.openDownloadAppModal === 'function') {
        window.openDownloadAppModal();
      }
      return;
    }
    if (isPremiumUser()) {
      console.log('[Android Modal] User is premium, skipping download modal');
      if (typeof window.openDownloadAppModal === 'function') {
        window.openDownloadAppModal();
      }
      return;
    }
    createModal();
  };

})();
