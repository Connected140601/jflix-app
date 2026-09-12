// JFlix Invite Banner (DEPRECATED)
// Replaced by js/invite-floating-button.js to ensure a single, uniform invite floating button
// across the entire website and all applications (Electron, Android, iOS).

(function () {
  'use strict';
  function cleanup() {
    try {
      var banner = document.getElementById('jflix-invite-banner');
      if (banner) banner.remove();
      var style = document.getElementById('jflix-invite-banner-style');
      if (style) style.remove();
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanup, { once: true });
  } else {
    cleanup();
  }
})();
