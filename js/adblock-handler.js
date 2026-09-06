/**
 * Adsterra Social Bar Loader (compliant version)
 *
 * Loads the Adsterra Social Bar once per page. Does NOT use third-party
 * anti-adblock or popunder scripts. For Adsterra's official Anti-AdBlock
 * solution, request it from your Adsterra account manager.
 */
(function() {
  'use strict';

  var SOCIAL_BAR_URL = 'https://heavinessslight.com/55/db/4a/55db4af92ab5047a54bf7fe8d75e9b9d.js';

  function canRunAds() {
    if (window.JFLIX_HIDE_ADS === true) return false;
    var ua = navigator.userAgent;
    var isElectron = typeof window.IS_ELECTRON_APP !== 'undefined' && window.IS_ELECTRON_APP;
    var isAndroidNativeApp = /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(ua);
    var isAndroidWebView = /Android/.test(ua) && /wv/.test(ua);
    return !isElectron && !isAndroidNativeApp && !isAndroidWebView;
  }

  function isAdLoadingSuppressed() {
    return window.JFLIX_SUPPRESS_POPUNDER === true || window.JFLIX_PREMIUM_MODAL_OPEN === true;
  }

  function isSocialBarLoaded() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src === SOCIAL_BAR_URL) {
        return true;
      }
    }
    return false;
  }

  function loadSocialBar() {
    if (isSocialBarLoaded()) return;

    // Inject CSS to constrain Social Bar on mobile so it doesn't cover the whole screen
    if (!document.getElementById('jflix-social-bar-constraints')) {
      var style = document.createElement('style');
      style.id = 'jflix-social-bar-constraints';
      style.textContent = [
        '/* Adsterra Social Bar — mobile constraints */',
        '@media (max-width: 768px) {',
        '  /* Constrain the Social Bar container to bottom area only */',
        '  #container-55db4af92ab5047a54bf7fe8d75e9b9d,',
        '  #container-55db4af92ab5047a54bf7fe8d75e9b9d > *,',
        '  [id^="container-55db"] {',
        '    max-height: 60px !important;',
        '    max-width: 100% !important;',
        '    overflow: hidden !important;',
        '  }',
        '  /* Constrain any fixed-position ad overlays the Social Bar creates */',
        '  [style*="position: fixed"],',
        '  [style*="position:fixed"] {',
        '    /* Only constrain elements that look like Social Bar ad containers */',
        '  }',
        '  /* Limit Social Bar iframe height on mobile */',
        '  #container-55db4af92ab5047a54bf7fe8d75e9b9d iframe,',
        '  [id^="container-55db"] iframe {',
        '    max-height: 60px !important;',
        '    height: 60px !important;',
        '  }',
        '  /* Prevent Social Bar from creating full-screen overlays */',
        '  #container-55db4af92ab5047a54bf7fe8d75e9b9d {',
        '    position: fixed !important;',
        '    bottom: 0 !important;',
        '    left: 0 !important;',
        '    right: 0 !important;',
        '    top: auto !important;',
        '    height: auto !important;',
        '    max-height: 60px !important;',
        '    z-index: 99990 !important;',
        '    background: transparent !important;',
        '    pointer-events: auto !important;',
        '  }',
        '  /* Add bottom padding to body so content isn\'t hidden behind the bar */',
        '  body { padding-bottom: 65px !important; }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
    }

    var script = document.createElement('script');
    script.src = SOCIAL_BAR_URL;
    script.async = true;
    document.body.appendChild(script);

    // MutationObserver: constrain any full-screen overlays the Social Bar
    // creates dynamically on mobile (Adsterra sometimes injects popups)
    if (window.MutationObserver && window.innerWidth < 768) {
      var mo = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var nodes = mutations[i].addedNodes;
          if (!nodes) continue;
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if (node.nodeType !== 1) continue;
            constrainSocialBarElement(node);
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Constrain Social Bar elements on mobile to prevent full-screen takeover
  function constrainSocialBarElement(el) {
    if (window.innerWidth >= 768) return;
    if (!el || !el.style) return;

    // Check if this is a Social Bar related element (fixed position, large size)
    var isFixed = el.style.position === 'fixed' || el.style.position === 'Fixed';
    var isLarge = el.offsetHeight > 100 || el.style.height === '100vh' || el.style.height === '100%';
    var hasAdContent = el.id && (
      el.id.indexOf('55db') !== -1 ||
      el.id.indexOf('social') !== -1 ||
      el.id.indexOf('adsterra') !== -1
    );

    if (isFixed && (isLarge || hasAdContent)) {
      // Constrain to bottom bar
      el.style.setProperty('max-height', '60px', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('top', 'auto', 'important');
      el.style.setProperty('bottom', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
      el.style.setProperty('z-index', '99990', 'important');
    }

    // Also check children
    if (el.querySelectorAll) {
      var iframes = el.querySelectorAll('iframe');
      for (var k = 0; k < iframes.length; k++) {
        if (iframes[k].offsetHeight > 60) {
          iframes[k].style.setProperty('max-height', '60px', 'important');
          iframes[k].style.setProperty('height', '60px', 'important');
        }
      }
    }
  }

  function detectAdblock(callback) {
    // Create a small bait element. Ad blockers often hide elements with ad-related classes.
    var bait = document.createElement('div');
    bait.className = 'ads ad adsbygoogle advertisement';
    bait.style.cssText = 'position:absolute;top:-1000px;left:-1000px;width:1px;height:1px;opacity:0;pointer-events:none;';
    bait.innerHTML = '&nbsp;';
    document.body.appendChild(bait);

    setTimeout(function() {
      var baitStyle = window.getComputedStyle(bait);
      var blocked = baitStyle.display === 'none' ||
                    baitStyle.visibility === 'hidden' ||
                    bait.offsetHeight === 0 ||
                    bait.offsetParent === null;
      document.body.removeChild(bait);
      callback(blocked);
    }, 300);
  }

  function showAdblockNotice() {
    if (window.__jflixAdblockNoticeShown) return;
    try {
      if (sessionStorage.getItem('jflix-adblock-notice-dismissed')) return;
    } catch (e) {}

    var notice = document.createElement('div');
    notice.id = 'jflix-adblock-notice';
    notice.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99998;background:#1a1a2e;border-top:2px solid #e50914;color:#fff;padding:12px 16px;font-size:14px;text-align:center;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;';
    notice.innerHTML = '<span><i class="fas fa-shield-alt" style="color:#e50914;margin-right:8px;"></i>Ad blocker detected. JFlix is free because of ads. Please disable your ad blocker to support us.</span>' +
                       '<button id="jflix-adblock-close" style="background:#e50914;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Got it</button>';

    document.body.appendChild(notice);
    window.__jflixAdblockNoticeShown = true;

    document.getElementById('jflix-adblock-close').addEventListener('click', function() {
      notice.style.display = 'none';
      try {
        sessionStorage.setItem('jflix-adblock-notice-dismissed', '1');
      } catch (e) {}
    });

    // Auto-dismiss after 10 seconds
    setTimeout(function() {
      if (notice && notice.style.display !== 'none') {
        notice.style.display = 'none';
      }
    }, 10000);
  }

  function init() {
    if (!canRunAds()) return;
    if (isAdLoadingSuppressed()) return;
    loadSocialBar();

    // Wait a moment, then detect if an ad blocker is likely active.
    setTimeout(function() {
      var iframes = document.querySelectorAll('iframe[src*="heavinessslight.com"], iframe[src*="adsterra.com"]');
      if (iframes.length > 0) return;
      detectAdblock(function(blocked) {
        if (blocked) showAdblockNotice();
      });
    }, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
