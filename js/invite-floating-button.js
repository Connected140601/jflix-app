// JFlix Floating Invite/Share Button
// Shows a floating button at bottom-LEFT (opposite to ANIU button at bottom-right)
// Active across the whole website, Electron app, Android app, and iOS app.
// Clicking scrolls to profile modal and highlights Invite Friends + Apply Invitation Code

(function () {
  'use strict';

  var API_URL = (window.API_URL || 'https://jflix.uk/api').replace('/api', '') + '/api';

  // Global flag to prevent multiple initializations across SPA navigations
  if (window.__jflixInviteButtonInitialized) return;
  window.__jflixInviteButtonInitialized = true;

  function removeExistingButton() {
    var existing = document.getElementById('jflix-invite-float');
    if (existing) existing.remove();
    var style = document.getElementById('jflix-invite-float-style');
    if (style) style.remove();

    // Clean up any legacy duplicate banner if present
    var oldBanner = document.getElementById('jflix-invite-banner');
    if (oldBanner) oldBanner.remove();
    var oldBannerStyle = document.getElementById('jflix-invite-banner-style');
    if (oldBannerStyle) oldBannerStyle.remove();
  }

  function createInviteFloatingButton() {
    if (sessionStorage.getItem('jflix_dismiss_invite_btn') === 'true') return;
    removeExistingButton();

    var btn = document.createElement('div');
    btn.id = 'jflix-invite-float';
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Invite friends and get free premium');

    btn.innerHTML = '<i class="fas fa-user-plus" style="color:#1a0a00;font-size:20px;"></i>' +
                    '<span style="position:absolute;top:-5px;right:-5px;background:#e50914;color:#fff;border-radius:50%;width:20px;height:20px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(229,9,20,0.5);">FREE</span>' +
                    '<button id="jflix-invite-dismiss" title="Dismiss" style="position:absolute;top:-4px;left:-4px;width:18px;height:18px;border-radius:50%;background:rgba(10,10,18,0.85);color:#fff;border:1px solid rgba(255,255,255,0.2);font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 0.2s;padding:0;line-height:1;">&times;</button>';

    var style = document.createElement('style');
    style.id = 'jflix-invite-float-style';
    style.textContent = '@keyframes jflixInvitePulse{0%,100%{box-shadow:0 4px 20px rgba(255,180,0,0.5),0 0 0 2px rgba(255,215,0,0.15)}50%{box-shadow:0 4px 30px rgba(255,180,0,0.7),0 0 0 8px rgba(255,215,0,0.05)}}' +
                        '#jflix-invite-float{position:fixed;bottom:26px;left:22px;z-index:99997;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#FFD700,#FFA500);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(255,180,0,0.5),0 0 0 2px rgba(255,215,0,0.15);transition:all 0.3s cubic-bezier(0.2,0.8,0.2,1);user-select:none;-webkit-tap-highlight-color:transparent;animation:jflixInvitePulse 2.5s ease-in-out infinite;}' +
                        '#jflix-invite-float:hover{transform:scale(1.08);box-shadow:0 6px 35px rgba(255,180,0,0.7),0 0 0 4px rgba(255,215,0,0.2)}' +
                        '#jflix-invite-float:hover #jflix-invite-dismiss{opacity:1;}' +
                        '#jflix-invite-float:active{transform:scale(0.95)}' +
                        '@media(max-width:768px){' +
                        '  #jflix-invite-float{width:48px !important;height:48px !important;bottom:calc(20px + max(env(safe-area-inset-bottom, 0px), var(--ios-safe-bottom, 0px))) !important;left:max(14px, env(safe-area-inset-left, 0px)) !important;}' +
                        '  body.has-bottom-nav #jflix-invite-float{bottom:calc(72px + max(env(safe-area-inset-bottom, 0px), var(--ios-safe-bottom, 0px))) !important;}' +
                        '  html.is-ios-app #jflix-invite-float, body.is-ios-app #jflix-invite-float, html.is-ios-app body.has-bottom-nav #jflix-invite-float{bottom:calc(20px + max(env(safe-area-inset-bottom, 0px), var(--ios-safe-bottom, 0px))) !important;}' +
                        '  #jflix-invite-float i{font-size:17px !important;}' +
                        '  #jflix-invite-dismiss{opacity:0.75 !important;}' +
                        '}';
    document.head.appendChild(style);

    var dismissBtn = btn.querySelector('#jflix-invite-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        sessionStorage.setItem('jflix_dismiss_invite_btn', 'true');
        btn.style.transform = 'scale(0)';
        btn.style.opacity = '0';
        setTimeout(removeExistingButton, 250);
      });
    }

    btn.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'jflix-invite-dismiss') return;
      openInviteModal();
    });
    document.body.appendChild(btn);
  }

  function openInviteModal() {
    if (typeof openProfileModal === 'function') {
      openProfileModal();
      setTimeout(scrollToInviteSection, 300);
      return;
    }
    showInviteModal();
  }

  function scrollToInviteSection() {
    var modal = document.getElementById('profile-modal');
    if (!modal) return;

    var inviteCard = document.getElementById('pm-invite-card');
    var applyCard = document.getElementById('pm-apply-invite-card');

    if (inviteCard) {
      inviteCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      highlightCard(inviteCard);
      if (applyCard) {
        setTimeout(function() { highlightCard(applyCard); }, 500);
      }
    }
  }

  function highlightCard(card) {
    if (!card) return;
    var origBorder = card.style.border;
    var origBoxShadow = card.style.boxShadow;
    var origTransition = card.style.transition;

    card.style.transition = 'all 0.3s ease';
    card.style.border = '2px solid #FFD700';
    card.style.boxShadow = '0 0 20px rgba(255,215,0,0.5)';

    setTimeout(function() {
      card.style.border = origBorder;
      card.style.boxShadow = origBoxShadow;
      setTimeout(function() { card.style.transition = origTransition; }, 300);
    }, 3000);
  }

  async function showInviteModal() {
    var existing = document.getElementById('jflix-invite-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'jflix-invite-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease;backdrop-filter:blur(5px);';

    modal.innerHTML =
      '<div style="background:linear-gradient(135deg,#141428,#1c1c38);border:1px solid rgba(255,215,0,0.3);border-radius:20px;padding:30px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;">' +
        '<button id="jflix-invite-close" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#888;font-size:22px;cursor:pointer;">&times;</button>' +
        '<div style="text-align:center;margin-bottom:20px;">' +
          '<div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#FFD700,#FFA500);display:flex;align-items:center;justify-content:center;margin:0 auto 15px;">' +
            '<i class="fas fa-user-plus" style="color:#1a0a00;font-size:28px;"></i>' +
          '</div>' +
          '<h2 style="color:#FFD700;font-size:22px;margin:0 0 8px;">Invite Friends & Get FREE Premium!</h2>' +
          '<p style="color:#aaa;font-size:14px;line-height:1.5;margin:0;">Share your invite code with friends. When they sign up, you both get rewards!</p>' +
        '</div>' +
        '<div id="jflix-invite-code-box" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">' +
          '<p style="color:#888;font-size:12px;margin:0 0 8px;">Your Invite Code:</p>' +
          '<div id="jflix-invite-code" style="color:#FFD700;font-size:24px;font-weight:700;letter-spacing:2px;">Loading...</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button id="jflix-invite-copy" style="flex:1;background:linear-gradient(135deg,#FFD700,#FFA500);color:#1a0a00;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;"><i class="fas fa-copy"></i> Copy Code</button>' +
          '<button id="jflix-invite-share" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:12px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;"><i class="fas fa-share-alt"></i> Share</button>' +
        '</div>' +
        '<p style="color:#666;font-size:11px;text-align:center;margin:14px 0 0;">Sign in to get your personal invite code</p>' +
      '</div>';

    document.body.appendChild(modal);
    setTimeout(function() { modal.style.opacity = '1'; }, 10);

    function closeModal() {
      modal.style.opacity = '0';
      setTimeout(function() { modal.remove(); }, 300);
    }

    modal.querySelector('#jflix-invite-close').addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    // Try to get user's invite code
    try {
      var token = localStorage.getItem('jflix_access_token') || localStorage.getItem('access_token');
      if (token) {
        var res = await fetch(API_URL + '/invitations/my-code', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await res.json();
        if (data.success && data.code) {
          document.getElementById('jflix-invite-code').textContent = data.code;
        } else {
          document.getElementById('jflix-invite-code').textContent = 'Sign in required';
        }
      } else {
        document.getElementById('jflix-invite-code').textContent = 'Sign in to get code';
      }
    } catch (e) {
      document.getElementById('jflix-invite-code').textContent = 'Error loading';
    }

    // Copy button
    modal.querySelector('#jflix-invite-copy').addEventListener('click', function() {
      var code = document.getElementById('jflix-invite-code').textContent;
      if (code && code !== 'Loading...' && code !== 'Sign in required' && code !== 'Sign in to get code' && code !== 'Error loading') {
        navigator.clipboard.writeText(code).then(function() {
          var btn = modal.querySelector('#jflix-invite-copy');
          var original = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(function() { btn.innerHTML = original; }, 2000);
        });
      }
    });

    // Share button
    modal.querySelector('#jflix-invite-share').addEventListener('click', function() {
      var code = document.getElementById('jflix-invite-code').textContent;
      var shareText = 'Watch free movies & TV shows on JFlix! Use my invite code: ' + code + ' — https://jflix.uk';

      if (navigator.share) {
        navigator.share({ title: 'JFlix - Free Streaming', text: shareText, url: 'https://jflix.uk' });
      } else {
        navigator.clipboard.writeText(shareText).then(function() {
          var btn = modal.querySelector('#jflix-invite-share');
          var original = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-check"></i> Link Copied!';
          setTimeout(function() { btn.innerHTML = original; }, 2000);
        });
      }
    });
  }

  // Initialize — only once per session
  function init() {
    createInviteFloatingButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Handle SPA navigation: re-create button if removed (e.g., page transition)
  var observer = new MutationObserver(function() {
    if (sessionStorage.getItem('jflix_dismiss_invite_btn') === 'true') return;
    if (!document.getElementById('jflix-invite-float')) {
      createInviteFloatingButton();
    }
  });
  if (document.body) {
    observer.observe(document.body, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.body) observer.observe(document.body, { childList: true });
    });
  }

})();