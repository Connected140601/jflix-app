// JFlix Social Share — works on ALL pages
// Adds a share bar to the footer (all pages) and contextually near content (details/player)
// Responsive for desktop and mobile

(function () {
  'use strict';

  // Inject CSS once
  if (!document.getElementById('jflix-social-share-css')) {
    var style = document.createElement('style');
    style.id = 'jflix-social-share-css';
    style.textContent = `
/* ===== Social Share Bar ===== */
.jflix-share-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0;padding:14px 18px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;}
.jflix-share-bar .share-label{color:#aaa;font-size:13px;font-weight:600;margin-right:4px;white-space:nowrap;display:flex;align-items:center;gap:6px;}
.jflix-share-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;color:#fff;font-size:16px;transition:all 0.25s ease;flex-shrink:0;text-decoration:none;}
.jflix-share-btn:hover{transform:scale(1.12);opacity:0.9;color:#fff;}
.jflix-share-btn.fb{background:#1877F2;}
.jflix-share-btn.tw{background:#000;}
.jflix-share-btn.wa{background:#25D366;}
.jflix-share-btn.tg{background:#0088cc;}
.jflix-share-btn.rd{background:#FF4500;}
.jflix-share-btn.copy{background:rgba(255,255,255,0.15);}
.jflix-share-btn.copy.copied{background:#28a745;}

/* Footer share section */
.jflix-footer-share{padding:16px 20px;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);}
.jflix-footer-share .jflix-share-bar{margin:0;padding:0;background:none;border:none;}
.jflix-footer-share .share-label{color:#888;}

/* Inline share (details/player) */
.jflix-inline-share{margin:20px 0;}
.jflix-inline-share.player-share{
  margin-bottom:15px;
  background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
  border:1px solid rgba(255,255,255,0.1);
  border-radius:12px;
  padding:16px 20px;
  box-shadow:0 4px 15px rgba(0,0,0,0.3);
}
.jflix-inline-share.player-share .share-label{color:#fff;font-size:15px;}
.jflix-inline-share.player-share .jflix-share-btn{width:42px;height:42px;font-size:17px;}

/* Mobile responsive */
@media(max-width:768px){
  .jflix-share-bar{gap:8px;padding:10px 12px;}
  .jflix-share-bar .share-label{font-size:12px;}
  .jflix-share-btn{width:36px;height:36px;font-size:14px;}
  .jflix-footer-share{padding:12px 16px;}
  .jflix-footer-share .jflix-share-bar{justify-content:center;}
  .jflix-inline-share.player-share{padding:12px 14px;margin-bottom:12px;}
  .jflix-inline-share.player-share .jflix-share-btn{width:38px;height:38px;font-size:15px;}
  .jflix-inline-share.player-share .share-label{font-size:13px;}
}

/* Very small screens */
@media(max-width:400px){
  .jflix-share-bar{gap:6px;padding:8px 10px;}
  .jflix-share-btn{width:32px;height:32px;font-size:12px;}
  .jflix-share-bar .share-label{font-size:11px;}
}
`;
    document.head.appendChild(style);
  }

  // Get page info for sharing
  function getShareInfo() {
    var url = window.location.href;
    var title = document.title || 'JFlix - Free Streaming';
    var desc = '';

    // Try to get meta description
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) desc = metaDesc.getAttribute('content') || '';

    // For details/player pages, try to get movie title from URL params or page elements
    var params = new URLSearchParams(window.location.search);
    var movieTitle = '';

    // Check for movie title in page elements
    var titleEl = document.getElementById('movie-title') ||
                  document.getElementById('modal-title') ||
                  document.querySelector('.details-info h1') ||
                  document.querySelector('.movie-title');
    if (titleEl) movieTitle = titleEl.textContent.trim();

    var shareText = movieTitle
      ? 'Watch ' + movieTitle + ' for free on JFlix!'
      : 'Watch free movies, TV shows, anime & K-dramas on JFlix!';

    return { url: url, title: title, desc: desc, text: shareText };
  }

  // Build share bar HTML
  function buildShareBar(info) {
    var bar = document.createElement('div');
    bar.className = 'jflix-share-bar';
    bar.innerHTML =
      '<span class="share-label"><i class="fas fa-share-alt"></i> Share</span>' +
      '<button class="jflix-share-btn fb" data-platform="facebook" title="Share on Facebook"><i class="fab fa-facebook-f"></i></button>' +
      '<button class="jflix-share-btn tw" data-platform="twitter" title="Share on X"><i class="fab fa-x-twitter"></i></button>' +
      '<button class="jflix-share-btn wa" data-platform="whatsapp" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></button>' +
      '<button class="jflix-share-btn tg" data-platform="telegram" title="Share on Telegram"><i class="fab fa-telegram"></i></button>' +
      '<button class="jflix-share-btn rd" data-platform="reddit" title="Share on Reddit"><i class="fab fa-reddit-alien"></i></button>' +
      '<button class="jflix-share-btn copy" title="Copy link"><i class="fas fa-link"></i></button>';

    // Build share URLs for each platform
    var shareUrls = {
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(info.url),
      twitter: 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(info.text) + '&url=' + encodeURIComponent(info.url),
      whatsapp: 'https://api.whatsapp.com/send?text=' + encodeURIComponent(info.text + ' ' + info.url),
      telegram: 'https://t.me/share/url?url=' + encodeURIComponent(info.url) + '&text=' + encodeURIComponent(info.text),
      reddit: 'https://www.reddit.com/submit?url=' + encodeURIComponent(info.url) + '&title=' + encodeURIComponent(info.text)
    };

    // Native app URL schemes (for mobile deep linking)
    var nativeUrls = {
      facebook: 'fb://share?link=' + encodeURIComponent(info.url),
      whatsapp: 'whatsapp://send?text=' + encodeURIComponent(info.text + ' ' + info.url),
      telegram: 'tg://msg?text=' + encodeURIComponent(info.text + ' ' + info.url),
      twitter: 'twitter://post?message=' + encodeURIComponent(info.text + ' ' + info.url)
    };

    // Attach click handlers to each share button
    var buttons = bar.querySelectorAll('.jflix-share-btn[data-platform]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var platform = btn.getAttribute('data-platform');
        var shareUrl = shareUrls[platform];
        var nativeUrl = nativeUrls[platform];

        // On mobile, try native app first, then fall back to web URL
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile && nativeUrl) {
          // Try to open native app — if it fails, fall back to web URL
          var opened = false;
          var iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = nativeUrl;

          // If native app doesn't open in 1.5s, open web URL
          var fallbackTimer = setTimeout(function () {
            if (!opened) {
              window.open(shareUrl, '_blank');
            }
          }, 1500);

          // Detect if native app opened (page visibility change)
          var visibilityHandler = function () {
            if (document.hidden) {
              opened = true;
              clearTimeout(fallbackTimer);
              document.removeEventListener('visibilitychange', visibilityHandler);
            }
          };
          document.addEventListener('visibilitychange', visibilityHandler);

          // Clean up iframe after attempt
          iframe.onload = function () {
            document.body.removeChild(iframe);
          };
          document.body.appendChild(iframe);

          // Also clean up after 2s
          setTimeout(function () {
            if (iframe.parentNode) document.body.removeChild(iframe);
            document.removeEventListener('visibilitychange', visibilityHandler);
          }, 2000);
        } else {
          // Desktop or no native URL — open web share URL in new tab
          window.open(shareUrl, '_blank');
        }
      });
    });

    // Copy button handler
    var copyBtn = bar.querySelector('.copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(info.url).then(function () {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(function () {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '<i class="fas fa-link"></i>';
          }, 2000);
        });
      });
    }

    return bar;
  }

  // Add share bar to footer (all pages)
  function addToFooter() {
    var footer = document.querySelector('.footer');
    if (!footer) return;
    if (footer.querySelector('.jflix-footer-share')) return; // already added

    var info = getShareInfo();
    var wrapper = document.createElement('div');
    wrapper.className = 'jflix-footer-share';
    wrapper.appendChild(buildShareBar(info));

    // Insert before footer-bottom
    var footerBottom = footer.querySelector('.footer-bottom');
    if (footerBottom) {
      footer.insertBefore(wrapper, footerBottom);
    } else {
      footer.appendChild(wrapper);
    }
  }

  // Add inline share bar (details/player pages)
  function addInline() {
    if (document.getElementById('jflix-inline-share')) return;

    // Only add inline on details and player pages
    var isDetails = window.location.pathname.includes('details.html');
    var isPlayer = window.location.pathname.includes('player.html');
    if (!isDetails && !isPlayer) return;

    var info = getShareInfo();
    var bar = buildShareBar(info);
    bar.id = 'jflix-inline-share';
    bar.classList.add('jflix-inline-share');
    if (isPlayer) bar.classList.add('player-share');

    // For details page: insert after details-info or at top of details-content
    if (isDetails) {
      var detailsInfo = document.querySelector('.details-info');
      var detailsContent = document.querySelector('.details-content');
      if (detailsInfo && detailsInfo.parentNode) {
        detailsInfo.parentNode.insertBefore(bar, detailsInfo.nextSibling);
      } else if (detailsContent) {
        detailsContent.appendChild(bar);
      }
    }

    // For player page: insert ABOVE the server controls so users see it quickly
    if (isPlayer) {
      var serverControls = document.querySelector('.server-controls');
      if (serverControls && serverControls.parentNode) {
        serverControls.parentNode.insertBefore(bar, serverControls);
      } else {
        // Fallback: insert after the video container
        var playerContainer = document.querySelector('.player-container') ||
                              document.querySelector('#player-container') ||
                              document.querySelector('.video-container');
        if (playerContainer && playerContainer.parentNode) {
          playerContainer.parentNode.insertBefore(bar, playerContainer.nextSibling);
        }
      }
    }
  }

  // Initialize
  function init() {
    // Add inline share immediately (for details/player)
    addInline();

    // Retry inline share in case elements aren't ready yet (player page)
    function tryAddInline(retries) {
      if (document.getElementById('jflix-inline-share')) return;
      var isPlayer = window.location.pathname.includes('player.html');
      if (isPlayer && !document.querySelector('.server-controls') && retries > 0) {
        setTimeout(function () { tryAddInline(retries - 1); }, 500);
      } else if (isPlayer) {
        addInline();
      }
    }
    tryAddInline(6); // Retry for 3 seconds

    // Add footer share — wait for footer to load (it's async via footer-loader.js)
    function tryAddFooter(retries) {
      var footer = document.querySelector('.footer');
      if (footer) {
        addToFooter();
      } else if (retries > 0) {
        setTimeout(function () { tryAddFooter(retries - 1); }, 500);
      }
    }
    tryAddFooter(10); // Try for 5 seconds
  }

  // Run on DOM ready or immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init when footer loads (MutationObserver on footer-placeholder)
  var footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    var observer = new MutationObserver(function () {
      addToFooter();
    });
    observer.observe(footerPlaceholder, { childList: true, subtree: true });
  }
})();
