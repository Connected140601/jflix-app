// JFlix Cinematic Smooth Loader System
// Tier-1 Streaming Experience (Netflix / Loklok / Prime Video)

(function () {
  'use strict';

  let loader = null;
  let hideTimeout = null;
  let safetyTimeout = null;
  const pageStartTime = performance.now();
  const MIN_DISPLAY_MS = 350; // Prevents jarring micro-flashes

  function ensureLoader() {
    loader = document.getElementById('loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'loader';
      loader.className = 'loader-wrapper';
      loader.innerHTML = `
        <div class="loader-inner">
          <div class="loader-spinner-box">
            <div class="loader"></div>
            <div class="loader-core"></div>
          </div>
          <div class="loader-text">Loading JFlix</div>
          <div class="loader-bar"><div class="loader-bar-fill"></div></div>
        </div>
      `;
      if (document.body) {
        document.body.prepend(loader);
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          if (!document.getElementById('loader')) {
            document.body.prepend(loader);
          }
        });
      }
      return loader;
    }

    // Enhance existing HTML structure if needed
    if (!loader.querySelector('.loader-inner')) {
      const inner = document.createElement('div');
      inner.className = 'loader-inner';
      
      const spinnerBox = document.createElement('div');
      spinnerBox.className = 'loader-spinner-box';
      const existingSpinner = loader.querySelector('.loader') || document.createElement('div');
      existingSpinner.className = 'loader';
      spinnerBox.appendChild(existingSpinner);
      
      const core = document.createElement('div');
      core.className = 'loader-core';
      spinnerBox.appendChild(core);
      inner.appendChild(spinnerBox);

      const existingText = loader.querySelector('.loader-text');
      if (existingText) {
        inner.appendChild(existingText);
      } else {
        const text = document.createElement('div');
        text.className = 'loader-text';
        text.textContent = 'Loading JFlix';
        inner.appendChild(text);
      }

      const bar = document.createElement('div');
      bar.className = 'loader-bar';
      bar.innerHTML = '<div class="loader-bar-fill"></div>';
      inner.appendChild(bar);

      loader.innerHTML = '';
      loader.appendChild(inner);
    } else {
      // Ensure bar and core exist
      if (!loader.querySelector('.loader-core')) {
        const spinnerBox = loader.querySelector('.loader-spinner-box') || loader.querySelector('.loader')?.parentElement;
        if (spinnerBox) {
          const core = document.createElement('div');
          core.className = 'loader-core';
          spinnerBox.appendChild(core);
        }
      }
      if (!loader.querySelector('.loader-bar')) {
        const inner = loader.querySelector('.loader-inner');
        if (inner) {
          const bar = document.createElement('div');
          bar.className = 'loader-bar';
          bar.innerHTML = '<div class="loader-bar-fill"></div>';
          inner.appendChild(bar);
        }
      }
    }

    return loader;
  }

  // Global showLoader
  window.showLoader = function (customText) {
    const el = ensureLoader();
    if (!el) return;

    if (customText) {
      const textEl = el.querySelector('.loader-text');
      if (textEl) textEl.textContent = customText;
    }

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    el.style.display = 'flex';
    el.classList.remove('hidden');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('visible');
      });
    });

    // Auto-dismiss safety timer (never trap the user)
    if (safetyTimeout) clearTimeout(safetyTimeout);
    safetyTimeout = setTimeout(() => {
      window.hideLoader();
    }, 4500);
  };

  // Global hideLoader
  window.hideLoader = function (forceImmediate) {
    const el = document.getElementById('loader') || loader;
    if (!el) return;

    if (safetyTimeout) {
      clearTimeout(safetyTimeout);
      safetyTimeout = null;
    }

    if (forceImmediate) {
      el.classList.remove('visible');
      el.classList.add('hidden');
      el.style.display = 'none';
      return;
    }

    const elapsed = performance.now() - pageStartTime;
    const remainingTime = Math.max(0, MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      el.classList.remove('visible');
      
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        el.classList.add('hidden');
        el.style.display = 'none';
        hideTimeout = null;
      }, 400); // 0.4s smooth fade matching CSS cubic-bezier
    }, remainingTime);
  };

  // ── Destination-aware loader helpers ───────────────────────────────────
  const PAGE_LABELS = {
    'index.html': 'Home',
    'movies.html': 'Movies',
    'tvshows.html': 'TV Shows',
    'anime.html': 'Anime',
    'korean.html': 'Korean TV',
    'cartoon.html': 'Cartoons',
    'player.html': 'Player',
    'details.html': 'Details',
    'watchlist.html': 'Watch Later',
    'profile.html': 'Profile',
    'admin.html': 'Admin',
    'terms.html': 'Terms of Service',
    'privacy.html': 'Privacy Policy',
    'disclaimer.html': 'Disclaimer',
    'dmca.html': 'DMCA',
    'reset-password.html': 'Reset Password'
  };

  // Return the internal page filename a URL points to, or null when external/unparsable
  function extractPage(href) {
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      const parts = url.pathname.split('/');
      return parts[parts.length - 1] || 'index.html';
    } catch (err) {
      return null;
    }
  }

  // Human label for an internal page filename (e.g. "movies.html" -> "Movies")
  function pageDisplayName(page) {
    if (!page) return null;
    if (page in PAGE_LABELS) return PAGE_LABELS[page];
    return page.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || null;
  }

  // Try to read the media/show name near the clicked element for a nicer loader text
  function getContextTitle(el) {
    let holder = el.closest('[data-title], [data-name], [data-media-title]');
    if (holder) {
      const t = (holder.getAttribute('data-title') || holder.getAttribute('data-name') || holder.getAttribute('data-media-title') || '').trim();
      if (t && t.length <= 90) return t;
    }

    holder = el.closest('.media-card, .movie-card, .result-item, .result-poster-container, .continue-watching-item, .row-item, .anime-card, .trending-card, .content-card, .watchlist-item, .carousel-card, .hero-content, .hero-card, .featured-card, .banner-content, li[class*="card"]');
    if (holder) {
      const titleEl = holder.querySelector('[class*="title" i], [class*="name" i], h1, h2, h3');
      if (titleEl) {
        const t = (titleEl.textContent || '').trim();
        if (t && t.length <= 90) return t;
      }
    }
    return null;
  }

  // Compose the loader message: media title for player/details, page name otherwise
  function loaderTextFor(page, title) {
    if (page && title && (page === 'player.html' || page === 'details.html')) {
      return 'Loading ' + title + '…';
    }
    if (page) {
      const name = pageDisplayName(page);
      if (name) return 'Loading ' + name + '…';
    }
    return null;
  }

  function init() {
    ensureLoader();

    // Universal navigation & action click listener — fires before page handlers,
    // so every internal page change reliably shows the loader with the destination name
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // allow new-tab shortcuts
      if (e.button !== 0) return;

      const target = e.target && e.target.closest ? e.target : null;
      if (!target) return;

      // 0. ANIU floating button — guaranteed navigation to the ANIU site.
      // Runs before everything else so no overlay, blocker, or future handler
      // can swallow the click. Absolute same-origin URL also keeps it working
      // from any path depth (regular web, Electron, and Android WebView).
      const aniuBtn = target.closest('a.floating-button');
      if (aniuBtn) {
        try {
          if (window.showLoader) window.showLoader('Loading ANIU');
        } catch (err) { /* loader is best-effort */ }
        try {
          window.location.href = window.location.origin + '/aniu/index.html';
        } catch (err) {
          aniuBtn.href = window.location.origin + '/aniu/index.html';
        }
        e.preventDefault();
        return;
      }

      // 1. Plain navigation links
      const link = target.closest('a');
      if (link) {
        if (link.hasAttribute('data-no-loader') || link.target === '_blank' || link.download) {
          return;
        }

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }

        const page = extractPage(href);
        if (!page) return; // external link — no JFlix loader

        const title = getContextTitle(target);
        const text = loaderTextFor(page, title);
        if (text) window.showLoader(text);
        else window.showLoader();
        return;
      }

      // 2. Watch / Play / Details / card action buttons
      const actionBtn = target.closest('.watch-btn, .details-btn, .play-btn, .info-btn, .card-btn, .view-all, .continue-watching-item, .continue-watching, [data-navigate]');
      if (actionBtn && !actionBtn.hasAttribute('data-no-loader')) {
        let page = null;
        if (actionBtn.hasAttribute('data-navigate')) {
          page = extractPage(actionBtn.getAttribute('data-navigate'));
        } else if (actionBtn.classList.contains('details-btn') || actionBtn.classList.contains('info-btn')) {
          page = 'details.html';
        } else if (actionBtn.classList.contains('watch-btn') || actionBtn.classList.contains('play-btn') || actionBtn.classList.contains('continue-watching')) {
          page = 'player.html';
        }

        const title = getContextTitle(target);
        const text = loaderTextFor(page, title);
        if (text) window.showLoader(text);
        else window.showLoader();
        return;
      }

      // 3. Inline onclick handlers that assign window.location directly (hero, banners, etc.)
      const onclickEl = target.closest('[onclick]');
      if (onclickEl) {
        const oc = onclickEl.getAttribute('onclick') || '';
        let url = null;
        let m = oc.match(/(?:window\.)?location\.href\s*=\s*(['"`])([^'"`]*)\1/);
        if (m) url = m[2];
        if (!url) {
          m = oc.match(/(?:window\.)?location\.(?:assign|replace)\(\s*(['"`])([^'"`]*)\1\s*\)/);
          if (m) url = m[2];
        }
        if (!url) {
          m = oc.match(/(?:window\.)?location\s*=\s*(['"`])([^'"`]*)\1/);
          if (m) url = m[2];
        }
        if (url) {
          const page = extractPage(url);
          if (page) {
            const title = getContextTitle(target);
            const text = loaderTextFor(page, title);
            if (text) window.showLoader(text);
            else window.showLoader();
          }
        }
      }
    }, true);

    // Form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form.hasAttribute('data-no-loader') && form.target !== '_blank') {
        window.showLoader();
      }
    });

    // Fallback dismiss for initial page load
    setTimeout(() => {
      window.hideLoader();
    }, 2200);
  }

  // Hide on load and pageshow (back/forward cache)
  window.addEventListener('load', () => {
    setTimeout(() => window.hideLoader(), 200);
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.hideLoader(true);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

