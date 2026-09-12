/**
 * JFlix Modern Navbar Controller
 * - Dynamic scroll blur & sticky styling
 * - Active route detection & indicator
 * - Accessible mobile navigation drawer with backdrop
 * - Keyboard shortcuts (Ctrl+K, Cmd+K, '/') for instant search
 */

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger-menu');
  const navLinks = document.querySelector('.nav-links');

  // ─── Native iOS Haptic Feedback Helper ────────────────────────
  const triggerHaptic = (style = 'light') => {
    try {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosHaptic) {
        window.webkit.messageHandlers.iosHaptic.postMessage(style);
      } else if (navigator.vibrate) {
        navigator.vibrate(style === 'medium' || style === 'heavy' ? 25 : 12);
      }
    } catch (e) {}
  };
  window.jflixHaptic = triggerHaptic;

  // ─── 1. Dynamic Scroll Blur Effect ─────────────────────────────
  if (navbar) {
    const handleScroll = () => {
      if (window.scrollY > 24) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
  }

  // ─── 2. Auto Highlight Active Route ────────────────────────────
  if (navLinks) {
    const currentPath = window.location.pathname.toLowerCase();
    const links = navLinks.querySelectorAll('a');

    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const targetPath = href.toLowerCase().split('?')[0].split('#')[0];

      const isHome = (currentPath === '/' || currentPath === '' || currentPath.endsWith('index.html')) &&
                     (targetPath === 'index.html' || targetPath === '/' || targetPath === './index.html');
      const isMatch = isHome || (targetPath && currentPath.endsWith(targetPath) && targetPath !== 'index.html');

      if (isMatch) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  // ─── 3. Mobile Navigation Drawer & Backdrop ────────────────────
  if (hamburger && navLinks) {
    let backdrop = document.querySelector('.nav-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'nav-backdrop';
      document.body.appendChild(backdrop);
    }

    const setMenuOpen = (open) => {
      navLinks.classList.toggle('active', open);
      hamburger.classList.toggle('active', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      backdrop.classList.toggle('active', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerHaptic('medium');
      const willOpen = !navLinks.classList.contains('active');
      setMenuOpen(willOpen);
    });

    backdrop.addEventListener('click', () => setMenuOpen(false));

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setMenuOpen(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinks.classList.contains('active')) {
        setMenuOpen(false);
      }
    });
  }

  // ─── 4. Quick Search Shortcut (Cmd+K, Ctrl+K, '/') ─────────────
  document.addEventListener('keydown', (e) => {
    // Only trigger if not already typing in an input/textarea
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
      e.preventDefault();
      const searchInput = document.querySelector('.search-bar input, .nav-search input, #search-input');
      const searchTrigger = document.querySelector('.search-toggle, .search-icon, .search-btn');

      if (searchInput && searchInput.offsetParent !== null) {
        searchInput.focus();
        searchInput.select?.();
      } else if (searchTrigger) {
        searchTrigger.click();
      }
    }
  });

  // ─── 5. Loklok/Netflix Mobile Bottom Navigation ────────────────
  const isIOSAppEnv = () => {
    const ua = navigator.userAgent || '';
    return (window.IS_IOS_APP === true) ||
           (window.IS_IOS_NATIVE === true) ||
           (document.documentElement && document.documentElement.classList.contains('is-ios-app')) ||
           (document.body && document.body.classList.contains('is-ios-app')) ||
           /JFlix-iOS/i.test(ua) ||
           (/JFlixNativeApp/i.test(ua) && /iPhone|iPad|iPod/i.test(ua));
  };

  const removeMobileBottomNavIfIOS = () => {
    if (isIOSAppEnv()) {
      const existing = document.querySelector('.mobile-bottom-nav');
      if (existing) existing.remove();
      document.body.classList.remove('has-bottom-nav');
      return true;
    }
    return false;
  };

  const initMobileBottomNav = () => {
    // In iOS app, remove bottom navigation since header already features a hamburger menu
    if (removeMobileBottomNavIfIOS()) return;

    if (document.querySelector('.mobile-bottom-nav')) return;

    // Observe documentElement/body for dynamic iOS app class addition
    try {
      const iosNavObserver = new MutationObserver(() => {
        removeMobileBottomNavIfIOS();
      });
      iosNavObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      if (document.body) {
        iosNavObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    } catch (e) {}

    const nav = document.createElement('nav');
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile Bottom Navigation');

    const currentPath = window.location.pathname.toLowerCase();
    const isHome = currentPath === '/' || currentPath === '' || currentPath.endsWith('index.html');
    const isMovies = currentPath.includes('movies.html');
    const isTV = currentPath.includes('tvshows.html');
    const isAnime = currentPath.includes('anime.html');
    const isWatchlist = currentPath.includes('watchlist.html');

    nav.innerHTML = `
      <a href="index.html" class="bottom-nav-item ${isHome ? 'active' : ''}">
        <i class="fas fa-home"></i>
        <span>Home</span>
      </a>
      <a href="movies.html" class="bottom-nav-item ${isMovies ? 'active' : ''}">
        <i class="fas fa-film"></i>
        <span>Movies</span>
      </a>
      <a href="tvshows.html" class="bottom-nav-item ${isTV ? 'active' : ''}">
        <i class="fas fa-tv"></i>
        <span>Series</span>
      </a>
      <a href="anime.html" class="bottom-nav-item ${isAnime ? 'active' : ''}">
        <i class="fas fa-dragon"></i>
        <span>Anime</span>
      </a>
      <a href="watchlist.html" class="bottom-nav-item ${isWatchlist ? 'active' : ''}">
        <i class="fas fa-bookmark"></i>
        <span>Watch Later</span>
        <span class="watchlist-badge-count" style="display: none;">0</span>
      </a>
      <a href="#" class="bottom-nav-item bottom-search-btn" id="bottom-nav-search">
        <i class="fas fa-search"></i>
        <span>Search</span>
      </a>
    `;

    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');

    // Haptic feedback on bottom tab click
    nav.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        triggerHaptic('selection');
      });
    });

    // Search action handler
    const searchBtn = nav.querySelector('#bottom-nav-search');
    if (searchBtn) {
      searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerHaptic('medium');
        const searchModal = document.getElementById('search-modal');
        if (searchModal && typeof window.openSearchModal === 'function') {
          window.openSearchModal();
        } else if (searchModal) {
          searchModal.style.display = 'flex';
          const input = searchModal.querySelector('input');
          if (input) input.focus();
        } else {
          window.location.href = 'index.html?open_search=true';
        }
      });
    }

    // Initialize badge count
    if (window.updateWatchlistBadgeCount) window.updateWatchlistBadgeCount();
  };

  // ─── 6. Live Watchlist Badge Counter ───────────────────────────
  const updateWatchlistBadgeCount = () => {
    let count = 0;
    try {
      const list = JSON.parse(localStorage.getItem('jflix_watchlist') || '[]');
      count = Array.isArray(list) ? list.length : 0;
    } catch (e) {}

    const badges = document.querySelectorAll('.watchlist-badge-count, .nav-watchlist-count');
    badges.forEach(b => {
      if (count > 0) {
        b.textContent = count > 99 ? '99+' : count;
        b.style.display = 'inline-flex';
      } else {
        b.style.display = 'none';
      }
    });
  };

  window.updateWatchlistBadgeCount = updateWatchlistBadgeCount;
  updateWatchlistBadgeCount();

  window.addEventListener('storage', (e) => {
    if (e.key === 'jflix_watchlist') updateWatchlistBadgeCount();
  });

  initMobileBottomNav();

  // ─── 7. Ensure Header Profile Always Exists (iOS & Native Auth) ────
  const ensureNavbarProfile = () => {
    const navbarRight = document.querySelector('.navbar-right');
    if (!navbarRight) return;
    let userMenu = navbarRight.querySelector('.user-menu');
    if (!userMenu) {
      userMenu = document.createElement('div');
      userMenu.className = 'user-menu';
      userMenu.style.cssText = 'display: flex; margin-left: 12px; align-items: center;';
      const defaultAvatarSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Ccircle fill='%231a1d2e' cx='17' cy='17' r='17' stroke='%23e50914' stroke-width='2'/%3E%3Cpath fill='%23ffffff' d='M17 9a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 11c-4.2 0-8 2.2-8 5.5v1.5h16v-1.5c0-3.3-3.8-5.5-8-5.5z'/%3E%3C/svg%3E";
      userMenu.innerHTML = `
        <a href="profile.html" data-no-loader style="display: flex; align-items: center; gap: 8px; text-decoration: none; position: relative;" title="Profile" aria-label="Profile">
          <img src="${defaultAvatarSvg}" alt="Profile" class="user-avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #e50914;">
          <span id="header-profile-unread-badge" style="position:absolute;top:-4px;right:-4px;background:#e50914;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;">0</span>
          <span class="user-name" style="color: #fff; font-size: 13px; font-weight: 500;"></span>
        </a>
      `;
      navbarRight.appendChild(userMenu);
    }
  };
  ensureNavbarProfile();
});

