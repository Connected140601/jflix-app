// PWA Navigation Guard - Silent Block Mode for PWA
// Silently blocks external navigation (no modal) - follows Electron navigation guard pattern
// Version 5.2 - ACTIVE ONLY in iOS PWA and Android native app
// Adds ios=pwa parameter for player.html in iOS PWA

(function() {
  'use strict';

  console.log('PWA Navigation Guard loaded (Silent Block Mode)');

  // Detect Electron app
  const IS_ELECTRON = window.electronAPI && typeof window.electronAPI.isElectron === 'function' && window.electronAPI.isElectron();

  // Detect Android native app
  const IS_ANDROID_NATIVE = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                            /JFlix-Android/i.test(navigator.userAgent);

  // Check if running in PWA mode
  function isPWA() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator.standalone === true;

    return isStandalone || isIOSStandalone;
  }

  // Only activate for iOS PWA or Android native app (not regular web browser)
  if (!isPWA() && !IS_ANDROID_NATIVE && !IS_ELECTRON) {
    console.log('[PWA Navigation Guard] Regular web browser detected — navigation guard DISABLED');
    return;
  }

  if (IS_ANDROID_NATIVE) {
    console.log('[PWA Navigation Guard] JFlix Android app detected — silent navigation blocking ACTIVE');
  }

  if (isPWA()) {
    console.log('[PWA Navigation Guard] iOS PWA detected — navigation guard ACTIVE');
  }

  // Silently skip on player page
  if (window.location.pathname.includes('player.html')) {
    console.log('[PWA Navigation Guard] On player page — navigation guard disabled');
    return;
  }

  // Check if user is on iOS iPhone
  function isIPhone() {
    const ua = navigator.userAgent;
    return /iPhone/i.test(ua) && !(/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua) && !window.navigator.standalone);
  }

  // Check if this is an iOS iPhone PWA specifically
  function isIPhonePWA() {
    return isIPhone() && isPWA();
  }

  // Get current domain
  function getCurrentDomain() {
    return window.location.hostname;
  }

  // Allowed external domains (exceptions)
  const ALLOWED_DOMAINS = [
    'vidvault.ru', 'www.vidvault.ru',
    // Social media share endpoints — must be allowed so share buttons work in PWA
    'www.facebook.com', 'facebook.com',
    'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
    'api.whatsapp.com', 'wa.me', 'www.whatsapp.com',
    't.me', 'telegram.me',
    'www.reddit.com', 'reddit.com'
  ];

  // Intercept navigation attempts (Silent Block Mode)
  function interceptNavigation() {
    console.log('Setting up Silent Block Mode navigation interception');
    
    const currentDomain = getCurrentDomain();
    console.log('Current domain:', currentDomain);

    // Intercept all links with capture phase
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      
      if (link && link.href && !link.href.includes('#')) {
        try {
          const urlObj = new URL(link.href);
          const newDomain = urlObj.hostname;
          
          // Add ios=pwa parameter for player.html navigation in iOS PWA
          if (isIPhonePWA() && urlObj.pathname.includes('player.html') && !urlObj.searchParams.has('ios')) {
            urlObj.searchParams.set('ios', 'pwa');
            link.href = urlObj.toString();
            console.log('[iOS PWA] Added ios=pwa parameter to player.html link');
          }
          
          // Check if domain is in allowed list
          if (ALLOWED_DOMAINS.includes(newDomain)) {
            console.log('[Navigation Allowed] Exception domain:', newDomain);
            return;
          }
          
          // SILENT BLOCK: Block external navigation without modal
          if (newDomain !== currentDomain) {
            console.log('[Navigation Blocked] External link prevented:', link.href);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }
          
          // Allow same-domain navigation
          console.log('[Navigation Allowed] Same-domain navigation:', link.href);
        } catch (e) {
          console.error('Error parsing URL:', e);
        }
      }
    }, true);

    // Intercept form submissions
    document.addEventListener('submit', function(e) {
      const form = e.target;
      const action = form.action || window.location.href;
      
      try {
        const urlObj = new URL(action);
        const newDomain = urlObj.hostname;
        
        // Check if domain is in allowed list
        if (ALLOWED_DOMAINS.includes(newDomain)) {
          console.log('[Navigation Allowed] Exception domain for form:', newDomain);
          return;
        }
        
        // SILENT BLOCK: Block external form submissions
        if (newDomain !== currentDomain) {
          console.log('[Navigation Blocked] External form submission prevented:', action);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      } catch (e) {
        console.error('Error parsing form action:', e);
      }
    }, true);

    // Override window.location.assign
    const originalLocationAssign = window.location.assign;
    window.location.assign = function(url) {
      try {
        const urlObj = new URL(url);
        const newDomain = urlObj.hostname;
        
        // Check if domain is in allowed list
        if (ALLOWED_DOMAINS.includes(newDomain)) {
          console.log('[Navigation Allowed] Exception domain for assign:', newDomain);
          return originalLocationAssign.call(window.location, url);
        }
        
        // SILENT BLOCK: Block external location.assign
        if (newDomain !== currentDomain) {
          console.log('[Navigation Blocked] External location.assign prevented:', url);
          return;
        }
        
        console.log('[Navigation Allowed] location.assign to same domain:', url);
        return originalLocationAssign.call(window.location, url);
      } catch (e) {
        console.error('Error in location.assign:', e);
      }
    };

    // Override window.location.href setter
    Object.defineProperty(window.location, 'href', {
      set: function(url) {
        try {
          const urlObj = new URL(url);
          const newDomain = urlObj.hostname;
          
          // Check if domain is in allowed list
          if (ALLOWED_DOMAINS.includes(newDomain)) {
            console.log('[Navigation Allowed] Exception domain for href:', newDomain);
            window.location.replace(url);
            return;
          }
          
          // SILENT BLOCK: Block external location.href
          if (newDomain !== currentDomain) {
            console.log('[Navigation Blocked] External location.href prevented:', url);
            return;
          }
          
          console.log('[Navigation Allowed] location.href to same domain:', url);
          window.location.replace(url);
        } catch (e) {
          console.error('Error in location.href setter:', e);
        }
      },
      get: function() {
        return window.location.href;
      }
    });

    // Intercept browser back/forward buttons - silently block
    window.addEventListener('popstate', function(e) {
      console.log('[Navigation Blocked] Back/forward button prevented');
      e.preventDefault();
      e.stopPropagation();
    });

    // Remove beforeunload - no confirmation needed
    // Navigation is now silently blocked
  }

  // Initialize — ONLY for iOS iPhone PWA
  function init() {
    console.log('PWA Navigation Guard: checking platform...');
    console.log('Is iPhone:', isIPhone(), '| Is PWA:', isPWA());
    
    if (!isIPhonePWA()) {
      console.log('Not an iOS iPhone PWA — navigation guard disabled');
      return;
    }

    console.log('iOS iPhone PWA detected — enabling silent navigation block');
    interceptNavigation();
    console.log('PWA Navigation Guard initialized (iOS iPhone PWA only - Silent Block Mode)');
  }

  // Run immediately
  init();

})();
