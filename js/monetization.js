/**
 * JFlix Monetization System
 * Web Browser: Get Premium button + Download App modal
 * Electron: Sign-in gate + Premium-only access
 * Android Web Browser: Sign-in gate + Premium-only access (same as Electron)
 * Localhost: Sign-in gate + Premium-only access (same as Electron)
 * Version 2.0 - Enhanced error handling and validation
 */

(function () {
  'use strict';

  // Native app detection (Electron, Android WebView, or iOS native app wrapper)
  // These are the ONLY platforms that should enforce premium auth
  const IS_ELECTRON = navigator.userAgent.includes('Electron');
  const IS_ANDROID_WEBVIEW = (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID) ||
                             /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                             /JFlix-Android/i.test(navigator.userAgent) ||
                             localStorage.getItem('jflix_is_android') === 'true';
  const IS_IOS_NATIVE = (typeof window.IS_IOS_APP !== 'undefined' && window.IS_IOS_APP === true) ||
                        (typeof window.IS_IOS_NATIVE !== 'undefined' && window.IS_IOS_NATIVE === true) ||
                        /JFlix-iOS/i.test(navigator.userAgent) ||
                        (/JFlixNativeApp/i.test(navigator.userAgent) && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ||
                        (document.documentElement && document.documentElement.classList.contains('is-ios-app'));
  const IS_NATIVE_APP = IS_ELECTRON || IS_ANDROID_WEBVIEW || IS_IOS_NATIVE;

  // iOS/iPad PWA mode detection (standalone display mode on iOS devices)
  const IS_IOS_PWA = (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) &&
                     (/iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent))) &&
                     !IS_IOS_NATIVE;

  // In-app browser detection (Facebook, Messenger, Twitter, TikTok, Instagram)
  const IS_IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBMessenger|Twitter|TikTok|Instagram/i.test(navigator.userAgent);

  // System browser detection (all browsers: Chrome, Firefox, Safari, Edge, etc.)
  // These should show Get Premium button and ads/premium banners
  const IS_SYSTEM_BROWSER = !IS_NATIVE_APP && !IS_IOS_PWA;

  // Localhost detection (for development)
  const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Combined detection: premium auth only in native apps and localhost
  // iOS PWA gets web browser treatment — full access with Get Premium button
  const SHOULD_ENFORCE_PREMIUM_AUTH = (IS_NATIVE_APP || IS_LOCALHOST) && !IS_IOS_PWA;

  // ── STRICT: Block web browsers and in-app browsers from accessing monetization.js ─
  // Only allow: Electron, Android app, iOS PWA mode, and localhost
  if ((!IS_NATIVE_APP && !IS_LOCALHOST && !IS_IOS_PWA) || IS_IN_APP_BROWSER) {
    console.warn('[Monetization] Access denied: monetization.js is only accessible in Electron, Android app, or iOS PWA');
    // Stop execution here for web browsers and in-app browsers
    return;
  }

  // iOS PWA: Set up web-like experience with Get Premium button
  if (IS_IOS_PWA) {
    console.log('[Monetization] iOS PWA mode detected — setting up Get Premium button');
  }

  const R2_BASE = 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev';
  const DOWNLOAD_URLS = {
    windowsSetup: `${R2_BASE}/JFlix-Setup-1.4.0.exe`,
    windowsPortable: `${R2_BASE}/JFlix-1.4.0-Portable.exe`,
    macSilicon: `${R2_BASE}/JFlix-1.4.0-arm64.pkg`,
    macIntel: `${R2_BASE}/JFlix-1.4.0-x64.pkg`,
    android: `${R2_BASE}/JFlix%201.4.0.apk`
  };

  // ─── Device Detection ─────────────────────────────────────────────────────

  function isIOS() {
    const ua = navigator.userAgent;
    return /iPhone|iPod/i.test(ua) ||
      (/iPad/i.test(ua)) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua) && !IS_ELECTRON);
  }

  function isIPad() {
    return /iPad/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent) && !IS_ELECTRON);
  }

  function isMacOS() {
    const ua = navigator.userAgent;
    return /Macintosh/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua) && !IS_ELECTRON;
  }

  function isWindows() {
    return navigator.userAgent.includes('Windows');
  }

  function isWindowsX64() {
    return navigator.userAgent.includes('Windows') && 
           (navigator.userAgent.includes('WOW64') || 
            navigator.userAgent.includes('Win64') || 
            navigator.userAgent.includes('x64'));
  }

  function isWindowsX86() {
    return navigator.userAgent.includes('Windows') && !isWindowsX64();
  }

  function isMacOSSilicon() {
    return /Macintosh/i.test(navigator.userAgent) && 
           /arm64|aarch64/i.test(navigator.userAgent);
  }

  function isMacOSIntel() {
    return /Macintosh/i.test(navigator.userAgent) && 
           !/arm64|aarch64/i.test(navigator.userAgent);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent) && !/Windows/i.test(navigator.userAgent);
  }

  function isMobile() {
    return isIOS() || isAndroid() || /Mobile/i.test(navigator.userAgent);
  }

  // ─── Currency & Location Detection ──────────────────────────────────────────

  // Fixed pricing based on location
  const PRICING = {
    PH: {
      currency: 'PHP',
      symbol: '₱',
      plans: {
        '30days': 68,
        '15days': 46,
        '7days': 33
      }
    },
    default: {
      currency: 'USD',
      symbol: '$',
      plans: {
        '30days': 1.15,
        '15days': 0.79,
        '7days': 0.58
      }
    }
  };

  // Get pricing for user's location
  function getPricing() {
    const country = detectUserCountry();
    return PRICING[country] || PRICING.default;
  }

  // Get local price for a specific plan
  function getLocalPrice(plan = '30days') {
    const pricing = getPricing();
    const price = pricing.plans[plan] || pricing.plans['30days'];
    return {
      symbol: pricing.symbol,
      price: price,
      currency: pricing.currency
    };
  }

  // Legacy function for backward compatibility
  function convertPriceToLocal(pricePHP) {
    const pricing = getPricing();
    return {
      symbol: pricing.symbol,
      price: pricing.plans['30days'],
      currency: pricing.currency
    };
  }

  // Detect user's country from timezone or language
  function detectUserCountry() {
    try {
      // Try timezone first
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) {
        const tzMap = {
          'Asia/Manila': 'PH',
          'Asia/Tokyo': 'JP',
          'Asia/Seoul': 'KR',
          'Asia/Shanghai': 'CN',
          'Asia/Hong_Kong': 'HK',
          'Asia/Singapore': 'SG',
          'Asia/Kuala_Lumpur': 'MY',
          'Asia/Jakarta': 'ID',
          'Asia/Bangkok': 'TH',
          'Asia/Ho_Chi_Minh': 'VN',
          'Asia/Dubai': 'AE',
          'Asia/Riyadh': 'SA',
          'Asia/Cairo': 'EG',
          'Africa/Lagos': 'NG',
          'Africa/Johannesburg': 'ZA',
          'Africa/Nairobi': 'KE',
          'Europe/London': 'GB',
          'Europe/Paris': 'EU',
          'Europe/Berlin': 'EU',
          'Europe/Rome': 'EU',
          'Europe/Madrid': 'EU',
          'Europe/Amsterdam': 'EU',
          'America/New_York': 'US',
          'America/Los_Angeles': 'US',
          'America/Chicago': 'US',
          'America/Toronto': 'CA',
          'Australia/Sydney': 'AU',
          'America/Sao_Paulo': 'BR',
          'America/Mexico_City': 'MX',
          'Asia/Kolkata': 'IN'
        };
        
        for (const [tz, country] of Object.entries(tzMap)) {
          if (timezone.includes(tz)) {
            return country;
          }
        }
      }
      
      // Fallback to language
      const lang = navigator.language || navigator.userLanguage;
      if (lang) {
        const langMap = {
          'en-US': 'US',
          'en-GB': 'GB',
          'en-AU': 'AU',
          'en-CA': 'CA',
          'ja': 'JP',
          'ko': 'KR',
          'zh': 'CN',
          'zh-HK': 'HK',
          'zh-TW': 'TW',
          'es': 'MX',
          'pt-BR': 'BR',
          'fr': 'EU',
          'de': 'EU',
          'it': 'EU',
          'es-ES': 'EU',
          'nl': 'EU',
          'sv': 'EU',
          'no': 'EU',
          'da': 'EU',
          'fi': 'EU',
          'pl': 'EU',
          'ru': 'RU',
          'ar': 'SA',
          'hi': 'IN',
          'th': 'TH',
          'vi': 'VN',
          'id': 'ID',
          'ms': 'MY',
          'tl': 'PH',
          'fil': 'PH'
        };
        
        for (const [l, country] of Object.entries(langMap)) {
          if (lang.startsWith(l)) {
            return country;
          }
        }
      }
    } catch (e) {
      console.error('Error detecting country:', e);
    }
    
    return 'default';
  }

  // Update premium banner prices
  function updatePremiumBannerPrices() {
    const localPrice = getLocalPrice('30days');
    const priceElements = document.querySelectorAll('.premium-banner-price');
    
    priceElements.forEach(function(el) {
      el.innerHTML = localPrice.symbol + localPrice.price;
    });
  }

  // Expose currency functions for use by other modules
  window.JFlixCurrency = {
    getLocalPrice: getLocalPrice,
    getPricing: getPricing,
    detectUserCountry: detectUserCountry
  };

  // ─── USER HELPERS ─────────────────────────────────────────────────────────

  function waitForAuth(cb, tries) {
    tries = tries || 0;
    if (typeof jflixAuth !== 'undefined') { cb(); return; }
    if (tries > 50) return;
    setTimeout(function () { waitForAuth(cb, tries + 1); }, 100);
  }

  function isPremiumActive(user) {
    if (!user) return false;
    try {
      const isPrem = user.subscriptionType === 'premium' || user.subscription_type === 'premium';
      const expiry = user.subscriptionExpiresAt || user.subscription_expires_at;
      const expired = expiry && new Date(expiry) < new Date();

      return isPrem && !expired;
    } catch (e) {
      console.error('[Monetization] Error checking premium status:', e);
      return false;
    }
  }

  // ─── WEB BROWSER: NAVBAR GET PREMIUM BUTTON ───────────────────────────────

  function setupWebBrowserNavbar() {
    if (SHOULD_ENFORCE_PREMIUM_AUTH || IS_NATIVE_APP || IS_IOS_NATIVE) return;

    function inject() {
      const navbarRight = document.querySelector('.navbar-right');
      if (!navbarRight) return;

      // Always hide auth UI in web browser
      const authBtns = navbarRight.querySelector('.auth-buttons');
      const userMenu = navbarRight.querySelector('.user-menu');
      if (authBtns) authBtns.style.cssText = 'display:none!important';
      if (userMenu) userMenu.style.cssText = 'display:none!important';

      if (navbarRight.querySelector('#web-get-premium-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'web-get-premium-btn';
      btn.className = 'get-premium-btn';
      btn.innerHTML = '<i class="fas fa-crown" style="margin-right:6px;"></i>Get Premium';
      btn.style.cssText = [
        'background:linear-gradient(135deg,#FFD700,#FFA500)',
        'color:#1a0a00',
        'border:none',
        'padding:8px 16px',
        'border-radius:20px',
        'font-size:12px',
        'font-weight:800',
        'cursor:pointer',
        'display:flex',
        'align-items:center',
        'letter-spacing:.3px',
        'box-shadow:0 2px 10px rgba(255,180,0,.4)',
        'white-space:nowrap',
        'flex-shrink:0',
        'transition:all .2s',
        'margin-left:15px'
      ].join(';');
      btn.onmouseover = function () {
        this.style.transform = 'scale(1.07)';
        this.style.boxShadow = '0 4px 16px rgba(255,180,0,.6)';
      };
      btn.onmouseout = function () {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 2px 10px rgba(255,180,0,.4)';
      };
      btn.onclick = function() { if (window.openDownloadAppModalUser) { window.openDownloadAppModalUser(); } else { openDownloadAppModal(); } };
      navbarRight.appendChild(btn);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }

    // Ensure auth UI stays hidden after auth.js updateAuthUI calls
    document.addEventListener('DOMContentLoaded', function () {
      var observer = new MutationObserver(function () {
        var authBtns = document.querySelectorAll('.auth-buttons');
        var userMenus = document.querySelectorAll('.user-menu');
        authBtns.forEach(function (el) { if (el.style.display !== 'none') el.style.display = 'none'; });
        userMenus.forEach(function (el) { if (el.style.display !== 'none') el.style.display = 'none'; });
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    });
  }

  // ─── WEB BROWSER: DOWNLOAD APP MODAL ROUTER ────────────────────────────────

  window.openDownloadAppModal = function () {
    // Native apps and iOS: skip modal entirely — users browse directly without install prompt
    if (IS_NATIVE_APP || IS_IOS_NATIVE || isIOS()) return;

    // Bypass modal if user clicked "Watch for Free" within last 24 hours
    try {
      var ts = localStorage.getItem('jflix_watch_free_timestamp');
      if (ts) {
        var hoursElapsed = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60);
        if (hoursElapsed < 24) return;
      }
    } catch (e) {}
    
    // Call the download modal function directly
    var existing = document.getElementById('jflix-download-premium-modal');
    if (existing) { existing.style.display = 'flex'; return; }

    var mac = isMacOS();
    var win = isWindows();
    var android = isAndroid();
    var winX64 = isWindowsX64();
    var winX86 = isWindowsX86();
    var macSilicon = isMacOSSilicon();
    var macIntel = isMacOSIntel();
    
    // Get local price
    var localPrice = getLocalPrice();
      var priceDisplay = localPrice ? localPrice.formatted : '$0.99';
      
      var modal = document.createElement('div');
      modal.id = 'jflix-download-premium-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:1000000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);padding:16px;box-sizing:border-box;';
      
      modal.innerHTML = [
        '<div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;max-width:900px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 40px 120px rgba(0,0,0,0.8);border:2px solid rgba(255,215,0,0.3);display:flex;flex-direction:row;overflow:hidden;">',
        
        // Left side - Premium info
        '<div style="background:linear-gradient(180deg,rgba(255,215,0,.08) 0%,rgba(255,215,0,.02) 100%);padding:40px 32px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-right:1px solid rgba(255,215,0,.1);flex:0 0 320px;">',
          '<div style="width:100px;height:100px;background:linear-gradient(135deg,#FFD700 0%,#FFA500 50%,#FF8C00 100%);border-radius:28px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 20px 50px rgba(255,180,0,.5),0 0 0 4px rgba(255,215,0,.2);"><i class="fas fa-crown" style="color:#1a0a00;font-size:42px;"></i></div>',
          '<h2 style="color:#fff;margin:0 0 8px;font-size:28px;font-weight:800;letter-spacing:-0.5px;">JFlix Premium</h2>',
          '<p style="color:#aaa;margin:0 0 20px;font-size:14px;line-height:1.6;">Unlock the ultimate streaming experience</p>',
          '<div style="background:linear-gradient(135deg,rgba(255,215,0,.15) 0%,rgba(255,215,0,.05) 100%);border:2px solid rgba(255,215,0,.3);border-radius:16px;padding:16px 28px;"><span style="color:#FFD700;font-size:28px;font-weight:800;letter-spacing:-0.5px;">For as low as ' + priceDisplay + ' only</span></div>',
          '<div style="margin-top:32px;display:flex;flex-direction:column;gap:12px;width:100%;">',
            '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-ban" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">100% No Ads</span></div>',
            '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-infinity" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">Unlimited Streaming</span></div>',
            '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-hd" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">HD Quality</span></div>',
            '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-download" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">Download Movies</span></div>',
          '</div>',
        '</div>',
        
        // Right side - Download options
        '<div style="padding:32px 36px;display:flex;flex-direction:column;flex:1;">',
          '<div style="margin-bottom:24px;"><div style="color:#fff;font-size:18px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:10px;"><i class="fas fa-download" style="color:#FFD700;"></i><span>Download for Your Device</span></div><div style="color:#666;font-size:13px;">Select your platform to get started</div></div>',
          '<div style="display:flex;flex-direction:column;gap:12px;flex:1;">',
            // macOS Silicon
            (macSilicon ? '<a href="https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-1.4.0-arm64.pkg" target="_blank" style="text-decoration: none; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%); border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 16px 18px; transition: 0.3s; cursor: pointer; box-shadow: rgba(255, 215, 0, 0.15) 0px 8px 24px;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';"><div style="width:48px;height:48px;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);"><i class="fab fa-apple" style="color:#fff;font-size:22px;"></i></div><div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:700;">macOS Silicon (M1/M2/M3/M4/M5)</div><div style="color:#888;font-size:12px;margin-top:2px;">Installer (.pkg) — v1.4.0</div><div style="color:#666;font-size:10px;margin-top:3px;">Right-click PKG → Open, then enter password</div></div></a>' : ''),
            // macOS Intel
            (macIntel ? '<a href="https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-1.4.0-x64.pkg" target="_blank" style="text-decoration: none; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%); border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 16px 18px; transition: 0.3s; cursor: pointer; box-shadow: rgba(255, 215, 0, 0.15) 0px 8px 24px;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';"><div style="width:48px;height:48px;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);"><i class="fab fa-apple" style="color:#fff;font-size:22px;"></i></div><div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:700;">macOS Intel</div><div style="color:#888;font-size:12px;margin-top:2px;">Installer (.pkg) — v1.4.0</div><div style="color:#666;font-size:10px;margin-top:3px;">Right-click PKG → Open, then enter password</div></div></a>' : ''),
            // Windows x64
            (winX64 ? '<a href="https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-Setup-1.4.0.exe" target="_blank" style="text-decoration: none; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%); border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 16px 18px; transition: 0.3s; cursor: pointer; box-shadow: rgba(255, 215, 0, 0.15) 0px 8px 24px;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';"><div style="width:48px;height:48px;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);"><i class="fab fa-windows" style="color:#fff;font-size:22px;"></i></div><div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:700;">Windows (64-bit)</div><div style="color:#888;font-size:12px;margin-top:2px;">Installer (.exe) — v1.4.0</div><div style="color:#666;font-size:10px;margin-top:3px;">Run installer and follow prompts</div></div></a>' : ''),
            // Windows x86
            (winX86 ? '<a href="https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix-Setup-1.4.0.exe" target="_blank" style="text-decoration: none; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%); border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 16px 18px; transition: 0.3s; cursor: pointer; box-shadow: rgba(255, 215, 0, 0.15) 0px 8px 24px;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';"><div style="width:48px;height:48px;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);"><i class="fab fa-windows" style="color:#fff;font-size:22px;"></i></div><div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:700;">Windows (32-bit)</div><div style="color:#888;font-size:12px;margin-top:2px;">Installer (.exe) — v1.4.0</div><div style="color:#666;font-size:10px;margin-top:3px;">Run installer and follow prompts</div></div></a>' : ''),
            // Android
            (android ? '<a href="https://pub-200cfe5effe94692ae21875b18599cee.r2.dev/JFlix%201.4.0.apk" target="_blank" style="text-decoration: none; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.06) 100%); border: 2px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 16px 18px; transition: 0.3s; cursor: pointer; box-shadow: rgba(255, 215, 0, 0.15) 0px 8px 24px;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';"><div style="width:48px;height:48px;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);"><i class="fab fa-android" style="color:#fff;font-size:22px;"></i></div><div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:700;">Android</div><div style="color:#888;font-size:12px;margin-top:2px;">APK — v1.4.0</div><div style="color:#666;font-size:10px;margin-top:3px;">Enable "Install unknown apps" in settings</div></div></a>' : ''),
            // Fallback for unknown platform
            (!mac && !win && !android ? '<div style="text-align:center;padding:20px;color:#888;"><i class="fas fa-desktop" style="font-size:32px;margin-bottom:12px;"></i><div style="font-size:14px;">Platform not detected</div><div style="font-size:12px;margin-top:8px;">Please visit on a supported device</div></div>' : ''),
          '</div>',
          // Watch for Free button
          '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,.08);">',
            '<button id="watch-for-free-btn" style="width:100%;background:linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.08));border:2px solid rgba(46,204,113,.4);color:#2ecc71;padding:16px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .3s ease;box-shadow:0 4px 16px rgba(46,204,113,.15);" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(46,204,113,.25),rgba(46,204,113,.15))\';this.style.borderColor=\'rgba(46,204,113,.6)\';this.style.boxShadow=\'0 6px 20px rgba(46,204,113,.25)\';this.style.transform=\'translateY(-1px)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.08))\';this.style.borderColor=\'rgba(46,204,113,.4)\';this.style.boxShadow=\'0 4px 16px rgba(46,204,113,.15)\';this.style.transform=\'none\';">',
              '<i class="fas fa-play-circle" style="font-size:20px;"></i>',
              '<span>Watch for Free (with Ads)</span>',
            '</button>',
            '<div style="color:#666;font-size:11px;text-align:center;margin-top:8px;line-height:1.4;">Click to continue watching with ads. Modal will reappear after 24 hours.</div>',
          '</div>',
        '</div>',
        
        '</div>'
      ].join('');

      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.style.display = 'none';
      });
      
      // Handle Watch for Free button click
      var watchFreeBtn = modal.querySelector('#watch-for-free-btn');
      if (watchFreeBtn) {
        watchFreeBtn.addEventListener('click', function() {
          try {
            localStorage.setItem('jflix_watch_free_timestamp', Date.now().toString());
          } catch (e) {}
          modal.style.display = 'none';
        });
      }
      
      document.body.appendChild(modal);
  };

  // ─── WEB BROWSER: iOS PREMIUM MODAL ────────────────────────────────────────

  function openIOSPremiumModal() {
    // Native apps and iOS wrapper: never show download / not-supported modal
    if (IS_NATIVE_APP || IS_IOS_NATIVE) return;

    var existing = document.getElementById('jflix-ios-premium-modal');
    if (existing) { existing.style.display = 'flex'; return; }

    var deviceName = isIPad() ? 'iPad' : 'iPhone';
    var modal = document.createElement('div');
    modal.id = 'jflix-ios-premium-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:16px;box-sizing:border-box;';

    modal.innerHTML = [
      '<div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 100%);border-radius:22px;width:100%;max-width:420px;max-height:92vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,.7);border:1.5px solid rgba(229,9,20,.3);position:relative;">',

        // Gold stripe
        '<div style="height:4px;background:linear-gradient(90deg,#b8860b,#FFD700 40%,#fff8c4 55%,#FFD700 70%,#b8860b);border-radius:22px 22px 0 0;"></div>',

        // Close button
        '<button onclick="document.getElementById(\'jflix-ios-premium-modal\').style.display=\'none\'"',
        ' style="position:absolute;top:14px;right:14px;width:32px;height:32px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#888;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:all .2s;line-height:1;"',
        ' onmouseover="this.style.background=\'rgba(229,9,20,.3)\';this.style.color=\'#fff\';"',
        ' onmouseout="this.style.background=\'rgba(255,255,255,.08)\';this.style.color=\'#888\';">&times;</button>',

        // Header
        '<div style="text-align:center;padding:28px 24px 18px;border-bottom:1px solid rgba(229,9,20,.15);">',
          '<div style="width:64px;height:64px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:0 8px 24px rgba(255,180,0,.4);">',
            '<i class="fas fa-crown" style="color:#1a0a00;font-size:26px;"></i>',
          '</div>',
          '<h2 style="color:#fff;margin:0 0 4px;font-size:20px;font-weight:800;">Get Premium Access</h2>',
          '<p style="color:#888;margin:0;font-size:12px;">JFlix Premium — No Ads · Unlimited Streaming</p>',
        '</div>',

        // Body
        '<div style="padding:18px 20px 22px;display:flex;flex-direction:column;gap:12px;">',

          // Device detected
          '<div style="background:rgba(0,122,255,.08);border:1px solid rgba(0,122,255,.2);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:12px;">',
            '<i class="fab fa-apple" style="color:#aaa;font-size:26px;flex-shrink:0;"></i>',
            '<div>',
              '<div style="color:#fff;font-size:13px;font-weight:700;">' + deviceName + ' Detected</div>',
              '<div style="color:#aaa;font-size:11px;">You\'re browsing on iOS</div>',
            '</div>',
          '</div>',

          // iOS not supported highlight
          '<div style="background:linear-gradient(135deg,rgba(229,9,20,.18),rgba(229,9,20,.08));border:2px solid rgba(229,9,20,.55);border-radius:14px;padding:16px 18px;">',
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">',
              '<div style="width:34px;height:34px;background:rgba(229,9,20,.25);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">',
                '<i class="fas fa-exclamation-triangle" style="color:#e50914;font-size:15px;"></i>',
              '</div>',
              '<div style="color:#fff;font-size:14px;font-weight:800;">Premium Not Available on iOS</div>',
            '</div>',
            '<p style="color:#ccc;font-size:12px;margin:0;line-height:1.6;">JFlix Premium is <strong style="color:#e50914;">not available on iPhone or iPad</strong>. To access premium, please use one of the supported platforms below.</p>',
          '</div>',

          // Supported platforms
          '<div>',
            '<div style="color:#FFD700;font-size:12px;font-weight:700;margin-bottom:10px;text-align:center;">',
              '<i class="fas fa-check-circle" style="margin-right:5px;"></i>Premium is Available On:',
            '</div>',
            '<div style="display:flex;flex-direction:column;gap:8px;">',

              // Android
              '<div style="background:rgba(61,220,151,.07);border:1px solid rgba(61,220,151,.2);border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;">',
                '<div style="width:36px;height:36px;background:rgba(61,220,151,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(61,220,151,.3);">',
                  '<i class="fab fa-android" style="color:#3ddc97;font-size:18px;"></i>',
                '</div>',
                '<div>',
                  '<div style="color:#fff;font-size:13px;font-weight:600;">Android</div>',
                  '<div style="color:#888;font-size:11px;">Phone & Tablet — Download the Android app</div>',
                '</div>',
              '</div>',

              // macOS
              '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;">',
                '<div style="width:36px;height:36px;background:rgba(255,255,255,.07);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.15);">',
                  '<i class="fab fa-apple" style="color:#eee;font-size:18px;"></i>',
                '</div>',
                '<div>',
                  '<div style="color:#fff;font-size:13px;font-weight:600;">macOS (MacBook)</div>',
                  '<div style="color:#888;font-size:11px;">Mac desktop app — Download the Mac app</div>',
                '</div>',
              '</div>',

              // Windows
              '<div style="background:rgba(0,120,212,.07);border:1px solid rgba(0,120,212,.2);border-radius:12px;padding:11px 13px;display:flex;align-items:center;gap:11px;">',
                '<div style="width:36px;height:36px;background:rgba(0,120,212,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.3);">',
                  '<i class="fab fa-windows" style="color:#0078d4;font-size:18px;"></i>',
                '</div>',
                '<div>',
                  '<div style="color:#fff;font-size:13px;font-weight:600;">Windows Computer</div>',
                  '<div style="color:#888;font-size:11px;">Desktop app — Download the Windows app</div>',
                '</div>',
              '</div>',

            '</div>',
          '</div>',

          // Info tip
          '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:11px 13px;display:flex;align-items:flex-start;gap:9px;">',
            '<i class="fas fa-info-circle" style="color:#FFD700;font-size:14px;margin-top:1px;flex-shrink:0;"></i>',
            '<span style="color:#cabd8f;font-size:11.5px;line-height:1.55;">To get JFlix Premium, download the app on a <strong style="color:#fff;">Windows or macOS computer</strong>, or install our <strong style="color:#fff;">Android app</strong>.</span>',
          '</div>',

          // Watch for Free
          '<div style="margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);">',
            '<button id="watch-for-free-btn" style="width:100%;background:linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.08));border:2px solid rgba(46,204,113,.4);color:#2ecc71;padding:14px;border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .3s ease;box-shadow:0 4px 16px rgba(46,204,113,.15);" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(46,204,113,.25),rgba(46,204,113,.15))\';this.style.borderColor=\'rgba(46,204,113,.6)\';this.style.boxShadow=\'0 6px 20px rgba(46,204,113,.25)\';this.style.transform=\'translateY(-1px)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.08))\';this.style.borderColor=\'rgba(46,204,113,.4)\';this.style.boxShadow=\'0 4px 16px rgba(46,204,113,.15)\';this.style.transform=\'none\';">',
              '<i class="fas fa-play-circle" style="font-size:20px;"></i>',
              '<span>Watch for Free (with Ads)</span>',
            '</button>',
            '<div style="color:#666;font-size:11px;text-align:center;margin-top:8px;line-height:1.4;">Click to continue watching with ads. Modal will reappear after 24 hours.</div>',
          '</div>',

        '</div>',
      '</div>'
    ].join('');

    // Handle Watch for Free button click
    var watchFreeBtn = modal.querySelector('#watch-for-free-btn');
    if (watchFreeBtn) {
      watchFreeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        try {
          localStorage.setItem('jflix_watch_free_timestamp', Date.now().toString());
        } catch (err) {}
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      });
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
  }

  // ─── ELECTRON: PREMIUM GATE ────────────────────────────────────────────────

  var _electronGateActive = false;
  // Expose via window so auth.js voucher handler can also clear the flag
  Object.defineProperty(window, '_electronGateActive', {
    get: function() { return _electronGateActive; },
    set: function(v) { _electronGateActive = v; },
    configurable: true,
    enumerable: true
  });

  function runElectronGate() {
    if (IS_IOS_NATIVE) return; // iOS native app allows free browsing / no forced payment gate
    waitForAuth(function () {
      if (!jflixAuth.isAuthenticated()) {
        showElectronSignIn();
      } else {
        checkElectronPremium();
      }
    });
  }
  window.runElectronGate = runElectronGate;
  window.showElectronSignIn = showElectronSignIn;

  function showElectronSignIn() {
    jflixAuth.openAuthModal();

    // Patch modal to remove guest button and block close
    var tryPatch = function (tries) {
      var modal = document.getElementById('auth-modal');
      if (!modal) { if (tries < 30) setTimeout(function () { tryPatch(tries + 1); }, 100); return; }

      // Hide "Continue as Guest" button
      var buttons = modal.querySelectorAll('button');
      buttons.forEach(function (btn) {
        if (btn.textContent.trim().toLowerCase().includes('guest')) {
          btn.style.display = 'none';
        }
        // Hide the close (×) button so user must sign in
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes('closeAuthModal')) {
          btn.style.display = 'none';
        }
      });

      // Prevent backdrop clicks from bubbling to document (does NOT block inner button clicks)
      modal.addEventListener('click', function (e) {
        if (e.target === modal) e.stopPropagation();
      });
    };
    setTimeout(function () { tryPatch(0); }, 50);
  }

  async function checkElectronPremium(wasExpired) {
    try {
      var user = await jflixAuth.fetchCurrentUser();
      if (!user) {
        jflixAuth.logout();
        showElectronSignIn();
        return;
      }
      if (!isPremiumActive(user)) {
        _electronGateActive = true;
        showElectronPremiumRequired(wasExpired ||
          !!(user.subscriptionType === 'premium' || user.subscription_type === 'premium'));
      } else {
        _electronGateActive = false;
      }
    } catch (e) {
      console.error('[Monetization] Error checking electron premium:', e);
    }
  }

  function showElectronPremiumRequired(wasExpired) {
    // Build/show the premium modal
    if (typeof openPremiumModal === 'function') {
      openPremiumModal();
    } else {
      setTimeout(function () { showElectronPremiumRequired(wasExpired); }, 200);
      return;
    }

    // After a brief moment, hide close button and optionally add expiry warning
    setTimeout(function () {
      var modal = document.getElementById('prem-modal');
      if (!modal) return;

      // Hide the × close button so user can't dismiss without paying
      var closeBtn = modal.querySelector('button[onclick*="closePremiumModal"]');
      if (closeBtn) closeBtn.style.display = 'none';
    }, 150);
  }

  // Override closePremiumModal in Electron/Android web/localhost to block close when gate is active
  // We do this after auth.js has defined closePremiumModal
  function patchClosePremiumModal() {
    if (!SHOULD_ENFORCE_PREMIUM_AUTH) return;
    if (typeof window.closePremiumModal !== 'function') {
      setTimeout(patchClosePremiumModal, 100);
      return;
    }
    var _originalClose = window.closePremiumModal;
    window.closePremiumModal = function () {
      // Block close while gate is active AND user is still authenticated
      if (_electronGateActive && jflixAuth && jflixAuth.isAuthenticated()) return;
      _originalClose();
    };
  }
  patchClosePremiumModal();

  // Periodic check: force premium gate if subscription expires (Electron + Android)
  function startElectronPeriodicCheck() {
    setInterval(async function () {
      try {
        if (IS_IOS_NATIVE || (!IS_ELECTRON && !IS_ANDROID_WEBVIEW)) return;
        if (!jflixAuth || !jflixAuth.isAuthenticated()) return;
        var user = await jflixAuth.fetchCurrentUser();
        if (!user) { jflixAuth.logout(); showElectronSignIn(); return; }
        if (!isPremiumActive(user)) {
          _electronGateActive = true;
          showElectronPremiumRequired(true);
        } else {
          _electronGateActive = false;
        }
      } catch (e) {
        console.error('[Monetization] Error in periodic check:', e);
      }
    }, 30000);
  }

  // Listen for successful sign-in in Electron/Android web/localhost
  window._onElectronAuthSuccess = function () {
    if (!SHOULD_ENFORCE_PREMIUM_AUTH) return;
    setTimeout(function () { checkElectronPremium(false); }, 500);
  };

  // ─── INIT ──────────────────────────────────────────────────────────────────

  if (!SHOULD_ENFORCE_PREMIUM_AUTH) {
    setupWebBrowserNavbar();

    // Attach click handlers to premium banner buttons after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        attachPremiumBannerHandlers();
        hidePremiumBannersInApps();
        // Fetch realtime exchange rates then update prices
        fetchExchangeRates().then(function() {
          updatePremiumBannerPrices();
        });
      });
    } else {
      attachPremiumBannerHandlers();
      hidePremiumBannersInApps();
      // Fetch realtime exchange rates then update prices
      fetchExchangeRates().then(function() {
        updatePremiumBannerPrices();
      });
    }
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        hidePremiumBannersInApps();
        if (!IS_IOS_NATIVE) {
          checkAppVersion();
          runElectronGate();
          startElectronPeriodicCheck();
          enforcePremiumGateBlocking();
        }
      });
    } else {
      hidePremiumBannersInApps();
      if (!IS_IOS_NATIVE) {
        checkAppVersion();
        runElectronGate();
        startElectronPeriodicCheck();
        enforcePremiumGateBlocking();
      }
    }
  }

  // Hide premium banners in Electron, Android web browser, iOS native app, and localhost (not regular web browsers or iOS PWA)
  function hidePremiumBannersInApps() {
    const IS_ANDROID_APP = typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID;

    // Hide banners in Electron, Android app, iOS app, and localhost, but NOT in PWA mode, iOS PWA, or web browsers
    if ((SHOULD_ENFORCE_PREMIUM_AUTH || IS_ANDROID_APP || IS_IOS_NATIVE || IS_NATIVE_APP) && !IS_IOS_PWA) {
      var premiumBanners = document.querySelectorAll('.premium-banner');
      premiumBanners.forEach(function(banner) {
        banner.style.display = 'none';
      });
    }
  }

  // AGGRESSIVE BLOCKING: Hide entire page content when gate is active
  function enforcePremiumGateBlocking() {
    if (!SHOULD_ENFORCE_PREMIUM_AUTH || IS_IOS_NATIVE) return;

    var checkAndBlock = function() {
      if (_electronGateActive) {
        // Hide all content except the premium modal
        var body = document.body;
        if (body) {
          // Add a blocking overlay
          var existingOverlay = document.getElementById('premium-gate-overlay');
          if (!existingOverlay) {
            var overlay = document.createElement('div');
            overlay.id = 'premium-gate-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:9998;display:none;';
            body.appendChild(overlay);
          }

          // Hide all main content containers
          var contentSelectors = ['header', 'nav', 'main', '.content', '.container', '.movie-grid', '.tv-grid', '.anime-grid', '.cartoon-grid', '.korean-grid', '#featured-section', '#trending-section', '.search-modal', '.quick-view-modal'];
          contentSelectors.forEach(function(selector) {
            var elements = document.querySelectorAll(selector);
            elements.forEach(function(el) {
              if (el.id !== 'prem-modal') {
                el.style.display = 'none';
              }
            });
          });

          // Show overlay
          var overlay = document.getElementById('premium-gate-overlay');
          if (overlay) overlay.style.display = 'block';

          // Ensure premium modal is visible
          var premModal = document.getElementById('prem-modal');
          if (premModal) {
            premModal.style.display = 'flex';
            premModal.style.zIndex = '9999';
          }
        }
      } else {
        // Gate not active - remove blocking overlay
        var overlay = document.getElementById('premium-gate-overlay');
        if (overlay) overlay.style.display = 'none';
      }
    };

    // Check immediately
    checkAndBlock();

    // Watch for gate flag changes
    setInterval(checkAndBlock, 1000);

    // Re-check on page navigation (SPA navigation or hash changes)
    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      setTimeout(function() {
        if (jflixAuth && jflixAuth.isAuthenticated()) {
          checkElectronPremium(false);
        }
      }, 500);
    };
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      setTimeout(function() {
        if (jflixAuth && jflixAuth.isAuthenticated()) {
          checkElectronPremium(false);
        }
      }, 500);
    };
    window.addEventListener('popstate', function() {
      setTimeout(function() {
        if (jflixAuth && jflixAuth.isAuthenticated()) {
          checkElectronPremium(false);
        }
      }, 500);
    });
  }

  // ─── App Version Detection & Forced Update ─────────────────────────────────────

  const MIN_REQUIRED_VERSION = '1.3.0';

  function compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1 = v1Parts[i] || 0;
      const v2 = v2Parts[i] || 0;
      if (v1 > v2) return 1;
      if (v1 < v2) return -1;
    }
    return 0;
  }

  function getAppVersion() {
    // Electron app
    if (IS_ELECTRON && window.electronAPI && window.electronAPI.getAppVersion) {
      return window.electronAPI.getAppVersion();
    }
    // Android app
    if (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID && window.AndroidApp && window.AndroidApp.getAppVersion) {
      return window.AndroidApp.getAppVersion();
    }
    return null;
  }

  function checkAppVersion() {
    const currentVersion = getAppVersion();
    if (!currentVersion) return; // Cannot determine version, skip check

    if (compareVersions(currentVersion, MIN_REQUIRED_VERSION) < 0) {
      showForcedUpdateModal(currentVersion);
    }
  }

  function showForcedUpdateModal(currentVersion) {
    if (document.getElementById('jflix-forced-update-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'jflix-forced-update-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.98);z-index:9999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);padding:20px;box-sizing:border-box;';

    const isElectron = IS_ELECTRON;
    const isAndroid = typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID;
    
    let downloadUrl = '';
    let platformName = '';
    
    if (isElectron) {
      if (isMacOSSilicon()) {
        downloadUrl = DOWNLOAD_URLS.macSilicon;
        platformName = 'macOS Silicon';
      } else if (isMacOSIntel()) {
        downloadUrl = DOWNLOAD_URLS.macIntel;
        platformName = 'macOS Intel';
      } else if (isWindows()) {
        downloadUrl = DOWNLOAD_URLS.windowsSetup;
        platformName = 'Windows';
      }
    } else if (isAndroid) {
      downloadUrl = DOWNLOAD_URLS.android;
      platformName = 'Android';
    }

    modal.innerHTML = [
      '<div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 100px rgba(0,0,0,.8);border:2px solid rgba(229,9,20,.3);position:relative;">',

        // Red stripe
        '<div style="height:5px;background:linear-gradient(90deg,#e50914,#ff4757 50%,#e50914);border-radius:24px 24px 0 0;"></div>',

        // Content
        '<div style="padding:40px 30px;text-align:center;">',
          '<div style="width:80px;height:80px;background:linear-gradient(135deg,#e50914,#ff4757);border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;box-shadow:0 10px 30px rgba(229,9,20,.5);">',
            '<i class="fas fa-exclamation-triangle" style="color:#fff;font-size:36px;"></i>',
          '</div>',
          '<h2 style="color:#fff;margin:0 0 12px;font-size:26px;font-weight:800;">Update Required</h2>',
          '<p style="color:#ccc;margin:0 0 24px;font-size:15px;line-height:1.6;">Your app version (<strong style="color:#e50914;">' + currentVersion + '</strong>) is outdated. Please update to version <strong style="color:#FFD700;">' + MIN_REQUIRED_VERSION + '</strong> to continue using JFlix.</p>',

          // Platform detected
          '<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;margin-bottom:24px;">',
            '<div style="color:#888;font-size:12px;margin-bottom:4px;">Detected Platform</div>',
            '<div style="color:#fff;font-size:16px;font-weight:700;">' + platformName + '</div>',
          '</div>',

          // Download button
          '<a href="' + downloadUrl + '" target="_blank" style="background: linear-gradient(135deg, #FFD700, #FFA500); color: #1a0a00; border: none; padding: 16px 40px; border-radius: 30px; font-size: 16px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; letter-spacing: 0.5px; box-shadow: 0 6px 20px rgba(255, 180, 0, 0.5); transition: all 0.3s ease; text-decoration: none; white-space: nowrap;" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 8px 25px rgba(255, 180, 0, 0.6)\';" onmouseout="this.style.transform=\'\'; this.style.boxShadow=\'0 6px 20px rgba(255, 180, 0, 0.5)\';">',
            '<i class="fas fa-download"></i> Download Update',
          '</a>',

          // Info
          '<div style="margin-top:24px;background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:14px;">',
            '<div style="color:#FFD700;font-size:13px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px;">',
              '<i class="fas fa-info-circle"></i> Important',
            '</div>',
            '<p style="color:#cabd8f;font-size:12px;margin:0;line-height:1.5;">After downloading, install the new version to continue using JFlix. This update includes important security fixes and new features.</p>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  }

  // Attach click handlers to premium banner buttons
  function attachPremiumBannerHandlers() {
    if (IS_NATIVE_APP || IS_IOS_NATIVE) return;
    var premiumBanners = document.querySelectorAll('.premium-banner-cta');
    premiumBanners.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        if (window.openDownloadAppModalUser) { window.openDownloadAppModalUser(); } else { window.openDownloadAppModal(); }
      });
    });
  }

})();
