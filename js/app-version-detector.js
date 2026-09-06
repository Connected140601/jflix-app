// JFlix App Version Detector
// Detects if running in Electron app or Android APK and gets version

(function() {
  'use strict';

  // Get app version from Electron
  function getElectronAppVersion() {
    // Primary: try electronAPI
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      return {
        platform: 'electron',
        version: window.electronAPI.getAppVersion(),
        isElectron: true
      };
    }
    
    // Fallback: parse from user agent
    const ua = navigator.userAgent;
    const electronMatch = ua.match(/jflix-desktop\/(\d+\.\d+\.\d+)/i);
    if (electronMatch) {
      console.log('[App Version Detector] Found Electron version from user agent:', electronMatch[1]);
      return {
        platform: 'electron',
        version: electronMatch[1],
        isElectron: true
      };
    }
    
    return null;
  }

  // Get app version from Android APK (via injected window variable)
  function getAndroidAppVersion() {
    // Primary: check for custom JFlix Android app user agent
    const ua = navigator.userAgent;
    console.log('[App Version Detector] User Agent:', ua);
    const jflixAndroidMatch = ua.match(/JFlixNativeApp\/(\d+\.\d+\.\d+)/);
    if (jflixAndroidMatch) {
      console.log('[App Version Detector] Found version from user agent:', jflixAndroidMatch[1]);
      return {
        platform: 'android',
        version: jflixAndroidMatch[1],
        isAndroidApp: true
      };
    }
    
    // Fallback: check for injected version from MainActivity.java
    if (window.JFLIX_APP_VERSION) {
      console.log('[App Version Detector] Found injected version:', window.JFLIX_APP_VERSION);
      return {
        platform: 'android',
        version: window.JFLIX_APP_VERSION,
        isAndroidApp: true
      };
    }
    
    console.log('[App Version Detector] No Android version detected');
    return null;
  }

  // Get app info (Electron or Android)
  function getAppInfo() {
    const electronInfo = getElectronAppVersion();
    if (electronInfo) return electronInfo;

    const androidInfo = getAndroidAppVersion();
    if (androidInfo) return androidInfo;

    return {
      platform: 'web',
      version: null,
      isWeb: true
    };
  }

  // Expose to global scope
  window.JFlixAppInfo = getAppInfo();

  // Log for debugging
  console.log('JFlix App Info:', window.JFlixAppInfo);

  // Dispatch custom event when app info is available
  window.dispatchEvent(new CustomEvent('jflixAppInfoReady', {
    detail: window.JFlixAppInfo
  }));

})();
