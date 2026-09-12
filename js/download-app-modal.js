// JFlix Monetization System
// Web Browser: Get Premium button + Download App modal
// Electron: Sign-in gate + Premium-only access
// Android Web Browser: Sign-in gate + Premium-only access (same as Electron)
// Localhost: Sign-in gate + Premium-only access (same as Electron)
// Version 2.0

(function () {
  'use strict';

  // Native app detection (Electron, Android WebView, or iOS native app wrapper)
  // These are the ONLY platforms that should enforce premium auth / hide web banners
  const IS_ELECTRON = navigator.userAgent.includes('Electron');
  const IS_ANDROID_WEBVIEW = (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID) ||
                             /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                             /JFlixNativeApp-X7K9Q2M/i.test(navigator.userAgent) ||
                             /JFlix-Android/i.test(navigator.userAgent);
  const IS_IOS_NATIVE = (typeof window.IS_IOS_APP !== 'undefined' && window.IS_IOS_APP === true) ||
                        (typeof window.IS_IOS_NATIVE !== 'undefined' && window.IS_IOS_NATIVE === true) ||
                        /JFlix-iOS/i.test(navigator.userAgent) ||
                        (/JFlixNativeApp/i.test(navigator.userAgent) && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ||
                        (document.documentElement && document.documentElement.classList.contains('is-ios-app'));
  const IS_NATIVE_APP = IS_ELECTRON || IS_ANDROID_WEBVIEW || IS_IOS_NATIVE;

  // System browser detection (all browsers: Chrome, Firefox, Safari, Edge, etc.)
  // These should show Get Premium button and ads/premium banners
  const IS_SYSTEM_BROWSER = !IS_NATIVE_APP;

  // Localhost detection (for development)
  const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Combined detection: native apps and localhost
  const SHOULD_ENFORCE_PREMIUM_AUTH = IS_NATIVE_APP || IS_LOCALHOST;

  const R2_BASE = 'https://pub-200cfe5effe94692ae21875b18599cee.r2.dev';
  const LATEST_APP_VERSION = '1.4.1';
  const DOWNLOAD_URLS = {
    windowsSetup: `${R2_BASE}/JFlix-Setup-${LATEST_APP_VERSION}.exe`,
    windowsPortable: `${R2_BASE}/JFlix-${LATEST_APP_VERSION}-Portable.exe`,
    macSilicon: `${R2_BASE}/JFlix-${LATEST_APP_VERSION}-arm64.pkg`,
    macIntel: `${R2_BASE}/JFlix-${LATEST_APP_VERSION}-x64.pkg`,
    android: `${R2_BASE}/JFlix%201.4.4.apk`
  };

  // Expose latest version globally for app-update-modal.js to use
  window.JFLIX_LATEST_APP_VERSION = LATEST_APP_VERSION;
  window.JFLIX_DOWNLOAD_URLS = DOWNLOAD_URLS;

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

  // ─── POPUNDER SUPPRESSION FOR PREMIUM/DOWNLOAD MODALS ───────────────────────

  const PREMIUM_MODAL_IDS = [
    'jflix-download-premium-modal-user',
    'jflix-download-premium-modal',
    'jflix-ios-premium-modal'
  ];

  // Set global suppression flag when premium modals are open
  function setPremiumModalOpen(isOpen) {
    window.JFLIX_PREMIUM_MODAL_OPEN = isOpen;
    window.JFLIX_SUPPRESS_POPUNDER = isOpen;
    if (!isOpen && typeof window.jflixLoadPopunder === 'function') {
      window.jflixLoadPopunder();
    }
  }

  // Check if any premium/download modal is currently visible
  function isPremiumModalVisible() {
    return PREMIUM_MODAL_IDS.some(function(id) {
      var el = document.getElementById(id);
      return el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
    });
  }

  // Add click blocker on modal to stop document-level popunder listeners
  function applyModalPopunderBlock(modal) {
    if (!modal) return;
    modal.addEventListener('click', function(e) {
      // Stop bubble so document/window popunder click handlers don't fire
      e.stopPropagation();
    }, false);
  }

  // Watch for display style changes (e.g. inline onclick closes modal)
  function setupModalCloseObserver(modal) {
    if (!modal || !window.MutationObserver) return;
    var observer = new MutationObserver(function() {
      setPremiumModalOpen(isPremiumModalVisible());
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    // Initial state
    setPremiumModalOpen(true);
  }

  // ─── Currency & Location Detection ──────────────────────────────────────────

  // Base price in PHP
  const BASE_PRICE_PHP = 30;

  // Currency mapping with symbols (rates fetched from API)
  const CURRENCY_MAP = {
    'PH': { code: 'PHP', symbol: '₱' },
    'US': { code: 'USD', symbol: '$' },
    'GB': { code: 'GBP', symbol: '£' },
    'EU': { code: 'EUR', symbol: '€' },
    'JP': { code: 'JPY', symbol: '¥' },
    'KR': { code: 'KRW', symbol: '₩' },
    'IN': { code: 'INR', symbol: '₹' },
    'AU': { code: 'AUD', symbol: 'A$' },
    'CA': { code: 'CAD', symbol: 'C$' },
    'SG': { code: 'SGD', symbol: 'S$' },
    'MY': { code: 'MYR', symbol: 'RM' },
    'ID': { code: 'IDR', symbol: 'Rp' },
    'TH': { code: 'THB', symbol: '฿' },
    'VN': { code: 'VND', symbol: '₫' },
    'BR': { code: 'BRL', symbol: 'R$' },
    'MX': { code: 'MXN', symbol: '$' },
    'AE': { code: 'AED', symbol: 'د.إ' },
    'SA': { code: 'SAR', symbol: '﷼' },
    'EG': { code: 'EGP', symbol: 'E£' },
    'NG': { code: 'NGN', symbol: '₦' },
    'ZA': { code: 'ZAR', symbol: 'R' },
    'KE': { code: 'KES', symbol: 'KSh' },
    'GH': { code: 'GHS', symbol: 'GH₵' },
    'CN': { code: 'CNY', symbol: '¥' },
    'HK': { code: 'HKD', symbol: 'HK$' },
    'TW': { code: 'TWD', symbol: 'NT$' },
    'RU': { code: 'RUB', symbol: '₽' },
    'default': { code: 'USD', symbol: '$' }
  };

  // Store fetched exchange rates
  let exchangeRates = null;

  // Fetch realtime exchange rates from API
  async function fetchExchangeRates() {
    try {
      // Using free ExchangeRate-API (no API key required for basic usage)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/PHP');
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      const data = await response.json();
      exchangeRates = data.rates;
      return exchangeRates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      // Fallback to approximate rates if API fails
      exchangeRates = {
        'PHP': 1,
        'USD': 0.018,
        'GBP': 0.014,
        'EUR': 0.016,
        'JPY': 2.6,
        'KRW': 24,
        'INR': 1.5,
        'AUD': 0.027,
        'CAD': 0.024,
        'SGD': 0.024,
        'MYR': 0.085,
        'IDR': 280,
        'THB': 0.6,
        'VND': 440,
        'BRL': 0.09,
        'MXN': 0.3,
        'AED': 0.066,
        'SAR': 0.067,
        'EGP': 0.55,
        'NGN': 28,
        'ZAR': 0.33,
        'KES': 2.8,
        'GHS': 0.28,
        'CNY': 0.13,
        'HKD': 0.14,
        'TWD': 0.56,
        'RUB': 1.7
      };
      return exchangeRates;
    }
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

  // Convert PHP price to local currency using realtime rates
  function convertPriceToLocal(pricePHP) {
    const country = detectUserCountry();
    const currency = CURRENCY_MAP[country] || CURRENCY_MAP['default'];
    
    // Use realtime rate if available, otherwise use fallback
    const rate = exchangeRates ? (exchangeRates[currency.code] || 0.018) : 0.018;
    
    const convertedPrice = pricePHP * rate;
    
    // Round to appropriate decimal places
    let roundedPrice;
    if (currency.code === 'JPY' || currency.code === 'KRW' || currency.code === 'IDR' || currency.code === 'VND') {
      roundedPrice = Math.round(convertedPrice);
    } else {
      roundedPrice = Math.round(convertedPrice * 100) / 100;
    }
    
    return {
      price: roundedPrice,
      symbol: currency.symbol,
      code: currency.code
    };
  }

  // Update premium banner prices
  function updatePremiumBannerPrices() {
    const localPrice = convertPriceToLocal(BASE_PRICE_PHP);
    const priceElements = document.querySelectorAll('.premium-banner-price');
    
    priceElements.forEach(function(el) {
      el.innerHTML = localPrice.symbol + localPrice.price;
    });
  }

  // Expose currency conversion functions for use by other modules
  window.JFlixCurrency = {
    convertPriceToLocal: convertPriceToLocal,
    detectUserCountry: detectUserCountry,
    getExchangeRates: function() { return exchangeRates; }
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
    const isPrem = user.subscriptionType === 'premium' || user.subscription_type === 'premium';
    const expiry = user.subscriptionExpiresAt || user.subscription_expires_at;
    const expired = expiry && new Date(expiry) < new Date();
    return isPrem && !expired;
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
      btn.onclick = function() { window.openDownloadAppModalUser(); };
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
    
    openDownloadModal();
  };

  // ─── WEB BROWSER: USER-OPENED DOWNLOAD MODAL (with close button) ───────────

  window.openDownloadAppModalUser = function () {
    // Native apps and iOS wrapper: never show download app modal
    if (IS_NATIVE_APP || IS_IOS_NATIVE) return;

    var existing = document.getElementById('jflix-download-premium-modal-user');
    if (existing) { existing.style.display = 'flex'; return; }

    var mac = isMacOS();
    var win = isWindows();
    var android = isAndroid();
    var macSilicon = isMacOSSilicon();
    var macIntel = isMacOSIntel();

    function rowStyle(active) {
      return 'text-decoration:none;display:flex;align-items:center;gap:16px;' +
        'background:' + (active ? 'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)' : 'rgba(255,255,255,.04)') + ';' +
        'border:' + (active ? '2px solid rgba(255,215,0,.3)' : '1px solid rgba(255,255,255,.1)') + ';' +
        'border-radius:16px;padding:' + (isMobile() ? '14px 16px' : '16px 18px') + ';transition:all .3s ease;cursor:pointer;box-shadow:' + (active ? '0 8px 24px rgba(255,215,0,.15)' : '0 4px 12px rgba(0,0,0,.2)') + ';';
    }

    var downloadOptions = '';

    if (win) {
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.windowsSetup + '" target="_blank" style="' + rowStyle(true) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(0,120,212,.2) 0%,rgba(0,120,212,.1) 100%)\';this.style.borderColor=\'rgba(0,120,212,.5)\';this.style.boxShadow=\'0 8px 24px rgba(0,120,212,.25)\';"' +
        ' onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(0,120,212,.3) 0%,rgba(0,120,212,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.4);">' +
            '<i class="fab fa-windows" style="color:#0078d4;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Windows Setup</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.exe) — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Click "More info" → "Run anyway" if warned</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#0078d4;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.windowsPortable + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(0,120,212,.2) 0%,rgba(0,120,212,.1) 100%)\';this.style.borderColor=\'rgba(0,120,212,.5)\';this.style.boxShadow=\'0 8px 24px rgba(0,120,212,.25)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(0,120,212,.3) 0%,rgba(0,120,212,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.4);">' +
            '<i class="fab fa-windows" style="color:#0078d4;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Windows Portable</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">No installation required — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Click "More info" → "Run anyway" if warned</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#0078d4;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    } else if (mac) {
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.macSilicon + '" target="_blank" style="' + rowStyle(true) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Silicon (M1/M2/M3/M4/M5)</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.macIntel + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Intel</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    } else if (android) {
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.android + '" target="_blank" style="' + rowStyle(true) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(61,220,151,.2) 0%,rgba(61,220,151,.1) 100%)\';this.style.borderColor=\'rgba(61,220,151,.5)\';this.style.boxShadow=\'0 8px 24px rgba(61,220,151,.25)\';"' +
        ' onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(61,220,151,.3) 0%,rgba(61,220,151,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(61,220,151,.4);">' +
            '<i class="fab fa-android" style="color:#3ddc97;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Android</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Android app (.apk) — v1.4.4</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#3ddc97;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    } else {
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.windowsSetup + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(0,120,212,.2) 0%,rgba(0,120,212,.1) 100%)\';this.style.borderColor=\'rgba(0,120,212,.5)\';this.style.boxShadow=\'0 8px 24px rgba(0,120,212,.25)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(0,120,212,.3) 0%,rgba(0,120,212,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.4);">' +
            '<i class="fab fa-windows" style="color:#0078d4;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Windows Setup</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.exe) — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Click "More info" → "Run anyway" if warned</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#0078d4;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.macSilicon + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Silicon (M1/M2/M3/M4/M5)</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.macIntel + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Intel</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
          '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      downloadOptions +=
        '<a href="' + DOWNLOAD_URLS.android + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(61,220,151,.2) 0%,rgba(61,220,151,.1) 100%)\';this.style.borderColor=\'rgba(61,220,151,.5)\';this.style.boxShadow=\'0 8px 24px rgba(61,220,151,.25)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(61,220,151,.3) 0%,rgba(61,220,151,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(61,220,151,.4);">' +
            '<i class="fab fa-android" style="color:#3ddc97;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;"><div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Android</div>' +
          '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Android app (.apk) — v1.4.4</div></div>' +
          '<i class="fas fa-arrow-down" style="color:#3ddc97;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    }

    var modal = document.createElement('div');
    modal.id = 'jflix-download-premium-modal-user';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:16px;box-sizing:border-box;';

    modal.innerHTML = [
      '<div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;width:100%;max-width:' + (isMobile() ? '480px' : '800px') + ';max-height:92vh;overflow:hidden;box-shadow:0 30px 100px rgba(0,0,0,.8),0 0 0 1px rgba(255,215,0,.1);position:relative;">',
        '<div style="height:5px;background:linear-gradient(90deg,#b8860b 0%,#FFD700 25%,#fff8c4 50%,#FFD700 75%,#b8860b 100%);"></div>',
        '<button onclick="document.getElementById(\'jflix-download-premium-modal-user\').style.display=\'none\'"',
        ' style="position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:50%;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:all .3s ease;"',
        ' onmouseover="this.style.background=\'rgba(229,9,20,.4)\';this.style.transform=\'rotate(90deg)\';"',
        ' onmouseout="this.style.background=\'rgba(255,255,255,.1)\';this.style.transform=\'rotate(0deg)\';">&times;</button>',
        '<div style="display:' + (isMobile() ? 'block' : 'grid;grid-template-columns:320px 1fr') + ';min-height:500px;">',
          (!isMobile() ? [
            '<div style="background:linear-gradient(180deg,rgba(255,215,0,.08) 0%,rgba(255,215,0,.02) 100%);padding:40px 32px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-right:1px solid rgba(255,215,0,.1);">',
              '<div style="width:100px;height:100px;background:linear-gradient(135deg,#FFD700 0%,#FFA500 50%,#FF8C00 100%);border-radius:28px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 20px 50px rgba(255,180,0,.5),0 0 0 4px rgba(255,215,0,.2);">',
                '<i class="fas fa-crown" style="color:#1a0a00;font-size:42px;"></i>',
              '</div>',
              '<h2 style="color:#fff;margin:0 0 8px;font-size:28px;font-weight:800;letter-spacing:-0.5px;">JFlix Premium</h2>',
              '<p style="color:#aaa;margin:0 0 20px;font-size:14px;line-height:1.6;">Unlock the ultimate streaming experience</p>',
              '<div style="background:linear-gradient(135deg,rgba(255,215,0,.15) 0%,rgba(255,215,0,.05) 100%);border:2px solid rgba(255,215,0,.3);border-radius:16px;padding:16px 28px;">',
                '<span style="color:#FFD700;font-size:28px;font-weight:800;letter-spacing:-0.5px;">For as low as ₱33 only</span>',
              '</div>',
              '<div style="margin-top:32px;display:flex;flex-direction:column;gap:12px;width:100%;">',
                '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-ban" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">100% No Ads</span></div>',
                '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-infinity" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">Unlimited Streaming</span></div>',
                '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-film" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">Full HD Quality</span></div>',
              '</div>',
            '</div>'
          ].join('') : ''),
          '<div style="padding:' + (isMobile() ? '24px 20px' : '32px 36px') + ';display:flex;flex-direction:column;">',
            (isMobile() ? [
              '<div style="text-align:center;margin-bottom:24px;">',
                '<div style="width:72px;height:72px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 12px 30px rgba(255,180,0,.4);">',
                  '<i class="fas fa-crown" style="color:#1a0a00;font-size:30px;"></i>',
                '</div>',
                '<h2 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:800;">JFlix Premium</h2>',
                '<p style="color:#888;margin:0;font-size:13px;">Download the app to unlock premium</p>',
                '<div style="margin-top:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:12px;padding:6px 16px;display:inline-block;">',
                  '<span style="color:#FFD700;font-size:18px;font-weight:800;">For as low as ₱33 only</span>',
                '</div>',
              '</div>'
            ].join('') : ''),
            '<div style="margin-bottom:' + (isMobile() ? '14px' : '16px') + ';">',
              '<div style="color:#fff;font-size:' + (isMobile() ? '16px' : '18px') + ';font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:10px;">',
                '<i class="fas fa-download" style="color:#FFD700;"></i>',
                '<span>Download for Your Device</span>',
              '</div>',
              '<div style="color:#666;font-size:' + (isMobile() ? '12px' : '13px') + ';">Select your platform to get started</div>',
            '</div>',
            '<div style="display:flex;flex-direction:column;gap:' + (isMobile() ? '10px' : '12px') + ';flex:1;">',
              downloadOptions,
            '</div>',
            (mac ? [
              '<div style="margin-top:' + (isMobile() ? '16px' : '20px') + ';background:rgba(255,68,68,0.15);border:2px solid rgba(255,68,68,0.5);border-radius:14px;padding:' + (isMobile() ? '16px' : '18px') + ';">',
                '<div style="color:#FF4444;font-size:' + (isMobile() ? '13px' : '15px') + ';font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:10px;text-transform:uppercase;letter-spacing:1px;">',
                  '<i class="fas fa-exclamation-triangle" style="font-size:' + (isMobile() ? '16px' : '18px') + ';"></i>',
                  '<span>How to Install on macOS</span>',
                '</div>',
                '<div style="color:#fff;font-size:' + (isMobile() ? '12px' : '14px') + ';line-height:2.2;font-weight:500;">',
                  '<strong style="color:#FF4444;">1.</strong> Click the downloaded .pkg file<br>',
                  '<strong style="color:#FF4444;">2.</strong> When blocked, click "Done"<br>',
                  '<strong style="color:#FF4444;">3.</strong> Go to System Settings → Privacy & Security<br>',
                  '<strong style="color:#FF4444;">4.</strong> Scroll down to find the blocked PKG<br>',
                  '<strong style="color:#FF4444;">5.</strong> Click "Open Anyway"',
                '</div>',
              '</div>'
            ].join('') : ''),
          '</div>',
        '</div>',
      '</div>'
    ].join('');

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });

    applyModalPopunderBlock(modal);
    setupModalCloseObserver(modal);

    document.body.appendChild(modal);
  };

  // ─── WEB BROWSER: iOS PREMIUM MODAL ────────────────────────────────────────

  // iOS/iPad PWA mode detection — skip modal entirely for full access
  const IS_IOS_PWA = (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) &&
                     (/iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                      (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent)));

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
    applyModalPopunderBlock(modal);
    setupModalCloseObserver(modal);
    document.body.appendChild(modal);
  }

  // ─── WEB BROWSER: GENERAL DOWNLOAD MODAL ───────────────────────────────────

  // Check if user clicked "Watch for Free" within the last 24 hours
  function shouldShowDownloadModal() {
    try {
      const watchFreeTimestamp = localStorage.getItem('jflix_watch_free_timestamp');
      if (!watchFreeTimestamp) return true;
      
      const now = Date.now();
      const timestamp = parseInt(watchFreeTimestamp, 10);
      const hoursElapsed = (now - timestamp) / (1000 * 60 * 60);
      
      return hoursElapsed >= 24;
    } catch (e) {
      console.error('Error checking watch free timestamp:', e);
      return true;
    }
  }

  window.openDownloadModal = function() {
    if (!shouldShowDownloadModal()) return;
    
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
    var localPrice = convertPriceToLocal(BASE_PRICE_PHP);

    function rowStyle(active) {
      return 'text-decoration:none;display:flex;align-items:center;gap:16px;' +
        'background:' + (active ? 'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)' : 'rgba(255,255,255,.04)') + ';' +
        'border:' + (active ? '2px solid rgba(255,215,0,.3)' : '1px solid rgba(255,255,255,.1)') + ';' +
        'border-radius:16px;padding:' + (isMobile() ? '14px 16px' : '16px 18px') + ';transition:all .3s ease;cursor:pointer;box-shadow:' + (active ? '0 8px 24px rgba(255,215,0,.15)' : '0 4px 12px rgba(0,0,0,.2)') + ';';
    }

    // Build download options based on device
    var downloadOptions = '';
    
    if (win) {
      // Windows user - show Windows downloads
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.windowsSetup + '" target="_blank" style="' + rowStyle(true) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(0,120,212,.2) 0%,rgba(0,120,212,.1) 100%)\';this.style.borderColor=\'rgba(0,120,212,.5)\';this.style.boxShadow=\'0 8px 24px rgba(0,120,212,.25)\';"' +
        ' onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(0,120,212,.3) 0%,rgba(0,120,212,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.4);">' +
            '<i class="fab fa-windows" style="color:#0078d4;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Windows Setup</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.exe) — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Click "More info" → "Run anyway" if warned</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#0078d4;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.windowsPortable + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(0,120,212,.2) 0%,rgba(0,120,212,.1) 100%)\';this.style.borderColor=\'rgba(0,120,212,.5)\';this.style.boxShadow=\'0 8px 24px rgba(0,120,212,.25)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(0,120,212,.3) 0%,rgba(0,120,212,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.4);">' +
            '<i class="fab fa-windows" style="color:#0078d4;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Windows Portable</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">No installation required — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Click "More info" → "Run anyway" if warned</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#0078d4;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    } else if (mac) {
      // macOS user - show both macOS downloads
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.macSilicon + '" target="_blank" style="' + rowStyle(true) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Silicon (M1/M2/M3/M4/M5)</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.macIntel + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Intel</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    } else if (android) {
      // Android user - show Android download
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.android + '" target="_blank" style="' + rowStyle(true) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(61,220,151,.2) 0%,rgba(61,220,151,.1) 100%)\';this.style.borderColor=\'rgba(61,220,151,.5)\';this.style.boxShadow=\'0 8px 24px rgba(61,220,151,.25)\';"' +
        ' onmouseout="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 100%)\';this.style.borderColor=\'rgba(255,215,0,.3)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.15)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(61,220,151,.3) 0%,rgba(61,220,151,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(61,220,151,.4);">' +
            '<i class="fab fa-android" style="color:#3ddc97;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Android</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Android app (.apk) — v1.4.4</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#3ddc97;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    } else {
      // Device not detected - show all platforms
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.windowsSetup + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(0,120,212,.2) 0%,rgba(0,120,212,.1) 100%)\';this.style.borderColor=\'rgba(0,120,212,.5)\';this.style.boxShadow=\'0 8px 24px rgba(0,120,212,.25)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(0,120,212,.3) 0%,rgba(0,120,212,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(0,120,212,.4);">' +
            '<i class="fab fa-windows" style="color:#0078d4;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Windows Setup</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.exe) — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Click "More info" → "Run anyway" if warned</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#0078d4;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.macSilicon + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Silicon (M1/M2/M3/M4/M5)</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.macIntel + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%)\';this.style.borderColor=\'rgba(255,215,0,.4)\';this.style.boxShadow=\'0 8px 24px rgba(255,215,0,.2)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,rgba(255,255,255,.08) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,.2);">' +
            '<i class="fab fa-apple" style="color:#fff;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">macOS Intel</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Installer (.pkg) — v1.4.1</div>' +
            '<div style="color:#666;font-size:' + (isMobile() ? '9px' : '10px') + ';margin-top:3px;">Right-click PKG → Open, then enter password</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#aaa;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
      
      downloadOptions += 
        '<a href="' + DOWNLOAD_URLS.android + '" target="_blank" style="' + rowStyle(false) + '"' +
        ' onmouseover="this.style.background=\'linear-gradient(135deg,rgba(61,220,151,.2) 0%,rgba(61,220,151,.1) 100%)\';this.style.borderColor=\'rgba(61,220,151,.5)\';this.style.boxShadow=\'0 8px 24px rgba(61,220,151,.25)\';"' +
        ' onmouseout="this.style.background=\'rgba(255,255,255,.04)\';this.style.borderColor=\'rgba(255,255,255,.1)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,.2)\';">' +
          '<div style="width:' + (isMobile() ? '44px' : '48px') + ';height:' + (isMobile() ? '44px' : '48px') + ';background:linear-gradient(135deg,rgba(61,220,151,.3) 0%,rgba(61,220,151,.15) 100%);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(61,220,151,.4);">' +
            '<i class="fab fa-android" style="color:#3ddc97;font-size:' + (isMobile() ? '20px' : '22px') + ';"></i>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="color:#fff;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;">Android</div>' +
            '<div style="color:#888;font-size:' + (isMobile() ? '11px' : '12px') + ';margin-top:2px;">Android app (.apk) — v1.4.4</div>' +
          '</div>' +
          '<i class="fas fa-arrow-down" style="color:#3ddc97;font-size:' + (isMobile() ? '14px' : '16px') + ';flex-shrink:0;"></i>' +
        '</a>';
    }

    var modal = document.createElement('div');
    modal.id = 'jflix-download-premium-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:16px;box-sizing:border-box;';

    modal.innerHTML = [
      '<div style="background:linear-gradient(160deg,#1a1a2e 0%,#16213e 100%);border-radius:24px;width:100%;max-width:' + (isMobile() ? '480px' : '800px') + ';max-height:92vh;overflow:hidden;box-shadow:0 30px 100px rgba(0,0,0,.8),0 0 0 1px rgba(255,215,0,.1);position:relative;">',

        // Gold stripe
        '<div style="height:5px;background:linear-gradient(90deg,#b8860b 0%,#FFD700 25%,#fff8c4 50%,#FFD700 75%,#b8860b 100%);"></div>',

        // Close button
        '<button onclick="document.getElementById(\'jflix-download-premium-modal\').style.display=\'none\'"',
        ' style="position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);border-radius:50%;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:all .3s ease;"',
        ' onmouseover="this.style.background=\'rgba(229,9,20,.4)\';this.style.transform=\'rotate(90deg)\';"',
        ' onmouseout="this.style.background=\'rgba(255,255,255,.1)\';this.style.transform=\'rotate(0deg)\';">&times;</button>',

        // Main content layout
        '<div style="display:' + (isMobile() ? 'block' : 'grid;grid-template-columns:320px 1fr') + ';min-height:500px;">',

          // Left side - Hero section (desktop only)
          (!isMobile() ? [
            '<div style="background:linear-gradient(180deg,rgba(255,215,0,.08) 0%,rgba(255,215,0,.02) 100%);padding:40px 32px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-right:1px solid rgba(255,215,0,.1);">',
              '<div style="width:100px;height:100px;background:linear-gradient(135deg,#FFD700 0%,#FFA500 50%,#FF8C00 100%);border-radius:28px;display:flex;align-items:center;justify-content:center;margin-bottom:24px;box-shadow:0 20px 50px rgba(255,180,0,.5),0 0 0 4px rgba(255,215,0,.2);">',
                '<i class="fas fa-crown" style="color:#1a0a00;font-size:42px;"></i>',
              '</div>',
              '<h2 style="color:#fff;margin:0 0 8px;font-size:28px;font-weight:800;letter-spacing:-0.5px;">JFlix Premium</h2>',
              '<p style="color:#aaa;margin:0 0 20px;font-size:14px;line-height:1.6;">Unlock the ultimate streaming experience</p>',
              '<div style="background:linear-gradient(135deg,rgba(255,215,0,.15) 0%,rgba(255,215,0,.05) 100%);border:2px solid rgba(255,215,0,.3);border-radius:16px;padding:16px 28px;">',
                '<span style="color:#FFD700;font-size:28px;font-weight:800;letter-spacing:-0.5px;">For as low as ₱33 only</span>',
              '</div>',
              '<div style="margin-top:32px;display:flex;flex-direction:column;gap:12px;width:100%;">',
                '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-ban" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">100% No Ads</span></div>',
                '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-infinity" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">Unlimited Streaming</span></div>',
                '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;border:1px solid rgba(255,255,255,.08);"><i class="fas fa-film" style="color:#FFD700;font-size:16px;width:24px;"></i><span style="color:#ddd;font-size:13px;font-weight:500;">Full HD Quality</span></div>',
              '</div>',
            '</div>'
          ].join('') : ''),

          // Right side - Downloads section
          '<div style="padding:' + (isMobile() ? '24px 20px' : '32px 36px') + ';display:flex;flex-direction:column;">',

            // Mobile header (only on mobile)
            (isMobile() ? [
              '<div style="text-align:center;margin-bottom:24px;">',
                '<div style="width:72px;height:72px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 12px 30px rgba(255,180,0,.4);">',
                  '<i class="fas fa-crown" style="color:#1a0a00;font-size:30px;"></i>',
                '</div>',
                '<h2 style="color:#fff;margin:0 0 6px;font-size:24px;font-weight:800;">JFlix Premium</h2>',
                '<p style="color:#888;margin:0;font-size:13px;">Download the app to unlock premium</p>',
                '<div style="margin-top:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:12px;padding:6px 16px;display:inline-block;">',
                  '<span style="color:#FFD700;font-size:18px;font-weight:800;">For as low as ₱33 only</span>',
                '</div>',
              '</div>'
            ].join('') : ''),

            // Download section title
            '<div style="margin-bottom:' + (isMobile() ? '14px' : '16px') + ';">',
              '<div style="color:#fff;font-size:' + (isMobile() ? '16px' : '18px') + ';font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:10px;">',
                '<i class="fas fa-download" style="color:#FFD700;"></i>',
                '<span>Download for Your Device</span>',
              '</div>',
              '<div style="color:#666;font-size:' + (isMobile() ? '12px' : '13px') + ';">Select your platform to get started</div>',
            '</div>',

            // Download options
            '<div style="display:flex;flex-direction:column;gap:' + (isMobile() ? '10px' : '12px') + ';flex:1;">',
              downloadOptions,
            '</div>',

            // Watch for Free button
            '<div style="margin-top:' + (isMobile() ? '16px' : '20px') + ';padding-top:' + (isMobile() ? '16px' : '20px') + ';border-top:1px solid rgba(255,255,255,.08);">',
              '<button id="watch-for-free-btn" style="width:100%;background:linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.08));border:2px solid rgba(46,204,113,.4);color:#2ecc71;padding:' + (isMobile() ? '14px' : '16px') + ';border-radius:14px;font-size:' + (isMobile() ? '14px' : '15px') + ';font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .3s ease;box-shadow:0 4px 16px rgba(46,204,113,.15);" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(46,204,113,.25),rgba(46,204,113,.15))\';this.style.borderColor=\'rgba(46,204,113,.6)\';this.style.boxShadow=\'0 6px 20px rgba(46,204,113,.25)\';this.style.transform=\'translateY(-1px)\';" onmouseout="this.style.background=\'linear-gradient(135deg,rgba(46,204,113,.15),rgba(46,204,113,.08))\';this.style.borderColor=\'rgba(46,204,113,.4)\';this.style.boxShadow=\'0 4px 16px rgba(46,204,113,.15)\';this.style.transform=\'none\';">',
                '<i class="fas fa-play-circle" style="font-size:' + (isMobile() ? '18px' : '20px') + ';"></i>',
                '<span>Watch for Free (with Ads)</span>',
              '</button>',
              '<div style="color:#666;font-size:' + (isMobile() ? '10px' : '11px') + ';text-align:center;margin-top:8px;line-height:1.4;">Click to continue watching with ads. Modal will reappear after 24 hours.</div>',
            '</div>',

            // macOS installation instructions
            (mac ? [
              '<div style="margin-top:' + (isMobile() ? '16px' : '20px') + ';background:rgba(255,68,68,0.15);border:2px solid rgba(255,68,68,0.5);border-radius:14px;padding:' + (isMobile() ? '16px' : '18px') + ';">',
                '<div style="color:#FF4444;font-size:' + (isMobile() ? '13px' : '15px') + ';font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:10px;text-transform:uppercase;letter-spacing:1px;">',
                  '<i class="fas fa-exclamation-triangle" style="font-size:' + (isMobile() ? '16px' : '18px') + ';"></i>',
                  '<span>How to Install on macOS</span>',
                '</div>',
                '<div style="color:#fff;font-size:' + (isMobile() ? '12px' : '14px') + ';line-height:2.2;font-weight:500;">',
                  '<strong style="color:#FF4444;">1.</strong> Click the downloaded .pkg file<br>',
                  '<strong style="color:#FF4444;">2.</strong> When blocked, click "Done"<br>',
                  '<strong style="color:#FF4444;">3.</strong> Go to System Settings → Privacy & Security<br>',
                  '<strong style="color:#FF4444;">4.</strong> Scroll down to find the blocked PKG<br>',
                  '<strong style="color:#FF4444;">5.</strong> Click "Open Anyway"',
                '</div>',
              '</div>'
            ].join('') : ''),

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
        } catch (e) {
          console.error('Error saving watch free timestamp:', e);
        }
        modal.style.display = 'none';
      });
    }
    
    applyModalPopunderBlock(modal);
    setupModalCloseObserver(modal);
    
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
    _electronGateActive = false;
  }

  function showElectronSignIn() {
    // No-op on startup: user can click "Sign In" in header if they wish to login
  }

  async function checkElectronPremium(wasExpired) {
    _electronGateActive = false;
  }

  function showElectronPremiumRequired(wasExpired) {
    // No-op: do not force open premium modal
  }

  function patchClosePremiumModal() {
    // No-op: allow modal to close normally
  }

  function startElectronPeriodicCheck() {
    setInterval(async function () {
      if (typeof window.syncMonetagAdsState === 'function') {
        window.syncMonetagAdsState();
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
          startElectronPeriodicCheck();
        }
      });
    } else {
      hidePremiumBannersInApps();
      if (!IS_IOS_NATIVE) {
        checkAppVersion();
        startElectronPeriodicCheck();
      }
    }
  }

  // Hide premium banners in Electron, Android web browser, iOS native app, and localhost (not regular web browsers)
  function hidePremiumBannersInApps() {
    const IS_ANDROID_APP = typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID;

    // Hide banners in Electron, Android app, iOS app, and localhost, but NOT in PWA mode or web browsers
    if (SHOULD_ENFORCE_PREMIUM_AUTH || IS_ANDROID_APP || IS_IOS_NATIVE || IS_NATIVE_APP) {
      var premiumBanners = document.querySelectorAll('.premium-banner');
      premiumBanners.forEach(function(banner) {
        banner.style.display = 'none';
      });
    }
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
        window.openDownloadAppModalUser();
      });
    });
  }

})();
