// ── JFlix Invite Banner ────────────────────────────────────────────────────
// • Always visible — never permanently dismissed.
// • Desktop: full banner always shown; close button collapses to icon pill.
// • Mobile (≤600px): starts collapsed (icon only); tap icon to expand;
//   close button collapses back to icon.
// • Clicking the banner body opens the Profile Modal (invite section).
// ──────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // Skip for web browsers - show only in native apps (Electron, Android WebView)
  const isNativeApp = window.IS_ELECTRON || window.IS_ANDROID_WEBVIEW;
  if (!isNativeApp) return;

  // Skip when running as an installed PWA (standalone/fullscreen display mode)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.navigator.standalone === true;
  if (isPWA) return;

  const SHOW_DELAY_MS = 0;
  const isMobile = () => window.innerWidth <= 600;

  function openInviteInProfile(e) {
    e.stopPropagation();
    if (typeof openProfileModal === 'function') openProfileModal();
  }

  function createBanner() {
    if (document.getElementById('jflix-invite-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'jflix-invite-banner';
    banner.setAttribute('role', 'complementary');
    banner.setAttribute('aria-label', 'Invite a friend and get free premium');

    banner.innerHTML = `
      <style>
        #jflix-invite-banner {
          position: fixed;
          bottom: 28px;
          left: 24px;
          z-index: 99998;
          box-sizing: border-box;
          background: linear-gradient(135deg, #141428 0%, #1c1c38 100%);
          border: 1px solid rgba(255,215,0,.28);
          box-shadow: 0 8px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(255,215,0,.08);
          cursor: pointer;
          transform: translateY(120%);
          opacity: 0;
          transition: transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s ease,
                      width .28s cubic-bezier(.2,.8,.2,1),
                      padding .28s ease,
                      border-radius .05s ease;
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
          /* expanded default */
          width: 270px;
          height: auto;
          min-height: 44px;
          padding: 14px 40px 14px 14px;
          border-radius: 14px;
        }
        #jflix-invite-banner.visible {
          transform: translateY(0);
          opacity: 1;
        }
        /* ── Collapsed: matches ANIU floating button size ── */
        #jflix-invite-banner.collapsed {
          width: 70px !important;
          height: 70px !important;
          min-height: 70px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          border-color: rgba(255,215,0,.4);
        }
        #jflix-invite-banner:not(.collapsed):hover {
          border-color: rgba(255,215,0,.55);
          box-shadow: 0 12px 36px rgba(0,0,0,.65), 0 0 0 1px rgba(255,215,0,.18);
        }
        #jflix-invite-banner:not(.collapsed):active {
          transform: scale(.97) translateY(0);
        }
        /* Close / collapse button */
        #jflix-invite-banner-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.12);
          color: #888;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background .2s, color .2s, opacity .2s;
          flex-shrink: 0;
          line-height: 1;
          z-index: 2;
        }
        #jflix-invite-banner.collapsed #jflix-invite-banner-close {
          opacity: 0;
          pointer-events: none;
        }
        #jflix-invite-banner-close:hover {
          background: rgba(229,9,20,.35);
          color: #fff;
          border-color: rgba(229,9,20,.5);
        }
        /* Body row — always centered so icon stays centered when collapsed */
        #jflix-invite-banner-body {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          width: 100%;
          height: 100%;
        }
        /* Icon */
        #jflix-invite-banner-icon {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: linear-gradient(135deg,#FFD700,#FFA500);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 3px 10px rgba(255,180,0,.4);
          transition: width .3s ease, height .3s ease, border-radius .3s ease;
        }
        /* When collapsed the icon fills the whole button circle */
        #jflix-invite-banner.collapsed #jflix-invite-banner-icon {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          box-shadow: none;
        }
        #jflix-invite-banner-icon i {
          color: #1a0a00;
          font-size: 14px;
          transition: font-size .3s ease;
        }
        #jflix-invite-banner.collapsed #jflix-invite-banner-icon i {
          font-size: 22px;
        }
        /* Text — hides when collapsed */
        #jflix-invite-banner-text {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          transition: opacity .2s ease, max-width .3s ease;
          max-width: 300px;
          opacity: 1;
        }
        #jflix-invite-banner.collapsed #jflix-invite-banner-text {
          opacity: 0;
          max-width: 0;
        }
        #jflix-invite-banner-title {
          color: #FFD700;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.3;
          margin-bottom: 4px;
          white-space: normal;
          word-break: break-word;
        }
        #jflix-invite-banner-sub {
          color: #aaa;
          font-size: 11px;
          line-height: 1.5;
          white-space: normal;
          word-break: break-word;
        }
        #jflix-invite-banner-sub strong { color: #ddd; font-weight: 700; }
        #jflix-invite-banner-cta {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 8px;
          background: linear-gradient(135deg,#FFD700,#FFA500);
          color: #1a0a00;
          font-size: 11px;
          font-weight: 800;
          padding: 5px 10px;
          border-radius: 6px;
          letter-spacing: .2px;
          white-space: nowrap;
        }
        @keyframes jflixInvitePulse {
          0%,100% { box-shadow: 0 8px 28px rgba(0,0,0,.55), 0 0 0 1px rgba(255,215,0,.08); }
          50%      { box-shadow: 0 8px 28px rgba(0,0,0,.55), 0 0 0 3px rgba(255,215,0,.28); }
        }
        #jflix-invite-banner.visible:not(.collapsed) {
          animation: jflixInvitePulse 3s ease-in-out infinite;
        }
        #jflix-invite-banner.visible:not(.collapsed):hover {
          animation: none;
        }
        /* ── ≤768px: matches ANIU 60px ── */
        @media (max-width: 768px) {
          #jflix-invite-banner.collapsed {
            width: 60px !important;
            height: 60px !important;
            min-height: 60px !important;
          }
          #jflix-invite-banner.collapsed #jflix-invite-banner-icon {
            width: 60px;
            height: 60px;
          }
          #jflix-invite-banner.collapsed #jflix-invite-banner-icon i {
            font-size: 20px;
          }
        }
        /* ── ≤480px: matches ANIU 55px — compact expanded ── */
        @media (max-width: 480px) {
          #jflix-invite-banner {
            left: 14px;
            bottom: 22px;
            width: calc(100vw - 90px);
            max-width: 240px;
            padding: 12px 36px 12px 12px;
            border-radius: 12px;
          }
          #jflix-invite-banner.collapsed {
            width: 55px !important;
            height: 55px !important;
            min-height: 55px !important;
          }
          #jflix-invite-banner.collapsed #jflix-invite-banner-icon {
            width: 55px;
            height: 55px;
          }
          #jflix-invite-banner.collapsed #jflix-invite-banner-icon i {
            font-size: 18px;
          }
          #jflix-invite-banner-title { font-size: 12px; }
          #jflix-invite-banner-sub   { font-size: 10.5px; }
          #jflix-invite-banner-cta   { font-size: 10px; padding: 4px 9px; }
        }
      </style>

      <button id="jflix-invite-banner-close" title="Collapse" aria-label="Collapse invite banner">&#xd7;</button>

      <div id="jflix-invite-banner-body">
        <div id="jflix-invite-banner-icon">
          <i class="fas fa-gift"></i>
        </div>
        <div id="jflix-invite-banner-text">
          <div id="jflix-invite-banner-title">&#x1F381; Invite &amp; Get FREE Premium!</div>
          <div id="jflix-invite-banner-sub">Share your code — <strong>you &amp; friend</strong> get <strong>30 days free</strong>.</div>
          <div id="jflix-invite-banner-cta">
            <i class="fas fa-crown" style="font-size:8px;"></i> Get My Code
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Both desktop and mobile start collapsed — always a small circle on load
    banner.classList.add('collapsed');

    // Slide in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.classList.add('visible');
      });
    });

    // Close / collapse button — collapses banner but never removes it
    const closeBtn = document.getElementById('jflix-invite-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        banner.classList.add('collapsed');
      });
    }

    // Clicking the icon while collapsed → expand
    const iconEl = document.getElementById('jflix-invite-banner-icon');
    if (iconEl) {
      iconEl.addEventListener('click', function (e) {
        if (banner.classList.contains('collapsed')) {
          e.stopPropagation();
          banner.classList.remove('collapsed');
        }
      });
    }

    // Clicking expanded banner body → open profile modal (does NOT collapse)
    banner.addEventListener('click', function (e) {
      if (!banner.classList.contains('collapsed')) {
        openInviteInProfile(e);
      }
    });

    // Re-check collapse state on resize
    window.addEventListener('resize', function () {
      // Only auto-collapse when going from desktop→mobile while expanded
      // Do NOT force-expand on resize so user's collapsed preference is kept
    });
  }

  function init() {
    setTimeout(createBanner, SHOW_DELAY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
