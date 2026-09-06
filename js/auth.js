/**
 * JFlix Authentication Module
 * Handles Google Sign-In, user sessions, profile management, premium features, and chat
 * Version 2.0 - Enhanced error handling and validation
 */

// ── Platform Detection ────────────────────────────────────────────────────────
// Native app detection (Electron or Android WebView)
// These are the ONLY platforms that should show auth modal
const IS_ELECTRON = navigator.userAgent.includes('Electron');
const IS_ANDROID_WEBVIEW = (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID) ||
                           /JFlixNativeApp\/[\d.]+-X7K9Q2M/i.test(navigator.userAgent) ||
                           /JFlix-Android/i.test(navigator.userAgent) ||
                           localStorage.getItem('jflix_is_android') === 'true';
const IS_IOS_NATIVE = (typeof window.IS_IOS_APP !== 'undefined' && window.IS_IOS_APP === true) ||
                      (typeof window.IS_IOS_NATIVE !== 'undefined' && window.IS_IOS_NATIVE === true) ||
                      /JFlix-iOS/i.test(navigator.userAgent) ||
                      (/JFlixNativeApp/i.test(navigator.userAgent) && /iPhone|iPad|iPod/i.test(navigator.userAgent)) ||
                      (document.documentElement && document.documentElement.classList.contains('is-ios-app'));
const IS_NATIVE_APP = IS_ELECTRON || IS_ANDROID_WEBVIEW || IS_IOS_NATIVE;

// iOS/iPad PWA mode detection (standalone display mode on iOS devices)
const IS_IOS_PWA = (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) &&
                   (/iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                    (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent))) &&
                   !IS_IOS_NATIVE;

// In-app browser detection (Facebook, Messenger, Twitter, TikTok, Instagram)
const IS_IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBMessenger|Twitter|TikTok|Instagram/i.test(navigator.userAgent);

// System browser detection (all browsers: Chrome, Firefox, Safari, Edge, etc.)
// These should NOT show auth modal, only Get Premium button
const IS_SYSTEM_BROWSER = !IS_NATIVE_APP && !IS_IOS_PWA;

// Localhost detection (for development)
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Combined detection: auth modal only in native apps and localhost
// iOS PWA bypasses auth completely — full access with Get Premium button
const SHOULD_SHOW_AUTH_MODAL = (IS_NATIVE_APP || IS_LOCALHOST) && !IS_IOS_PWA;

// Platforms that should use Supabase auth (Android, Electron, and localhost)
const IS_ANDROID_WEBVIEW_OR_LOCALHOST = IS_ANDROID_WEBVIEW || IS_LOCALHOST || IS_IOS_NATIVE;
const IS_SUPABASE_PLATFORM = IS_ANDROID_WEBVIEW || IS_LOCALHOST || IS_ELECTRON || IS_IOS_NATIVE;

// ── STRICT: Platform gating ─────────────────────────────────────────────────────
// Web/in-app browsers: expose minimal read-only API, skip full auth init
if ((!IS_NATIVE_APP && !IS_LOCALHOST && !IS_IOS_PWA) || IS_IN_APP_BROWSER) {
  console.log('[Auth] Web/in-app browser detected — exposing minimal read-only API');
  window.jflixAuth = {
    isAuthenticated: () => false,
    user: null,
    token: null,
    openAuthModal: () => console.log('[Auth] Auth modal not available in web browser'),
    closeAuthModal: () => {},
    logout: () => {},
    fetchCurrentUser: async () => null,
    updateAuthUI: () => {}
  };
} else {
  // ── Native apps / localhost / iOS PWA: full auth initialization ───────────────
  
  // iOS PWA: Bypass auth entirely, expose mock authenticated API
  if (IS_IOS_PWA) {
  console.log('[Auth] iOS PWA mode detected — bypassing auth, full access granted');
  window.jflixAuth = {
    isAuthenticated: () => true,
    isPremium: () => false, // iOS PWA users can see Get Premium button
    user: { id: 'ios-pwa-user', name: 'iOS PWA User', email: 'ios@pwa.local' },
    token: 'ios-pwa-token',
    openAuthModal: () => {},
    closeAuthModal: () => {},
    logout: () => {},
    fetchCurrentUser: async () => window.jflixAuth.user,
    updateAuthUI: () => {}
  };
  // Don't throw — allow script to continue for iOS PWA
}

// Hide Adsterra ads in native Android app
if (IS_ANDROID_WEBVIEW) {
  // Function to hide Adsterra ads
  function hideAdsterraAds() {
    // Remove Adsterra script tags
    const adScripts = document.querySelectorAll('script[src*="heavinessslight.com"]');
    adScripts.forEach(script => script.remove());

    // Remove Adsterra container divs
    const adContainers = document.querySelectorAll('div[id*="container-"]');
    adContainers.forEach(container => container.remove());

    // Also hide any iframes created by Adsterra
    const adIframes = document.querySelectorAll('iframe[src*="heavinessslight.com"]');
    adIframes.forEach(iframe => iframe.remove());
  }

  // Run immediately and also on DOMContentLoaded to catch dynamically loaded ads
  hideAdsterraAds();
  document.addEventListener('DOMContentLoaded', hideAdsterraAds);
  document.addEventListener('load', hideAdsterraAds);
}

class JFlixAuth {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'https://jflix-api.junrel-sapantaicloud.workers.dev/api';
    this.token = null;
    this.user = null;
    this.googleClientId = null;
    this._heartbeatInterval = null;
    this._unreadBadgeInterval = null;
    this._lastUnreadCount = 0;
    this._restorePromise = null;
    this._lastRestoreAttempt = 0;
    this.init();
  }

  // Initialize auth state from localStorage
  init() {
    try {
      this.token = localStorage.getItem('jflix_auth_token');
      const userData = localStorage.getItem('jflix_user');
      if (userData) {
        try {
          this.user = JSON.parse(userData);
        } catch (e) {
          console.error('[Auth] Failed to parse user data:', e);
          localStorage.removeItem('jflix_user');
        }
      }
      
      // Start polling for unread badges if authenticated
      if (this.isAuthenticated()) {
        this._startUnreadBadgePolling();
        this._startHeartbeat();
        // Request notification permission for PWA
        this.requestNotificationPermission();
      }

      // Stay signed in across app restarts: if the cached backend token is
      // missing/expiring, silently re-mint it from the persisted Supabase
      // session (works for email AND Google — no login screen). Fire-and-
      // forget; the UI flips to signed-in on success via updateAuthUI().
      try {
        if (this._tokenNeedsRefresh(48 * 3600 * 1000)) {
          this.restoreSessionSilently();
        }
      } catch (e) { /* never block startup on restore */ }
    } catch (e) {
      console.error('[Auth] Init error:', e);
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // Get current user
  getCurrentUser() {
    return this.user;
  }

  // Get auth token
  getToken() {
    return this.token;
  }

  // Read the backend JWT expiry (ms epoch). 0 when missing/unparseable.
  getTokenExpiryMs() {
    try {
      if (!this.token) return 0;
      const parts = this.token.split('.');
      if (parts.length !== 3) return 0;
      // base64url -> base64 (restore stripped padding first)
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const payload = JSON.parse(atob(b64));
      return (payload.exp || 0) * 1000;
    } catch (e) {
      return 0;
    }
  }

  // True when there is no usable backend token (missing, expired, or expiring
  // within `withinMs`). Backend sessions live ~7 days and are never extended,
  // so apps must silently re-mint them instead of asking the user to sign in.
  _tokenNeedsRefresh(withinMs) {
    if (!this.token || !this.user) return true;
    const exp = this.getTokenExpiryMs();
    if (!exp) return true; // unknown shape — try a refresh rather than fail
    return exp - Date.now() < (withinMs || 0);
  }

  // Silently restore the backend session from the persisted Supabase session
  // (localStorage, auto-refreshed by the Supabase SDK). Covers BOTH email and
  // Google sign-ins since every flow goes through Supabase. No password is
  // stored anywhere and the user sees no login screen.
  // Returns a promise<boolean>; concurrent callers share one attempt, and
  // attempts are throttled to at most one per minute.
  restoreSessionSilently() {
    const now = Date.now();
    if (this._restorePromise) return this._restorePromise;
    if (now - this._lastRestoreAttempt < 60000) return Promise.resolve(false);
    this._lastRestoreAttempt = now;
    this._restorePromise = (async () => {
      try {
        if (typeof getSupabaseAuthInstance !== 'function') return false;
        const sb = getSupabaseAuthInstance();
        // getCurrentSession lets the SDK refresh an expired access token first
        const session = await sb.getCurrentSession();
        if (!session) {
          console.log('[Auth] Silent restore: no Supabase session saved');
          return false;
        }
        const backendData = await sb.syncWithBackend(session);
        if (backendData && backendData.success && backendData.token) {
          this.token = backendData.token;
          this.user = backendData.user;
          this._startHeartbeat();
          this._startUnreadBadgePolling();
          this.updateAuthUI();
          try {
            if (typeof this.closeAuthModal === 'function') this.closeAuthModal();
          } catch (e) { /* ignore */ }
          console.log('[Auth] Silent session restore succeeded');
          return true;
        }
        console.log('[Auth] Silent restore: backend sync failed');
        return false;
      } catch (e) {
        console.log('[Auth] Silent restore unavailable:', (e && e.message) || e);
        return false;
      } finally {
        this._restorePromise = null;
      }
    })();
    return this._restorePromise;
  }

  // Handle Supabase OAuth callback after Google redirect
  async handleSupabaseOAuthCallback() {
    console.log('[Auth] Checking for Supabase OAuth callback...');
    
    // Check if URL has OAuth tokens in hash
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) {
      console.log('[Auth] No OAuth tokens in URL hash');
      return false;
    }

    console.log('[Auth] OAuth tokens detected in URL hash, processing...');

    try {
      if (typeof getSupabaseAuthInstance !== 'function') {
        console.error('[Auth] getSupabaseAuthInstance is not available. Cannot process OAuth callback.');
        return;
      }
      const sb = getSupabaseAuthInstance();
      const supabase = await sb.getClient();
      
      // Get the session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Auth] Error getting Supabase session:', error);
        return false;
      }

      if (!session) {
        console.error('[Auth] No session found after OAuth redirect');
        return false;
      }

      console.log('[Auth] Supabase session obtained, syncing with backend...');

      // Sync with JFlix backend
      const backendData = await sb.syncWithBackend(session);
      
      if (backendData && backendData.success) {
        console.log('[Auth] Backend sync successful');
        
        // Update auth state
        this.token = backendData.token;
        this.user = backendData.user;
        
        // Update UI
        this.updateAuthUI();
        
        // Close auth modal if open
        this.closeAuthModal();
        
        // Show welcome message
        this.showWelcomeMessage();
        
        // AGGRESSIVE BLOCKING: If server says blockAccess, show premium modal
        if (backendData.blockAccess === true) {
          console.log('[Auth] Server returned blockAccess=true - activating premium gate');
          if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = true;
          setTimeout(() => {
            if (typeof openPremiumModal === 'function') openPremiumModal();
          }, 100);
        }
        
        // Clear URL hash
        window.history.replaceState({}, document.title, window.location.pathname);
        
        return true;
      } else {
        console.error('[Auth] Backend sync failed:', backendData?.error);
        return false;
      }
    } catch (error) {
      console.error('[Auth] OAuth callback error:', error);
      return false;
    }
  }

  // Fetch current user profile from server
  async fetchCurrentUser() {
    if (!this.token) return null;

    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (!response.ok) {
        console.error('[Auth] fetchCurrentUser HTTP error:', response.status);
        if (response.status === 401) {
          if (IS_NATIVE_APP) {
            // Native apps (Electron/Android) should not be logged out automatically.
            // Keep the cached token/user from localStorage so the user stays signed in.
            console.warn('[Auth] Token check returned 401 in native app. Keeping cached localStorage auth to prevent accidental logout.');
            // Best-effort: silently mint a fresh backend token for next time.
            try { this.restoreSessionSilently(); } catch (e) { /* ignore */ }
            return this.user || null;
          }
          // Token expired, clear auth state
          this.logout();
          return null;
        }
        return null;
      }

      const data = await response.json();
      console.log('[Auth] fetchCurrentUser response:', data);

      if (data.success) {
        this.user = data.user;
        localStorage.setItem('jflix_user', JSON.stringify(data.user));
        if (this.user && (this.user.user_id || this.user.id)) {
          localStorage.setItem('jflix_user_id', this.user.user_id || this.user.id);
        }
        console.log('[Auth] User updated. subscription_type:', this.user?.subscription_type);

        // AGGRESSIVE BLOCKING: If server says blockAccess, show premium modal
        if (data.blockAccess === true) {
          console.log('[Auth] Server returned blockAccess=true - user needs premium');
          if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = true;
          setTimeout(() => {
            if (typeof openPremiumModal === 'function') openPremiumModal();
          }, 100);
        } else if (data.blockAccess === false) {
          console.log('[Auth] Server returned blockAccess=false - user has premium access');
          if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = false;
          // Close premium modal if it's open
          const premiumModal = document.getElementById('prem-modal');
          if (premiumModal && premiumModal.style.display === 'flex') {
            if (typeof closePremiumModal === 'function') closePremiumModal();
          }
        }

        return data.user;
      } else if (response.status === 401) {
        // Token expired - don't automatically logout, just return null
        console.log('[Auth] Token expired, but not auto-logging out');
        return null;
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
    return null;
  }

  // Update user profile
  async updateProfile(profileData) {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.apiUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(profileData)
      });

      const data = await response.json();

      if (data.success) {
        // Refresh user data
        await this.fetchCurrentUser();
        return data;
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }

  // Check subscription status and update UI accordingly
  async checkSubscriptionStatus() {
    if (!this.token) return null;

    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        this.user = data.user;
        localStorage.setItem('jflix_user', JSON.stringify(data.user));
        
        // Update UI based on subscription status
        this.updateAuthUI();
        
        // Handle premium gate
        if (data.blockAccess === true) {
          if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = true;
          setTimeout(() => {
            if (typeof openPremiumModal === 'function') openPremiumModal();
          }, 100);
        } else if (data.blockAccess === false) {
          if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = false;
          const premiumModal = document.getElementById('prem-modal');
          if (premiumModal && premiumModal.style.display === 'flex') {
            if (typeof closePremiumModal === 'function') closePremiumModal();
          }
        }
        
        return {
          isPremium: !data.blockAccess,
          subscriptionType: data.user.subscription_type,
          subscriptionExpiresAt: data.user.subscription_expires_at,
        };
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error);
    }
    return null;
  }

  // Logout
  async logout() {
    try {
      // Sign out from Supabase if using Supabase auth (Android, Electron, and localhost)
      if (IS_SUPABASE_PLATFORM) {
        try {
          if (typeof getSupabaseAuthInstance === 'function') {
            const sb = getSupabaseAuthInstance();
            await sb.signOut();
          }
        } catch (error) {
          console.error('[Auth] Supabase logout error:', error);
        }
      }

      if (this.token) {
        try {
          await fetch(`${this.apiUrl}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`
            }
          });
        } catch (error) {
          console.error('[Auth] Logout error:', error);
        }
      }

      // Clear local storage
      localStorage.removeItem('jflix_auth_token');
      localStorage.removeItem('jflix_user');
      localStorage.removeItem('jflix_user_id');
      this.token = null;
      this.user = null;
      this._stopHeartbeat();
      this._stopUnreadBadgePolling();

      // Update UI
      this.updateAuthUI();

      // Refresh nickname manager after logout
      if (window.nicknameManager) {
        window.nicknameManager.refresh();
        if (window.playerAPI) {
          window.playerAPI.setUserContext(window.nicknameManager.getUserId(), window.nicknameManager.getNickname());
        }
      }

      // In Electron/Android, immediately re-trigger the gate so sign-in modal shows
      if (typeof SHOULD_SHOW_AUTH_MODAL !== 'undefined' && SHOULD_SHOW_AUTH_MODAL && typeof window._onElectronAuthSuccess === 'function') {
        if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = false;
        setTimeout(function() {
          if (typeof runElectronGate === 'function') runElectronGate();
        }, 300);
      }

      // Redirect to home if on profile page
      if (window.location.pathname.includes('profile')) {
        window.location.href = 'index.html';
      }
    } catch (error) {
      console.error('[Auth] Logout exception:', error);
      // Still clear local data even if logout fails
      localStorage.removeItem('jflix_auth_token');
      localStorage.removeItem('jflix_user');
      localStorage.removeItem('jflix_user_id');
      this.token = null;
      this.user = null;
      this._stopHeartbeat();
      this._stopUnreadBadgePolling();
    }
  }

  // Ensure profile element exists in .navbar-right on every page
  ensureNavbarProfile() {
    const navbarRights = document.querySelectorAll('.navbar-right');
    const defaultAvatarSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Ccircle fill='%231a1d2e' cx='17' cy='17' r='17' stroke='%23e50914' stroke-width='2'/%3E%3Cpath fill='%23ffffff' d='M17 9a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 11c-4.2 0-8 2.2-8 5.5v1.5h16v-1.5c0-3.3-3.8-5.5-8-5.5z'/%3E%3C/svg%3E";
    navbarRights.forEach(navbarRight => {
      let userMenu = navbarRight.querySelector('.user-menu');
      if (!userMenu) {
        userMenu = document.createElement('div');
        userMenu.className = 'user-menu';
        userMenu.style.cssText = 'display: flex; margin-left: 12px; align-items: center;';
        userMenu.innerHTML = `
          <a href="profile.html" data-no-loader style="display: flex; align-items: center; gap: 8px; text-decoration: none; position: relative;" title="Profile" aria-label="Profile">
            <img src="${defaultAvatarSvg}" alt="Profile" class="user-avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid #e50914;">
            <span id="header-profile-unread-badge" style="position:absolute;top:-4px;right:-4px;background:#e50914;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;">0</span>
            <span class="user-name" style="color: #fff; font-size: 13px; font-weight: 500;"></span>
          </a>
        `;
        navbarRight.appendChild(userMenu);
      }
    });
  }

  // Update authentication UI across the site
  updateAuthUI() {
    this.ensureNavbarProfile();

    // Find all auth-related elements
    const authButtons = document.querySelectorAll('.auth-buttons');
    const userMenus = document.querySelectorAll('.user-menu');
    const getPremiumBtns = document.querySelectorAll('.get-premium-btn');

    // In web browser (non-Electron/Android web/localhost/iOS native): always hide auth UI — handled by monetization.js
    if (!SHOULD_SHOW_AUTH_MODAL) {
      authButtons.forEach(el => el.style.setProperty('display', 'none', 'important'));
      userMenus.forEach(el => el.style.setProperty('display', 'none', 'important'));
      getPremiumBtns.forEach(el => el.style.setProperty('display', 'none', 'important'));
      return;
    }

    const defaultAvatarSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='34' height='34' viewBox='0 0 34 34'%3E%3Ccircle fill='%231a1d2e' cx='17' cy='17' r='17' stroke='%23e50914' stroke-width='2'/%3E%3Cpath fill='%23ffffff' d='M17 9a4.5 4.5 0 100 9 4.5 4.5 0 000-9zm0 11c-4.2 0-8 2.2-8 5.5v1.5h16v-1.5c0-3.3-3.8-5.5-8-5.5z'/%3E%3C/svg%3E";

    if (this.isAuthenticated()) {
      // User is logged in — keep session heartbeat alive
      this._startHeartbeat();
      authButtons.forEach(el => el.style.setProperty('display', 'none', 'important'));
      userMenus.forEach(el => {
        el.style.setProperty('display', 'flex', 'important');
        // Update avatar and name
        const avatar = el.querySelector('.user-avatar');
        const name = el.querySelector('.user-name');
        const link = el.querySelector('a');
        if (link) {
          link.setAttribute('title', (this.user && (this.user.nickname || this.user.name)) || 'Profile');
          link.setAttribute('aria-label', 'View Profile');
        }
        // Use Google picture (avatar), Supabase avatarUrl, or fallback
        if (avatar) {
          avatar.src = this.user.picture || this.user.avatarUrl || defaultAvatarSvg;
          avatar.alt = this.user.nickname || 'Profile';
        }
        if (name && this.user.nickname) name.textContent = this.user.nickname;
        
        // Check if user is premium
        const isPremium = this.user.subscriptionType === 'premium' || this.user.subscription_type === 'premium';
        const expiryDate = this.user.subscriptionExpiresAt || this.user.subscription_expires_at;
        const isExpired = expiryDate && new Date(expiryDate) < new Date();
        
        const shouldShowCrown = isPremium && !isExpired;
        
        if (shouldShowCrown) {
          // Apply premium styling to avatar
          if (avatar) {
            avatar.style.border = '2px solid #FFD700';
            avatar.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
          }
          
          // Add crown icon to user menu
          if (!el.querySelector('.premium-crown')) {
            const crown = document.createElement('i');
            crown.className = 'fas fa-crown premium-crown';
            crown.style.cssText = 'color: #FFD700; font-size: 12px; margin-left: 4px;';
            const nameEl = el.querySelector('.user-name');
            if (nameEl) {
              nameEl.style.color = '#FFD700';
              nameEl.style.fontWeight = '600';
              nameEl.parentElement.appendChild(crown);
            }
          }
        } else {
          // Remove premium styling if not premium or expired
          if (avatar) {
            avatar.style.border = '2px solid rgba(255,255,255,0.2)';
            avatar.style.boxShadow = 'none';
          }
          const crown = el.querySelector('.premium-crown');
          if (crown) crown.remove();
          const nameEl = el.querySelector('.user-name');
          if (nameEl) {
            nameEl.style.color = '#fff';
            nameEl.style.fontWeight = '400';
          }
        }
      });
      
      // Update unread message count badges
      updateUnreadMessageCount();
      
      // Hide Get Premium button for premium users or on iOS app
      const isPremium = this.user.subscriptionType === 'premium' || this.user.subscription_type === 'premium';
      const expiryDate = this.user.subscriptionExpiresAt || this.user.subscription_expires_at;
      const isExpired = expiryDate && new Date(expiryDate) < new Date();
      
      const shouldHidePremiumBtn = (isPremium && !isExpired) || IS_IOS_NATIVE;
      
      if (shouldHidePremiumBtn) {
        getPremiumBtns.forEach(el => el.style.setProperty('display', 'none', 'important'));
      } else {
        getPremiumBtns.forEach(el => el.style.setProperty('display', 'flex', 'important'));
      }

    } else {
      // User is logged out
      if (IS_IOS_NATIVE || IS_NATIVE_APP) {
        // In iOS and native apps with auth: ALWAYS keep the profile in the header!
        userMenus.forEach(el => {
          el.style.setProperty('display', 'flex', 'important');
          const avatar = el.querySelector('.user-avatar');
          const name = el.querySelector('.user-name');
          const crown = el.querySelector('.premium-crown');
          const link = el.querySelector('a');
          if (crown) crown.remove();
          if (avatar) {
            avatar.src = defaultAvatarSvg;
            avatar.style.border = '2px solid #e50914';
            avatar.style.boxShadow = 'none';
            avatar.alt = 'Sign In / Profile';
          }
          if (name) {
            name.textContent = 'Sign In';
          }
          if (link) {
            link.setAttribute('title', 'Sign In / Profile');
            link.setAttribute('aria-label', 'Sign In / Profile');
          }
        });
        // In iOS / native apps, profile avatar is the primary header action; hide redundant text button
        authButtons.forEach(el => el.style.setProperty('display', 'none', 'important'));
      } else {
        authButtons.forEach(el => el.style.setProperty('display', 'flex', 'important'));
        userMenus.forEach(el => el.style.setProperty('display', 'none', 'important'));
      }
      getPremiumBtns.forEach(el => el.style.setProperty('display', 'none', 'important'));

    }
  }

  // Create authentication modal
  createAuthModal() {
    // Check if modal already exists
    if (document.getElementById('auth-modal')) return;

    const electronNote = SHOULD_SHOW_AUTH_MODAL
      ? '<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:10px 14px;margin-bottom:18px;text-align:center;"><i class="fas fa-crown" style="color:#FFD700;margin-right:6px;"></i><span style="color:#cabd8f;font-size:12px;">Sign in to access JFlix Premium</span></div>'
      : '';
    const guestSection = (IS_ANDROID_WEBVIEW_OR_LOCALHOST || IS_ELECTRON) ? '' : `
          <!-- Divider -->
          <div style="display: flex; align-items: center; margin: 25px 0;">
            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
            <span style="color: #666; padding: 0 15px; font-size: 12px;">OR</span>
            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
          </div>
          <!-- Guest Option -->
          <button onclick="jflixAuth.closeAuthModal()" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">
            Continue as Guest
          </button>`;
    const closeBtn = SHOULD_SHOW_AUTH_MODAL ? '' : `<button onclick="jflixAuth.closeAuthModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #888; font-size: 24px; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#fff';" onmouseout="this.style.background='none'; this.style.color='#888';">&times;</button>`;

    const modalHTML = `
      <div id="auth-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:1000000;display:none;align-items:center;justify-content:center;backdrop-filter:blur(10px);">
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:20px;max-width:450px;width:90%;padding:40px;box-shadow:0 30px 100px rgba(0,0,0,0.6);border:1px solid rgba(229,9,20,0.3);position:relative;max-height:90vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent;">

          ${closeBtn}

          <!-- Logo -->
          <div style="text-align:center;margin-bottom:28px;">
            <img src="images/logo.svg" alt="JFlix" style="width:72px;height:72px;border-radius:16px;margin-bottom:14px;">
            <h2 style="color:#fff;margin:0;font-size:22px;font-weight:bold;">Welcome to JFlix</h2>
            <p style="color:#888;margin:8px 0 0;font-size:13px;">${IS_SUPABASE_PLATFORM ? 'Sign in to unlock premium access' : 'Sign in to access your profile and features'}</p>
          </div>

          ${electronNote}

          <!-- Google Sign-In -->
          <div id="supabase-google-signin-btn" style="display:flex;justify-content:center;margin-bottom:6px;"></div>
          <p style="text-align:center;color:#666;font-size:11px;margin:0 0 20px;">Sign in with your Google account</p>

          <!-- OR divider -->
          <div style="display:flex;align-items:center;margin:0 0 20px;">
            <div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div>
            <span style="color:#555;padding:0 14px;font-size:11px;letter-spacing:.5px;">OR</span>
            <div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div>
          </div>

          <!-- Email sign-in form (visible by default) -->
          <div id="email-signin-form" style="display:block;">
            <div style="margin-bottom:14px;">
              <label style="color:#888;font-size:12px;margin-bottom:5px;display:block;">Email</label>
              <input type="email" id="signin-email" placeholder="Enter your email" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:12px 15px;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:18px;">
              <label style="color:#888;font-size:12px;margin-bottom:5px;display:block;">Password</label>
              <input type="password" id="signin-password" placeholder="Enter your password" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:12px 15px;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <button onclick="jflixAuth.handleEmailSignIn()" style="width:100%;background:linear-gradient(135deg,#e50914 0%,#b20710 100%);border:none;color:#fff;padding:13px;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;transition:all 0.3s;margin-bottom:10px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 30px rgba(229,9,20,0.3)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';">
              Sign In with Email
            </button>
            <p style="text-align:center;color:#666;font-size:12px;margin:8px 0 4px;">
              <a href="#" onclick="jflixAuth.showForgotPasswordModal();return false;" style="color:#888;">Forgot password?</a>
            </p>
            <p style="text-align:center;color:#666;font-size:12px;margin:0;">
              Don't have an account? <a href="#" onclick="jflixAuth.toggleAuthTab('signup');return false;" style="color:#e50914;">Sign up</a>
            </p>
          </div>

          <!-- Email sign-up form (hidden by default) -->
          <div id="email-signup-form" style="display:none;">
            <div style="margin-bottom:14px;">
              <label style="color:#888;font-size:12px;margin-bottom:5px;display:block;">Name</label>
              <input type="text" id="signup-name" placeholder="Enter your name" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:12px 15px;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
              <label style="color:#888;font-size:12px;margin-bottom:5px;display:block;">Email</label>
              <input type="email" id="signup-email" placeholder="Enter your email" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:12px 15px;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
              <label style="color:#888;font-size:12px;margin-bottom:5px;display:block;">Password</label>
              <input type="password" id="signup-password" placeholder="Create a password" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:12px 15px;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:18px;">
              <label style="color:#888;font-size:12px;margin-bottom:5px;display:block;">Confirm Password</label>
              <input type="password" id="signup-confirm-password" placeholder="Confirm your password" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.2);color:#fff;padding:12px 15px;border-radius:8px;font-size:14px;box-sizing:border-box;">
            </div>
            <button onclick="jflixAuth.handleEmailSignUp()" style="width:100%;background:linear-gradient(135deg,#e50914 0%,#b20710 100%);border:none;color:#fff;padding:13px;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;transition:all 0.3s;margin-bottom:10px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 30px rgba(229,9,20,0.3)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';">
              Sign Up with Email
            </button>
            <p style="text-align:center;color:#666;font-size:12px;margin:0;">
              Already have an account? <a href="#" onclick="jflixAuth.toggleAuthTab('signin');return false;" style="color:#e50914;">Sign in</a>
            </p>
          </div>

          ${guestSection}

          <!-- Terms -->
          <p style="color:#555;font-size:11px;text-align:center;margin-top:20px;line-height:1.5;">
            By signing in, you agree to our <a href="terms.html" style="color:#e50914;">Terms of Service</a> and <a href="privacy.html" style="color:#e50914;">Privacy Policy</a>
          </p>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div);

    // Initialize Supabase Google Sign-In button
    this.initSupabaseGoogleButton();
  }

  // Initialize Supabase Google Sign-In button
  initSupabaseGoogleButton() {
    const container = document.getElementById('supabase-google-signin-btn');
    if (!container) return;

    // Check if button already exists
    if (document.getElementById('supabase-google-button')) {
      console.log('[Auth] Supabase Google button already initialized');
      return;
    }

    const button = document.createElement('button');
    button.id = 'supabase-google-button';
    button.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: #fff;
      color: #333;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
      max-width: 300px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    button.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.2c0-.637-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.159 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
      <span class="button-text">Sign in with Google</span>
    `;
    button.onmouseover = () => {
      if (!button.disabled) {
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        button.style.transform = 'translateY(-1px)';
      }
    };
    button.onmouseout = () => {
      if (!button.disabled) {
        button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        button.style.transform = 'translateY(0)';
      }
    };

    button.onclick = () => {
      if (button.disabled) return;
      
      button.disabled = true;
      button.style.opacity = '0.7';
      button.style.cursor = 'not-allowed';
      button.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="animation: spin 1s linear infinite;">
          <style>
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          </style>
          <circle cx="12" cy="12" r="10" stroke="#4285F4" stroke-width="3" fill="none" stroke-dasharray="31.4" stroke-dashoffset="31.4" style="animation: dash 1.5s ease-in-out infinite;">
            <style>
              @keyframes dash {
                0% { stroke-dashoffset: 31.4; }
                50% { stroke-dashoffset: 15.7; }
                100% { stroke-dashoffset: 31.4; }
              }
            </style>
          </circle>
        </svg>
        <span class="button-text">Signing in...</span>
      `;

      // Check if getSupabaseAuthInstance is available
      if (typeof getSupabaseAuthInstance !== 'function') {
        console.error('[Auth] getSupabaseAuthInstance is not available. Make sure supabase-auth.js is loaded.');
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.159 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span class="button-text">Sign in with Google</span>
        `;
        return;
      }

      const sb = getSupabaseAuthInstance();
      sb.signInWithGoogle((error, data) => {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
        button.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.252-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.159 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span class="button-text">Sign in with Google</span>
        `;

        if (error) {
          alert('Google sign in failed: ' + error.message);
        } else if (data && data.success && data.backendData) {
          // Existing session found — process sign-in directly
          console.log('[Auth] Supabase Google sign-in successful');
          const backendData = data.backendData;
          if (backendData && backendData.success) {
            jflixAuth.token = backendData.token;
            jflixAuth.user = backendData.user;
            jflixAuth.updateAuthUI();
            jflixAuth.closeAuthModal();
            jflixAuth.showWelcomeMessage();
            if (backendData.blockAccess === true) {
              if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = true;
              setTimeout(() => { if (typeof openPremiumModal === 'function') openPremiumModal(); }, 100);
            }
          }
        } else {
          console.log('[Auth] Supabase Google OAuth redirect initiated');
        }
      });
    };

    container.appendChild(button);
  }

  // Open auth modal
  openAuthModal() {
    // Hide auth modal in web browser - only accessible in Electron, Android web, and localhost
    if (typeof IS_WEB !== 'undefined' && IS_WEB) {
      return;
    }
    // Also check if not Electron/Android web/localhost (web browser fallback)
    if (!SHOULD_SHOW_AUTH_MODAL) {
      return;
    }
    this.createAuthModal();
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  // Close auth modal
  closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  // Direct toggle without password check
  toggleAuthTabDirect(tab) {
    const signinForm = document.getElementById('email-signin-form');
    const signupForm = document.getElementById('email-signup-form');

    if (tab === 'signin' || tab === 'google' || tab === 'email') {
      if (signinForm) signinForm.style.display = 'block';
      if (signupForm) signupForm.style.display = 'none';
    } else if (tab === 'signup') {
      if (signinForm) signinForm.style.display = 'none';
      if (signupForm) signupForm.style.display = 'block';
    }
  }

  // Toggle auth tab (Google/Email)
  toggleAuthTab(tab) {
    this.toggleAuthTabDirect(tab);
  }

  // Handle email sign-in
  async handleEmailSignIn() {
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;

    if (!email || !password) {
      alert('Please enter email and password');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Get the sign-in button and show loading state
    const signinButton = document.querySelector('#email-signin-form button');
    let originalText = '';
    if (signinButton) {
      signinButton.disabled = true;
      signinButton.style.opacity = '0.7';
      signinButton.style.cursor = 'not-allowed';
      originalText = signinButton.innerHTML;
      signinButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    }

    try {
      // Check if email exists with Google sign-in before attempting Supabase sign-in
      const checkResponse = await fetch(`${this.apiUrl}/auth/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.exists && checkData.hasGoogleId) {
          // Email exists with Google account - show conflict modal
          if (signinButton) {
            signinButton.disabled = false;
            signinButton.style.opacity = '1';
            signinButton.style.cursor = 'pointer';
            signinButton.innerHTML = originalText;
          }
          this.showGoogleEmailConflictModal(email);
          return;
        }
      }

      // Sign in with Supabase
      let supabaseClient = window.SupabaseConfig ? window.SupabaseConfig.getSupabaseClient() : null;
      if (!supabaseClient) {
        await window.SupabaseConfig.loadSupabaseSDK();
        supabaseClient = window.SupabaseConfig.getSupabaseClient();
      }

      if (!supabaseClient) {
        throw new Error('Failed to initialize Supabase client');
      }

      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        // Reset button on error
        if (signinButton) {
          signinButton.disabled = false;
          signinButton.style.opacity = '1';
          signinButton.style.cursor = 'pointer';
          signinButton.innerHTML = originalText;
        }
        alert('Sign in failed: ' + error.message);
        return;
      }

      // Sync with backend
      const syncResponse = await fetch(`${this.apiUrl}/auth/supabase/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supabaseAccessToken: data.session.access_token,
          email: data.user.email,
          supabaseUserId: data.user.id
        })
      });

      if (!syncResponse.ok) {
        const errorText = await syncResponse.text();
        throw new Error(`Sync failed: ${syncResponse.status} - ${errorText}`);
      }

      const syncData = await syncResponse.json();

      if (syncData.success) {
        this.token = syncData.token;
        this.user = syncData.user;
        localStorage.setItem('jflix_auth_token', this.token);
        localStorage.setItem('jflix_user', JSON.stringify(this.user));
        localStorage.setItem('jflix_user_id', this.user.user_id || this.user.id || '');
        this.closeAuthModal();
        this.updateAuthUI();
        
        // AGGRESSIVE BLOCKING: If server says blockAccess, show premium modal
        if (syncData.blockAccess) {
          if (typeof openPremiumModal === 'function') {
            openPremiumModal();
          }
        }
      } else {
        // Reset button on sync error
        if (signinButton) {
          signinButton.disabled = false;
          signinButton.style.opacity = '1';
          signinButton.style.cursor = 'pointer';
          signinButton.innerHTML = originalText;
        }
        alert('Sync failed: ' + syncData.error);
      }
    } catch (error) {
      console.error('Email sign-in error:', error);
      // Reset button on error
      if (signinButton) {
        signinButton.disabled = false;
        signinButton.style.opacity = '1';
        signinButton.style.cursor = 'pointer';
        signinButton.innerHTML = originalText;
      }
      alert('Sign in failed: ' + error.message);
    }
  }

  // Handle email sign-up
  async handleEmailSignUp() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (!name || !email || !password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Check email domain restriction (client-side pre-check for instant feedback)
    try {
      if (!jflixAuth._emailDomainSettingCache) {
        const res = await fetch(`${this.apiUrl}/admin/settings`);
        if (res.ok) {
          const d = await res.json();
          jflixAuth._emailDomainSettingCache = (d.settings && d.settings.email_domain_restriction) || 'disabled';
        } else {
          jflixAuth._emailDomainSettingCache = 'disabled';
        }
      }
      if (jflixAuth._emailDomainSettingCache === 'enabled') {
        const ALLOWED = ['gmail.com','outlook.com','yahoo.com','proton.me','icloud.com','deped.gov.ph'];
        const domain = email.toLowerCase().split('@')[1] || '';
        if (!ALLOWED.includes(domain)) {
          alert('Only Gmail, Outlook, Yahoo, Proton, iCloud, and DepEd email addresses are accepted for sign up.');
          return;
        }
      }
    } catch (_) { /* fail open — server enforces */ }

    // Validate password strength
    if (password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Get the sign-up button and show loading state
    const signupButton = document.querySelector('#email-signup-form button');
    let originalText = '';
    if (signupButton) {
      signupButton.disabled = true;
      signupButton.style.opacity = '0.7';
      signupButton.style.cursor = 'not-allowed';
      originalText = signupButton.innerHTML;
      signupButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing up...';
    }

    try {
      // Check if email exists
      const checkResponse = await fetch(`${this.apiUrl}/auth/check-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!checkResponse.ok) {
        throw new Error(`Email check failed: ${checkResponse.status}`);
      }

      const checkData = await checkResponse.json();

      if (checkData.exists && checkData.hasGoogleId) {
        // Reset button before showing conflict modal
        if (signupButton) {
          signupButton.disabled = false;
          signupButton.style.opacity = '1';
          signupButton.style.cursor = 'pointer';
          signupButton.innerHTML = originalText;
        }
        // Email exists with Google account - show conflict modal
        this.showGoogleEmailConflictModal(email);
        return;
      }

      // For Electron/Android: use backend endpoint that bypasses email verification
      if (IS_SUPABASE_PLATFORM) {
        const signupResponse = await fetch(`${this.apiUrl}/auth/supabase/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            password: password,
            displayName: name
          })
        });

        if (!signupResponse.ok) {
          const errorText = await signupResponse.text();
          const errorData = await signupResponse.json().catch(() => ({}));
          
          // Reset button on error
          if (signupButton) {
            signupButton.disabled = false;
            signupButton.style.opacity = '1';
            signupButton.style.cursor = 'pointer';
            signupButton.innerHTML = originalText;
          }

          // Check if this is a Google account conflict
          if (errorData.requiresPasswordLink && errorData.existingProvider === 'google') {
            this.showGoogleEmailConflictModal(email);
            return;
          }

          throw new Error(`Signup failed: ${signupResponse.status} - ${errorText}`);
        }

        const signupData = await signupResponse.json();

        if (signupData.success) {
          this.token = signupData.token;
          this.user = signupData.user;
          localStorage.setItem('jflix_auth_token', this.token);
          localStorage.setItem('jflix_user', JSON.stringify(this.user));
          localStorage.setItem('jflix_user_id', this.user.user_id || this.user.id || '');
          this.closeAuthModal();
          this.updateAuthUI();

          // AGGRESSIVE BLOCKING: If server says blockAccess, show premium modal
          if (signupData.blockAccess) {
            if (typeof openPremiumModal === 'function') {
              openPremiumModal();
            }
          }
        } else {
          // Reset button on error
          if (signupButton) {
            signupButton.disabled = false;
            signupButton.style.opacity = '1';
            signupButton.style.cursor = 'pointer';
            signupButton.innerHTML = originalText;
          }
          alert('Sign up failed: ' + signupData.error);
        }
      } else {
        // For web: use Supabase direct sign-up with email verification
        let supabaseClient = window.SupabaseConfig ? window.SupabaseConfig.getSupabaseClient() : null;
        if (!supabaseClient) {
          await window.SupabaseConfig.loadSupabaseSDK();
          supabaseClient = window.SupabaseConfig.getSupabaseClient();
        }
        
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: window.location.href,
            data: {
              full_name: name
            }
          }
        });

        if (error) {
          // Reset button on error
          if (signupButton) {
            signupButton.disabled = false;
            signupButton.style.opacity = '1';
            signupButton.style.cursor = 'pointer';
            signupButton.innerHTML = originalText;
          }
          alert('Sign up failed: ' + error.message);
          return;
        }

        if (!data.session) {
          // Reset button on success (no session means email verification needed)
          if (signupButton) {
            signupButton.disabled = false;
            signupButton.style.opacity = '1';
            signupButton.style.cursor = 'pointer';
            signupButton.innerHTML = originalText;
          }
          alert('Please check your email to verify your account');
          return;
        }

        // Sync with backend
        const syncResponse = await fetch(`${this.apiUrl}/auth/supabase/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            supabaseAccessToken: data.session.access_token,
            email: data.user.email,
            supabaseUserId: data.user.id
          })
        });

        const syncData = await syncResponse.json();

        if (syncData.success) {
          this.token = syncData.token;
          this.user = syncData.user;
          localStorage.setItem('jflix_auth_token', this.token);
          localStorage.setItem('jflix_user', JSON.stringify(this.user));
          localStorage.setItem('jflix_user_id', this.user.user_id || this.user.id || '');
          this.closeAuthModal();
          this.updateAuthUI();
          
          // AGGRESSIVE BLOCKING: If server says blockAccess, show premium modal
          if (syncData.blockAccess) {
            if (typeof openPremiumModal === 'function') {
              openPremiumModal();
            }
          }
        } else {
          // Reset button on sync error
          if (signupButton) {
            signupButton.disabled = false;
            signupButton.style.opacity = '1';
            signupButton.style.cursor = 'pointer';
            signupButton.innerHTML = originalText;
          }
          alert('Sync failed: ' + syncData.error);
        }
      }
    } catch (error) {
      console.error('Email sign-up error:', error);
      // Reset button on error
      if (signupButton) {
        signupButton.disabled = false;
        signupButton.style.opacity = '1';
        signupButton.style.cursor = 'pointer';
        signupButton.innerHTML = originalText;
      }
      alert('Sign up failed: ' + error.message);
    }
  }

  // Show password creation modal for existing Google users
  // Load password link modal HTML
  async loadPasswordLinkModal() {
    if (document.getElementById('password-link-modal')) {
      return; // Already loaded
    }

    try {
      const response = await fetch('password-link-modal.html');
      const html = await response.text();
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div);
    } catch (error) {
      console.error('Error loading password link modal:', error);
    }
  }

  // Show Google email conflict modal
  showGoogleEmailConflictModal(email) {
    const modalHTML = `
      <div id="google-email-conflict-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 1000001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; max-width: 400px; width: 90%; padding: 30px; box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 215, 0, 0.3);">
          <div style="text-align: center; margin-bottom: 20px;">
            <i class="fab fa-google" style="font-size: 48px; color: #4285F4; margin-bottom: 15px;"></i>
            <h3 style="color: #fff; margin: 0 0 15px 0; font-size: 18px;">Email Already in Use</h3>
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;">
              The email <strong style="color: #FFD700;">${email}</strong> is already registered with Google Sign-In.
            </p>
            <p style="color: #ccc; margin: 0 0 25px 0; font-size: 14px; line-height: 1.5;">
              Please sign in with Google or use a different email address.
            </p>
          </div>
          <button onclick="jflixAuth.closeGoogleEmailConflictModal(); jflixAuth.triggerSupabaseGoogleSignIn();" style="width: 100%; background: #4285F4; border: none; color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s; margin-bottom: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(66,133,244,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <i class="fab fa-google" style="margin-right: 8px;"></i> Sign In with Google
          </button>
          <button onclick="jflixAuth.closeGoogleEmailConflictModal();" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">
            Use Different Email
          </button>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div);
  }

  closeGoogleEmailConflictModal() {
    const modal = document.getElementById('google-email-conflict-modal');
    if (modal) {
      modal.remove();
    }
  }

  // Trigger Supabase Google sign-in programmatically
  triggerSupabaseGoogleSignIn() {
    const googleButton = document.getElementById('supabase-google-button');
    if (googleButton) {
      googleButton.click();
    } else {
      console.error('[Auth] Supabase Google button not found');
      // Fallback: open auth modal and switch to Google tab
      this.openAuthModal();
      this.toggleAuthTab('google');
    }
  }

  // Show forgot password modal
  showForgotPasswordModal() {
    const modalHTML = `
      <div id="forgot-password-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 1000001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; max-width: 400px; width: 90%; padding: 30px; box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6); border: 1px solid rgba(229, 9, 20, 0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="color: #fff; margin: 0; font-size: 18px;">Reset Password</h3>
            <button onclick="jflixAuth.closeForgotPasswordModal()" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer; padding: 0;">&times;</button>
          </div>

          <!-- Step 1: Enter Email -->
          <div id="forgot-step-1">
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;">
              Enter your email address and we'll send you a verification code to reset your password.
            </p>
            <div style="margin-bottom: 15px;">
              <label style="color: #888; font-size: 12px; margin-bottom: 5px; display: block;">Email</label>
              <input type="email" id="forgot-email" placeholder="Enter your email" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
            </div>
            <button onclick="jflixAuth.sendPasswordResetCode()" id="send-code-btn" style="width: 100%; background: linear-gradient(135deg, #e50914 0%, #b20710 100%); border: none; color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(229,9,20,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
              Send Verification Code
            </button>
          </div>

          <!-- Step 2: Enter Verification Code -->
          <div id="forgot-step-2" style="display: none;">
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;">
              Enter the 6-digit verification code sent to your email.
            </p>
            <div style="margin-bottom: 15px;">
              <label style="color: #888; font-size: 12px; margin-bottom: 5px; display: block;">Verification Code</label>
              <input type="text" id="forgot-verification-code" placeholder="Enter 6-digit code" maxlength="6" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; box-sizing: border-box; text-align: center; letter-spacing: 5px; font-size: 18px;">
            </div>
            <button onclick="jflixAuth.verifyPasswordResetCode()" id="verify-code-btn" style="width: 100%; background: linear-gradient(135deg, #e50914 0%, #b20710 100%); border: none; color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s; margin-bottom: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(229,9,20,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
              Verify Code
            </button>
            <button onclick="jflixAuth.resendPasswordResetCode()" id="resend-code-btn" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">
              Resend Code
            </button>
          </div>

          <!-- Step 3: Create New Password -->
          <div id="forgot-step-3" style="display: none;">
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5;">
              Create a new password for your account.
            </p>
            <div style="margin-bottom: 15px;">
              <label style="color: #888; font-size: 12px; margin-bottom: 5px; display: block;">New Password</label>
              <input type="password" id="forgot-new-password" placeholder="Enter new password" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="margin-bottom: 20px;">
              <label style="color: #888; font-size: 12px; margin-bottom: 5px; display: block;">Confirm Password</label>
              <input type="password" id="forgot-confirm-password" placeholder="Confirm new password" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
            </div>
            <button onclick="jflixAuth.resetPassword()" id="reset-password-btn" style="width: 100%; background: linear-gradient(135deg, #e50914 0%, #b20710 100%); border: none; color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(229,9,20,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
              Reset Password
            </button>
          </div>

          <!-- Success Message -->
          <div id="forgot-success" style="display: none; text-align: center;">
            <div style="margin-bottom: 20px;">
              <i class="fas fa-check-circle" style="font-size: 48px; color: #4CAF50;"></i>
            </div>
            <h4 style="color: #fff; margin: 0 0 10px 0; font-size: 16px;">Password Reset Successful</h4>
            <p style="color: #ccc; margin: 0 0 20px 0; font-size: 14px;">You can now sign in with your new password.</p>
            <button onclick="jflixAuth.closeForgotPasswordModal()" style="width: 100%; background: linear-gradient(135deg, #e50914 0%, #b20710 100%); border: none; color: #fff; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 30px rgba(229,9,20,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
              Done
            </button>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div);
  }

  closeForgotPasswordModal() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
      modal.remove();
    }
  }

  // Send password reset verification code
  async sendPasswordResetCode() {
    const email = document.getElementById('forgot-email').value;
    const sendButton = document.getElementById('send-code-btn');

    if (!email) {
      alert('Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Show loading state
    sendButton.disabled = true;
    sendButton.style.opacity = '0.7';
    sendButton.style.cursor = 'not-allowed';
    const originalText = sendButton.innerHTML;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
      const response = await fetch(`${this.apiUrl}/auth/password-reset/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() })
      });

      const data = await response.json();

      if (data.success) {
        // Store email for later steps
        this.forgotPasswordEmail = email;
        // Move to step 2
        document.getElementById('forgot-step-1').style.display = 'none';
        document.getElementById('forgot-step-2').style.display = 'block';
      } else {
        alert(data.error || 'Failed to send verification code');
        sendButton.disabled = false;
        sendButton.style.opacity = '1';
        sendButton.style.cursor = 'pointer';
        sendButton.innerHTML = originalText;
      }
    } catch (error) {
      console.error('Error sending password reset code:', error);
      alert('Failed to send verification code. Please try again.');
      sendButton.disabled = false;
      sendButton.style.opacity = '1';
      sendButton.style.cursor = 'pointer';
      sendButton.innerHTML = originalText;
    }
  }

  // Resend password reset code
  async resendPasswordResetCode() {
    const resendButton = document.getElementById('resend-code-btn');

    resendButton.disabled = true;
    resendButton.style.opacity = '0.7';
    resendButton.style.cursor = 'not-allowed';
    const originalText = resendButton.innerHTML;
    resendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resending...';

    try {
      const response = await fetch(`${this.apiUrl}/auth/password-reset/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: this.forgotPasswordEmail })
      });

      const data = await response.json();

      if (data.success) {
        alert('Verification code resent successfully');
      } else {
        alert(data.error || 'Failed to resend verification code');
      }
    } catch (error) {
      console.error('Error resending password reset code:', error);
      alert('Failed to resend verification code. Please try again.');
    } finally {
      resendButton.disabled = false;
      resendButton.style.opacity = '1';
      resendButton.style.cursor = 'pointer';
      resendButton.innerHTML = originalText;
    }
  }

  // Verify password reset code
  async verifyPasswordResetCode() {
    const code = document.getElementById('forgot-verification-code').value;
    const verifyButton = document.getElementById('verify-code-btn');

    if (!code || code.length !== 6) {
      alert('Please enter the 6-digit verification code');
      return;
    }

    verifyButton.disabled = true;
    verifyButton.style.opacity = '0.7';
    verifyButton.style.cursor = 'not-allowed';
    const originalText = verifyButton.innerHTML;
    verifyButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
      const response = await fetch(`${this.apiUrl}/auth/password-reset/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.forgotPasswordEmail,
          code: code
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store verified code for password reset
        this.forgotPasswordCode = code;
        // Move to step 3
        document.getElementById('forgot-step-2').style.display = 'none';
        document.getElementById('forgot-step-3').style.display = 'block';
      } else {
        alert(data.error || 'Invalid verification code');
        verifyButton.disabled = false;
        verifyButton.style.opacity = '1';
        verifyButton.style.cursor = 'pointer';
        verifyButton.innerHTML = originalText;
      }
    } catch (error) {
      console.error('Error verifying password reset code:', error);
      alert('Failed to verify code. Please try again.');
      verifyButton.disabled = false;
      verifyButton.style.opacity = '1';
      verifyButton.style.cursor = 'pointer';
      verifyButton.innerHTML = originalText;
    }
  }

  // Reset password
  async resetPassword() {
    const newPassword = document.getElementById('forgot-new-password').value;
    const confirmPassword = document.getElementById('forgot-confirm-password').value;
    const resetButton = document.getElementById('reset-password-btn');

    if (!newPassword || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    resetButton.disabled = true;
    resetButton.style.opacity = '0.7';
    resetButton.style.cursor = 'not-allowed';
    const originalText = resetButton.innerHTML;
    resetButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';

    try {
      const response = await fetch(`${this.apiUrl}/auth/password-reset/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.forgotPasswordEmail,
          code: this.forgotPasswordCode,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        // Show success message
        document.getElementById('forgot-step-3').style.display = 'none';
        document.getElementById('forgot-success').style.display = 'block';
      } else {
        alert(data.error || 'Failed to reset password');
        resetButton.disabled = false;
        resetButton.style.opacity = '1';
        resetButton.style.cursor = 'pointer';
        resetButton.innerHTML = originalText;
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Failed to reset password. Please try again.');
      resetButton.disabled = false;
      resetButton.style.opacity = '1';
      resetButton.style.cursor = 'pointer';
      resetButton.innerHTML = originalText;
    }
  }

  showPasswordCreationModal(email) {
    const modalHTML = `
      <div id="password-creation-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 1000001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; max-width: 400px; width: 90%; padding: 30px; box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 215, 0, 0.3);">
          <h3 style="color: #fff; margin: 0 0 15px 0; font-size: 18px;">Link Your Account</h3>
          <p style="color: #888; font-size: 13px; margin-bottom: 20px; line-height: 1.5;">
            This email is already registered with Google Sign-In. Create a password to link your email/password login with your existing account. A confirmation link will be sent to your email to verify this action.
          </p>
          <div style="margin-bottom: 15px;">
            <label style="color: #888; font-size: 12px; margin-bottom: 5px; display: block;">Password</label>
            <input type="password" id="link-password" placeholder="Create a password" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 20px;">
            <label style="color: #888; font-size: 12px; margin-bottom: 5px; display: block;">Confirm Password</label>
            <input type="password" id="link-confirm-password" placeholder="Confirm your password" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 15px; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
          </div>
          <button onclick="jflixAuth.handleLinkPassword('${email}')" style="width: 100%; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); border: none; color: #000; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s; margin-bottom: 10px;">
            Send Confirmation Link
          </button>
          <button onclick="document.getElementById('password-creation-modal').remove()" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px; border-radius: 10px; font-size: 14px; cursor: pointer; transition: all 0.3s;">
            Cancel
          </button>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div);
  }

  // Handle password linking
  async handleLinkPassword(email) {
    const password = document.getElementById('link-password').value;
    const confirmPassword = document.getElementById('link-confirm-password').value;

    if (!password || !confirmPassword) {
      alert('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/auth/link-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        document.getElementById('password-creation-modal').remove();
        
        if (data.requiresConfirmation) {
          // Show confirmation message
          alert(data.message || 'Please check your email to confirm password creation.');
          
          // For testing purposes, show the confirmation URL (remove in production)
          if (data.confirmationUrl) {
            console.log('Confirmation URL:', data.confirmationUrl);
            // Optionally show a link for testing
            const confirmDiv = document.createElement('div');
            confirmDiv.innerHTML = `
              <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); z-index: 1000002; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; max-width: 400px; width: 90%; padding: 30px; box-shadow: 0 30px 100px rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 215, 0, 0.3);">
                  <h3 style="color: #fff; margin: 0 0 15px 0; font-size: 18px;">Confirmation Required</h3>
                  <p style="color: #888; font-size: 13px; margin-bottom: 20px; line-height: 1.5;">
                    ${data.message}
                  </p>
                  <a href="${data.confirmationUrl}" target="_blank" style="display: block; width: 100%; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); border: none; color: #000; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: bold; cursor: pointer; transition: all 0.3s; margin-bottom: 10px; text-align: center; text-decoration: none;">
                    Open Confirmation Link (Testing)
                  </a>
                  <button onclick="this.closest('div').parentElement.remove()" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px; border-radius: 10px; font-size: 14px; cursor: pointer; transition: all 0.3s;">
                    Close
                  </button>
                </div>
              </div>
            `;
            document.body.appendChild(confirmDiv);
          }
        } else {
          alert(data.message || 'Password created successfully!');
          this.toggleAuthTab('signin');
        }
      } else {
        alert('Failed to create password: ' + data.error);
      }
    } catch (error) {
      console.error('Link password error:', error);
      alert('Failed to create password: ' + error.message);
    }
  }

  // Show auth status message
  showAuthStatusMessage(message, isError = false) {
    const statusEl = document.getElementById('auth-status-message');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = isError ? 'rgba(229, 9, 20, 0.15)' : 'rgba(46, 204, 113, 0.15)';
      statusEl.style.color = isError ? '#e50914' : '#2ecc71';
      statusEl.style.border = isError ? '1px solid rgba(229, 9, 20, 0.2)' : '1px solid rgba(46, 204, 113, 0.2)';
      statusEl.textContent = message;
    }
  }

  // ── Single Active Session ────────────────────────────────────────────────────

  // Show the "Account is active on another device" warning modal
  _showActiveElsewhereModal(email) {
    if (document.getElementById('active-elsewhere-modal')) return;
    const safeEmail = String(email).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const div = document.createElement('div');
    div.id = 'active-elsewhere-modal';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:1000005;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);padding:20px;box-sizing:border-box;';
    div.innerHTML = `
      <div style="background:linear-gradient(135deg,#1a0a00,#2a1000);border-radius:20px;max-width:430px;width:100%;padding:32px;border:1px solid rgba(229,9,20,.35);box-shadow:0 30px 80px rgba(229,9,20,.25);">
        <div style="text-align:center;margin-bottom:22px;">
          <div style="font-size:40px;margin-bottom:12px;">⚠️</div>
          <h3 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Account In Use</h3>
          <p style="color:#aaa;font-size:13px;margin:10px 0 0;line-height:1.6;">This account is currently active on another device. Only one session is allowed at a time.</p>
        </div>

        <div style="background:rgba(229,9,20,.08);border:1px solid rgba(229,9,20,.2);border-radius:12px;padding:14px 16px;margin-bottom:20px;">
          <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Account</div>
          <div style="color:#fff;font-size:14px;">${safeEmail}</div>
        </div>

        <div id="ae-status" style="display:none;margin-bottom:16px;padding:12px;border-radius:10px;font-size:13px;"></div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="ae-send-btn" onclick="jflixAuth._sendForceLogoutEmail()" style="width:100%;background:linear-gradient(135deg,#e50914,#b20710);color:#fff;border:none;padding:13px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="fas fa-envelope"></i> Send Logout Verification Email
          </button>
          <p style="color:#666;font-size:11px;text-align:center;margin:2px 0;">A verification link will be sent to <strong style="color:#aaa;">${safeEmail}</strong>.<br>Click the link to log out the other device and continue here.</p>
          <button onclick="document.getElementById('active-elsewhere-modal').remove()" style="width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#888;padding:11px;border-radius:10px;font-size:13px;cursor:pointer;">
            Dismiss (stay logged in here)
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  // Called by the "Send Logout Verification Email" button
  async _sendForceLogoutEmail() {
    const btn = document.getElementById('ae-send-btn');
    const statusEl = document.getElementById('ae-status');

    const setStatus = (msg, isErr) => {
      if (!statusEl) return;
      statusEl.style.display = 'block';
      statusEl.style.background = isErr ? 'rgba(229,9,20,.15)' : 'rgba(46,204,113,.15)';
      statusEl.style.color = isErr ? '#e50914' : '#2ecc71';
      statusEl.style.border = isErr ? '1px solid rgba(229,9,20,.25)' : '1px solid rgba(46,204,113,.25)';
      statusEl.textContent = msg;
    };

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }

    try {
      const res = await fetch(`${this.apiUrl}/auth/send-force-logout-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (data.success) {
        setStatus(`✓ Verification email sent to ${data.email}. Click the link in your inbox to log out the other device.`, false);
        if (btn) { btn.style.display = 'none'; }
      } else {
        setStatus(data.error || 'Failed to send email. Please try again.', true);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-envelope"></i> Send Logout Verification Email'; }
      }
    } catch (err) {
      setStatus('Network error. Please try again.', true);
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-envelope"></i> Send Logout Verification Email'; }
    }
  }

  // Heartbeat: called every 5 minutes to keep last_active fresh and check subscription status
  _startHeartbeat() {
    if (this._heartbeatInterval) return;
    const beat = async () => {
      if (!this.token) return;
      try {
        // Send heartbeat and check subscription status
        const response = await fetch(`${this.apiUrl}/auth/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // If backend indicates user was downgraded, fetch updated user data
          if (data.needsUpdate) {
            await this.fetchCurrentUser();
          }
          
          // Apply block gate logic automatically
          if (data.blockAccess === true) {
            console.log('[Heartbeat] User needs premium access - activating gate');
            if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = true;
            setTimeout(() => {
              if (typeof openPremiumModal === 'function') openPremiumModal();
            }, 100);
          } else if (data.blockAccess === false) {
            console.log('[Heartbeat] User has premium access - deactivating gate');
            if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = false;
            const premiumModal = document.getElementById('prem-modal');
            if (premiumModal && premiumModal.style.display === 'flex') {
              if (typeof closePremiumModal === 'function') closePremiumModal();
            }
          }
        }
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    };
    beat(); // immediate first beat
    this._heartbeatInterval = setInterval(beat, 5 * 60 * 1000);
  }

  _stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }


  // Show welcome message for new users
  showWelcomeMessage() {
    const toast = document.createElement('div');
    toast.innerHTML = `
      <div style="position: fixed; top: 100px; right: 20px; background: linear-gradient(135deg, #e50914 0%, #b20710 100%); color: #fff; padding: 15px 25px; border-radius: 12px; box-shadow: 0 10px 40px rgba(229, 9, 20, 0.4); z-index: 1000001; animation: slideIn 0.3s ease;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-check-circle" style="font-size: 20px;"></i>
          <div>
            <div style="font-weight: bold; font-size: 14px;">Welcome to JFlix!</div>
            <div style="font-size: 12px; opacity: 0.9;">Your account has been created successfully</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 5000);
  }


  _showWelcomeToast(name) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#e50914,#b20710);color:#fff;padding:14px 22px;border-radius:12px;box-shadow:0 8px 30px rgba(229,9,20,.4);z-index:1000010;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn .3s ease;';
    t.innerHTML = '<i class="fas fa-check-circle" style="font-size:18px;"></i><div><div style="font-weight:700;">Welcome, ' + name + '!</div><div style="font-size:12px;opacity:.85;">Your account is ready. Enjoy JFlix!</div></div>';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  _showAccountCreatedToast(email) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;padding:14px 22px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);border:1px solid rgba(255,215,0,.3);z-index:1000010;font-size:14px;display:flex;align-items:center;gap:10px;animation:slideIn .3s ease;max-width:320px;';
    t.innerHTML = '<i class="fas fa-envelope" style="font-size:18px;color:#FFD700;"></i><div><div style="font-weight:700;">Account created!</div><div style="font-size:12px;color:#aaa;">Check your email then sign in to get started.</div></div>';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }


  // Start polling for unread badges
  _startUnreadBadgePolling() {
    this._stopUnreadBadgePolling();
    this._unreadBadgeInterval = setInterval(() => this._updateUnreadBadges(), 5000);
  }

  // Stop polling for unread badges
  _stopUnreadBadgePolling() {
    if (this._unreadBadgeInterval) {
      clearInterval(this._unreadBadgeInterval);
      this._unreadBadgeInterval = null;
    }
  }

  // Update unread badges silently without full reload
  async _updateUnreadBadges() {
    try {
      const res = await fetch(this.apiUrl + '/messages/unread-count', {
        headers: { 'Authorization': 'Bearer ' + this.token }
      });
      const data = await res.json();
      if (data.success) {
        const unreadCount = data.unreadCount || 0;
        
        // Update profile modal badge
        const pmBadge = document.getElementById('pm-message-unread-badge');
        if (pmBadge) {
          if (unreadCount > 0) {
            pmBadge.textContent = unreadCount;
            pmBadge.style.display = 'inline-block';
          } else {
            pmBadge.style.display = 'none';
          }
        }
        
        // Update header profile badge
        const headerBadge = document.getElementById('header-profile-unread-badge');
        if (headerBadge) {
          if (unreadCount > 0) {
            headerBadge.textContent = unreadCount;
            headerBadge.style.display = 'flex';
          } else {
            headerBadge.style.display = 'none';
          }
        }
        
        // Show PWA notification if unread count increased
        if (unreadCount > this._lastUnreadCount && unreadCount > 0) {
          this._showPWANotification(unreadCount);
        }
        this._lastUnreadCount = unreadCount;
      }
    } catch (error) {
      // Silent fail, don't show errors
    }
  }

  // Show PWA push notification
  async _showPWANotification(count) {
    if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('JFlix', {
          body: `You have ${count} unread message${count > 1 ? 's' : ''}`,
          icon: '/images/icon-192x192.png',
          badge: '/images/icon-192x192.png',
          vibrate: [200, 100, 200],
          data: {
            url: '/'
          },
          actions: [
            {
              action: 'open',
              title: 'Open JFlix'
            }
          ]
        });
      } catch (error) {
        console.error('Failed to show PWA notification:', error);
      }
    }
  }

  // Request notification permission for PWA
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
      return permission;
    }
    return 'denied';
  }

  _lastUnreadCount = 0;
}

// Global auth instance
const jflixAuth = new JFlixAuth();
// Expose globally: this const lives inside the native-app else-block above,
// so without this, cross-file references (monetization.js, inline onclick
// handlers like jflixAuth.logout()) throw ReferenceError in native apps.
window.jflixAuth = jflixAuth;


// ─── Premium Payment Modal ───────────────────────────────────────────────────

// Location and currency detection
const JFLIX_PLANS_PHP = [
  { id: 'plan_30', days: 30, price: 68,  label: '30 Days', popular: true  },
  { id: 'plan_15', days: 15, price: 46,  label: '15 Days', popular: false },
  { id: 'plan_7',  days: 7,  price: 33,  label: '7 Days',  popular: false },
];

const JFLIX_PLANS_USD = [
  { id: 'plan_30', days: 30, price: 1.15, label: '30 Days', popular: true  },
  { id: 'plan_15', days: 15, price: 0.79, label: '15 Days', popular: false },
  { id: 'plan_7',  days: 7,  price: 0.58, label: '7 Days',  popular: false },
];

// Detect if user is in Philippines based on IP geolocation
async function isUserInPhilippines() {
  // Check for manual override in localStorage first
  const manualOverride = localStorage.getItem('jflix_manual_location');
  if (manualOverride === 'philippines') {
    console.log('Using manual location override: Philippines');
    return true;
  } else if (manualOverride === 'international') {
    console.log('Using manual location override: International');
    return false;
  }

  // Check cached location result
  const cachedLocation = localStorage.getItem('jflix_cached_location');
  const cachedTime = localStorage.getItem('jflix_location_cache_time');
  const CACHE_DURATION = 3600000; // 1 hour in milliseconds
  
  if (cachedLocation && cachedTime) {
    const cacheAge = Date.now() - parseInt(cachedTime);
    if (cacheAge < CACHE_DURATION) {
      console.log('Using cached location:', cachedLocation);
      return cachedLocation === 'philippines';
    }
  }

  try {
    // Use free IP geolocation API
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    console.log('IP Geolocation result:', data);
    
    const countryCode = data.country_code || data.country;
    const isPhilippines = countryCode === 'PH';
    
    // Cache the result
    localStorage.setItem('jflix_cached_location', isPhilippines ? 'philippines' : 'international');
    localStorage.setItem('jflix_location_cache_time', Date.now().toString());
    
    console.log('Detected country:', countryCode, 'isPhilippines:', isPhilippines);
    return isPhilippines;
  } catch (error) {
    console.log('IP geolocation failed, falling back to timezone:', error);
    
    // Fallback to timezone detection
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('Detected timezone:', timezone);
      if (timezone === 'Asia/Manila' || timezone.includes('Manila')) {
        return true;
      }
    } catch (e) {
      console.log('Timezone detection failed:', e);
    }

    // Final fallback: check browser locale
    const language = navigator.language || navigator.userLanguage || '';
    const locale = language.toLowerCase();
    console.log('Detected locale:', locale);
    
    if (locale === 'fil-ph' || locale === 'tl-ph' || locale === 'en-ph' || locale.includes('ph')) {
      return true;
    }

    console.log('All detection methods failed, defaulting to international');
    return false;
  }
}

// Get current currency and plans based on location
let _isPhilippines = false;
let _currentCurrency = 'USD';
let _currencySymbol = '$';
let JFLIX_PLANS = JFLIX_PLANS_USD;

// Initialize location detection asynchronously
async function initializeCurrency() {
  _isPhilippines = await isUserInPhilippines();
  _currentCurrency = _isPhilippines ? 'PHP' : 'USD';
  _currencySymbol = _isPhilippines ? '₱' : '$';
  JFLIX_PLANS = _isPhilippines ? JFLIX_PLANS_PHP : JFLIX_PLANS_USD;
  console.log('Currency initialized:', _currentCurrency, 'Plans:', JFLIX_PLANS);
  
  // Update UI if premium modal is open
  const premModal = document.getElementById('prem-modal');
  if (premModal && premModal.style.display === 'flex') {
    _rebuildPremiumPlans();
  }
  
  // Update pricing banner text on all pages
  updatePricingBanner();
}

// Update pricing banner text dynamically based on location
function updatePricingBanner() {
  const priceElements = document.querySelectorAll('.premium-banner-price');
  const priceText = _isPhilippines ? '₱33' : '$0.58';
  
  priceElements.forEach(element => {
    element.textContent = priceText;
  });
  
  console.log('Updated pricing banner to:', priceText);
}

// Start currency initialization
initializeCurrency();

const PAYPAL_CLIENT_ID = 'AfHlpJc89KYs0SmujFWihEgS-_V0FgZi7BvrNd9v_1dPPSODxpbqUoF-9vovBGNM0GoCX6Y2NLQq9tHP';
let _premSelectedPlan = JFLIX_PLANS[0];
let _premPaypalLoaded = false;
let _premOpenedFromProfile = false;

function openPremiumModal(fromProfile = false, skipAuthCheck = false) {
  if (IS_IOS_NATIVE) {
    console.log('[Auth] openPremiumModal suppressed on iOS native app');
    return;
  }
  if (!jflixAuth.isAuthenticated() && !skipAuthCheck) { jflixAuth.openAuthModal(); return; }
  
  // AGGRESSIVE: Always activate gate for free users in native apps, regardless of modal build success
  const isNativeApp = typeof SHOULD_SHOW_AUTH_MODAL !== 'undefined' && SHOULD_SHOW_AUTH_MODAL;
  const user = jflixAuth.getCurrentUser();
  const isPrem = user && (user.subscriptionType === 'premium' || user.subscription_type === 'premium');
  const expiry = user && (user.subscriptionExpiresAt || user.subscription_expires_at);
  const expired = expiry && new Date(expiry) < new Date();
  const isFree = !isPrem || expired;
  
  if (isNativeApp && isFree && !fromProfile && !skipAuthCheck) {
    console.log('[Auth] Activating premium gate for free user in native app');
    if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = true;
  }
  
  // Try to build modal, but don't fail if it errors
  try {
    // Only build modal if it doesn't exist
    if (!document.getElementById('prem-modal')) {
      _buildPremiumModal();
    }
    _premOpenedFromProfile = fromProfile;
    document.getElementById('prem-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Always rebuild plans with current currency when modal opens
    _rebuildPremiumPlans();
    
    // Only select plan if modal is visible
    setTimeout(() => {
      if (document.getElementById('prem-modal').style.display === 'flex') {
        _premSelectPlan(JFLIX_PLANS[0]);
      }
    }, 100);

    // Hide close button for free users when opened from auth flow (not from profile modal)
    // This fully blocks user from closing the modal when they don't have premium access
    if (isFree && !fromProfile && !skipAuthCheck) {
      setTimeout(() => {
        const modal = document.getElementById('prem-modal');
        if (!modal) return;
        const closeBtn = modal.querySelector('button[onclick*="closePremiumModal"]');
        if (closeBtn) closeBtn.style.display = 'none';
      }, 150);
    }
  } catch (e) {
    console.error('[Auth] Error building premium modal:', e);
    // Even if modal fails, ensure gate is active
    if (isNativeApp && isFree && typeof window._electronGateActive !== 'undefined') {
      window._electronGateActive = true;
    }
    
    // Show fallback blocking message if modal failed
    if (isNativeApp && isFree) {
      showFallbackBlockingMessage();
    }
  }

  // If opened for unverified Supabase user – show a notice and allow close
  if (skipAuthCheck && !jflixAuth.isAuthenticated()) {
    setTimeout(() => {
      const modal = document.getElementById('prem-modal');
      if (!modal) return;
      // Inject notice banner if not already there
      if (!document.getElementById('prem-verify-notice')) {
        const notice = document.createElement('div');
        notice.id = 'prem-verify-notice';
        notice.style.cssText = 'background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:10px;padding:10px 14px;margin-bottom:16px;text-align:center;font-size:13px;color:#cabd8f;';
        notice.innerHTML = '<i class="fas fa-envelope" style="color:#FFD700;margin-right:6px;"></i>Verify your email first, or purchase premium access below.';
        const body = modal.querySelector('.pm-body') || modal.querySelector('[class*="body"]') || modal.children[0];
        if (body) body.prepend(notice); else modal.prepend(notice);
      }
      // Allow closing since user isn't gated yet
      const closeBtn = modal.querySelector('button[onclick*="closePremiumModal"]');
      if (closeBtn) closeBtn.style.display = 'block';
      const signoutBtn = document.getElementById('egate-signout-btn');
      if (signoutBtn) signoutBtn.style.display = 'none';
    }, 200);
  }

  // If opened from profile, enable close buttons and hide signout button
  if (fromProfile) {
    setTimeout(() => {
      const modal = document.getElementById('prem-modal');
      if (!modal) return;
      
      // Show close button
      const closeBtn = modal.querySelector('button[onclick*="closePremiumModal"]');
      if (closeBtn) closeBtn.style.display = 'block';
      
      // Hide signout button
      const signoutBtn = document.getElementById('egate-signout-btn');
      if (signoutBtn) signoutBtn.style.display = 'none';
    }, 200);
  }
}

function closePremiumModal() {
  const m = document.getElementById('prem-modal');
  if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
}

// Copy jflix.uk to clipboard (for Electron/Android apps)
function copyJflixUrl() {
  var text = 'jflix.uk';

  // Try modern Clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      showCopyFeedback();
    }).catch(function() {
      fallbackCopy(text);
    });
    return;
  }

  fallbackCopy(text);
}

function fallbackCopy(text) {
  // Fallback: use a temporary textarea + execCommand
  try {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (ok) {
      showCopyFeedback();
    }
  } catch (e) {
    // Last resort: select and prompt
    prompt('Copy this URL and paste it in your browser:', text);
  }
}

function showCopyFeedback() {
  var feedback = document.getElementById('prem-copy-feedback');
  var btn = document.getElementById('prem-copy-url-btn');
  if (feedback) {
    feedback.style.display = 'block';
    setTimeout(function() { feedback.style.display = 'none'; }, 5000);
  }
  if (btn) {
    var originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check" style="font-size:18px;"></i> Copied!';
    btn.style.background = 'rgba(46,204,113,.2)';
    btn.style.borderColor = 'rgba(46,204,113,.7)';
    btn.style.color = '#2ecc71';
    setTimeout(function() {
      btn.innerHTML = originalHTML;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 3000);
  }
}

function openWatchForFree() {
  var url = 'https://jflix.uk';
  if (typeof window.electronAPI !== 'undefined' && typeof window.electronAPI.openExternal === 'function') {
    try {
      var result = window.electronAPI.openExternal(url);
      // openExternal returns a Promise (ipcRenderer.invoke) — if it resolves, we're done
      if (result && typeof result.then === 'function') {
        result.then(function(ok) {
          if (!ok) {
            // IPC failed — try intent/location fallback
            _watchFreeFallback(url);
          }
        }).catch(function() {
          _watchFreeFallback(url);
        });
      }
      return; // Don't fall through — Electron handles it
    } catch (e) {
      // Continue to fallbacks
    }
  }

  _watchFreeFallback(url);
}

function _watchFreeFallback(url) {
  // Cordova / PhoneGap app
  if (typeof cordova !== 'undefined' && cordova.InAppBrowser && typeof cordova.InAppBrowser.open === 'function') {
    try {
      cordova.InAppBrowser.open(url, '_system');
      return;
    } catch (e) {}
  }

  // Capacitor app
  if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Browser && typeof Capacitor.Plugins.Browser.open === 'function') {
    try {
      Capacitor.Plugins.Browser.open({ url: url });
      return;
    } catch (e) {}
  }

  // Android native app / WebView — force the system default browser
  var ua = navigator.userAgent || '';
  var isAndroid = /Android/i.test(ua);
  var isJFlixAndroid = /JFlixNativeApp|JFlix-Android|JFlixAndroid/i.test(ua);
  var isAndroidWebView = isAndroid && /wv/i.test(ua);
  var isAndroidFromStorage = false;
  try { isAndroidFromStorage = localStorage.getItem('jflix_is_android') === 'true'; } catch (e) {}

  if (isJFlixAndroid || isAndroidWebView || isAndroidFromStorage || (typeof window.IS_ANDROID !== 'undefined' && window.IS_ANDROID)) {
    // Try Android intent URL first — this asks the OS to open the default browser
    try {
      window.location.href = 'intent://jflix.uk#Intent;scheme=https;action=android.intent.action.VIEW;end;';
      return;
    } catch (e) {}
    // Fallback for older WebView setups
    try {
      window.open(url, '_system');
      return;
    } catch (e) {}
  }

  // Default: open in a new browser tab (works on Safari, Chrome, desktop, iOS, regular Android browser)
  try {
    var newTab = window.open(url, '_blank');
    if (newTab) newTab.focus();
    return;
  } catch (e) {}

  // Last resort
  window.location.href = url;
}

function _buildPremiumModal() {
  if (!document.getElementById('prem-modal-styles')) {
    const s = document.createElement('style');
    s.id = 'prem-modal-styles';
    s.textContent = `
      @keyframes premFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes premSlideUp{from{opacity:0;transform:translateY(28px) scale(.97)}to{opacity:1;transform:none}}
      @keyframes goldShine{0%{background-position:-200% center}100%{background-position:200% center}}
      #prem-modal{animation:premFadeIn .22s ease}
      #prem-inner{animation:premSlideUp .32s cubic-bezier(.2,.8,.2,1)}
      #prem-modal::-webkit-scrollbar{width:5px}
      #prem-modal::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
      .prem-plan{cursor:pointer;border:2px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;background:rgba(255,255,255,.03);transition:all .2s;position:relative;}
      .prem-plan:hover{border-color:rgba(255,200,40,.4);background:rgba(255,200,40,.06);}
      .prem-plan.active{border-color:#FFD700;background:rgba(255,200,40,.1);box-shadow:0 0 0 3px rgba(255,200,40,.12);}
      .prem-popular{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#FFD700,#FFA500);color:#1a0a00;font-size:9px;font-weight:800;padding:3px 10px;border-radius:10px;white-space:nowrap;letter-spacing:.5px;}
      .prem-tab{flex:1;padding:10px 0;border:none;background:transparent;color:#777;font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;font-family:inherit;}
      .prem-tab.active{color:#fff;border-color:#FFD700;}
      .prem-pay-btn{width:100%;padding:14px;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .25s;font-family:inherit;}
      .prem-ewallet-btn{width:100%;padding:12px 16px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);color:#ccc;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .2s;font-family:inherit;text-align:left;}
      .prem-ewallet-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.2);color:#fff;}
      .prem-ewallet-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
      .prem-watch-free-btn{width:100%;padding:14px;border:2px solid rgba(78,205,196,.4);border-radius:12px;background:rgba(78,205,196,.1);color:#4ecdc4;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .25s;font-family:inherit;text-decoration:none;}
      .prem-watch-free-btn:hover{background:rgba(78,205,196,.18);border-color:rgba(78,205,196,.6);color:#fff;}
      @media (max-width: 480px) {
        #prem-modal{padding:8px !important;align-items:flex-start !important;}
        #prem-inner{max-width:100% !important;border-radius:18px !important;}
        #prem-inner h2{font-size:20px !important;}
        #prem-inner p{font-size:12px !important;}
        .prem-plan{padding:12px 14px !important;border-radius:12px !important;}
        .prem-plan div{font-size:14px !important;}
        .prem-popular{font-size:8px !important;padding:2px 8px !important;}
        .prem-tab{font-size:12px !important;}
        .prem-pay-btn{padding:13px !important;font-size:14px !important;}
        .prem-watch-free-btn{padding:13px !important;font-size:14px !important;}
      }
      @media (max-width: 360px) {
        #prem-modal{padding:4px !important;}
        #prem-inner h2{font-size:18px !important;}
        .prem-plan{padding:10px 12px !important;}
      }
    `;
    document.head.appendChild(s);
  }

  // Get local currency info — use the globally detected currency
  let currencySymbol = _currencySymbol || '$';
  let currencyCode = _currentCurrency || 'USD';
  if (window.JFlixCurrency && typeof window.JFlixCurrency.convertPriceToLocal === 'function') {
    try {
      const localPrice = window.JFlixCurrency.convertPriceToLocal(30);
      currencySymbol = localPrice.symbol;
      currencyCode = localPrice.code;
    } catch (e) {
      console.warn('[Auth] Currency conversion failed, using default:', e);
    }
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="prem-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:1000010;display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:30px 14px;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);">
      <div id="prem-inner" style="background:#13131f;border-radius:22px;max-width:480px;width:100%;margin:auto;box-shadow:0 36px 100px rgba(0,0,0,.8),0 0 0 1px rgba(255,200,40,.2);position:relative;overflow:hidden;">

        <!-- Gold top stripe -->
        <div style="height:4px;background:linear-gradient(90deg,#b8860b,#FFD700 40%,#fff8c4 55%,#FFD700 70%,#b8860b);background-size:200% auto;animation:goldShine 3s linear infinite;"></div>

        <!-- Close -->
        <button onclick="closePremiumModal()" style="position:absolute;top:16px;right:16px;z-index:10;width:30px;height:30px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:50%;color:#888;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;line-height:1;"
          onmouseover="this.style.background='rgba(229,9,20,.3)';this.style.color='#fff';"
          onmouseout="this.style.background='rgba(255,255,255,.07)';this.style.color='#888';">&times;</button>

        <!-- Header -->
        <div style="padding:28px 26px 20px;text-align:center;">
          <!-- Sign Out Button -->
          <button onclick="if(typeof window._electronGateActive!=='undefined')window._electronGateActive=false;jflixAuth.logout();closePremiumModal();" style="background:rgba(229,9,20,.15);border:1px solid rgba(229,9,20,.3);color:#e50914;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;margin-bottom:12px;display:inline-flex;align-items:center;gap:6px;"
            onmouseover="this.style.background='rgba(229,9,20,.3)';"
            onmouseout="this.style.background='rgba(229,9,20,.15)';">
            <i class="fas fa-sign-out-alt"></i> Sign Out
          </button>
          <div style="width:54px;height:54px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 8px 24px rgba(255,180,0,.4);">
            <i class="fas fa-crown" style="color:#1a0a00;font-size:24px;"></i>
          </div>
          <h2 style="color:#fff;margin:0 0 6px;font-size:22px;font-weight:800;">Upgrade to Premium</h2>
          <p style="color:#777;font-size:13px;margin:0;">Ad-free · Full HD · Exclusive content · Cancel anytime</p>
        </div>

        <!-- Plan selector -->
        <div style="padding:0 22px 20px;display:flex;flex-direction:column;gap:10px;" id="prem-plans">
          ${JFLIX_PLANS.map(p => {
            const localPrice = p.price;
            const localDailyPrice = (p.price / p.days);
            const priceStr = _isPhilippines ? localPrice : localPrice.toFixed(2);
            const dailyStr = _isPhilippines ? localDailyPrice.toFixed(1) : localDailyPrice.toFixed(2);
            return `
            <div class="prem-plan${p.popular?' active':''}" id="pcard-${p.id}" onclick="_premSelectPlan(JFLIX_PLANS.find(x=>x.id==='${p.id}'))">
              ${p.popular ? '<div class="prem-popular">⭐ BEST VALUE</div>' : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                  <div style="color:#fff;font-size:15px;font-weight:700;">${p.label}</div>
                  <div style="color:#888;font-size:11px;margin-top:2px;">${_currencySymbol}${dailyStr}/day</div>
                </div>
                <div style="text-align:right;">
                  <div style="color:#FFD700;font-size:20px;font-weight:800;">${_currencySymbol}${priceStr}</div>
                  <div id="pcheck-${p.id}" style="color:#FFD700;font-size:11px;margin-top:2px;display:${p.popular?'block':'none'};">✓ Selected</div>
                </div>
              </div>
            </div>
          `;
          }).join('')}
        </div>

        <!-- Divider -->
        <div style="margin:0 22px 18px;height:1px;background:rgba(255,255,255,.06);"></div>

        <!-- Payment tabs -->
        <div style="padding:0 22px;">
          <div style="display:flex;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:20px;">
            <button class="prem-tab active" id="tab-paypal" onclick="_premShowTab('paypal')"><i class="fab fa-paypal" style="margin-right:6px;color:#009cde;"></i>PayPal</button>
            <button class="prem-tab" id="tab-ewallet" onclick="_premShowTab('ewallet')"><i class="fas fa-mobile-alt" style="margin-right:6px;color:#00b4ff;"></i>GCash / E-Wallets</button>
          </div>

          <!-- PayPal pane -->
          <div id="pane-paypal">
            <p style="color:#888;font-size:12px;margin:0 0 14px;text-align:center;">Pay securely with PayPal or debit/credit card</p>
            <div id="prem-paypal-btn-container" style="min-height:50px;"></div>
            <div id="prem-paypal-msg" style="display:none;margin-top:12px;padding:10px 12px;border-radius:10px;font-size:12px;text-align:center;"></div>
          </div>

          <!-- E-wallets pane -->
          <div id="pane-ewallet" style="display:none;">
            <p style="color:#FFD700;font-size:16px;font-weight:800;margin:0 0 16px;text-align:center;background:rgba(255,215,0,.15);border:2px solid #FFD700;border-radius:12px;padding:12px 16px;text-transform:uppercase;letter-spacing:1px;">
              <i class="fas fa-exclamation-circle" style="margin-right:8px;"></i>SERVICE FIRST BEFORE PAYMENT
            </p>
            <button onclick="closePremiumModal();openChatWithPremiumInstructions();" style="width:100%;padding:16px 20px;background:linear-gradient(135deg,#009cde,#0077b5);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;" onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 20px rgba(0,156,222,.4)';" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';">
              <i class="fas fa-comment" style="font-size:18px;"></i> Message Admin to Buy Premium
            </button>
            <p style="color:#666;font-size:11px;margin:12px 0 0;text-align:center;">Available: GCash · Maya · Maribank · Bank Transfer</p>
            <p style="color:#2ecc71;font-size:11px;margin:8px 0 0;text-align:center;"><i class="fas fa-shield-alt" style="margin-right:4px;"></i>100% Safe and Refundable</p>
            
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.07);">
              <p style="color:#FFD700;font-size:13px;font-weight:700;margin:0 0 16px;text-align:center;"><i class="fas fa-qrcode" style="margin-right:6px;"></i>Pay by Scanning the QR Code</p>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
                <div style="text-align:center;">
                  <img src="images/Gcash.JPG" alt="GCash QR" onclick="openImageLightbox(this.src)" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:transform .2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                  <p style="color:#aaa;font-size:11px;margin:8px 0 0;">GCash</p>
                </div>
                <div style="text-align:center;">
                  <img src="images/Maya.JPG" alt="Maya QR" onclick="openImageLightbox(this.src)" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:transform .2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                  <p style="color:#aaa;font-size:11px;margin:8px 0 0;">Maya</p>
                </div>
                <div style="text-align:center;">
                  <img src="images/Maribank.JPG" alt="Maribank QR" onclick="openImageLightbox(this.src)" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:transform .2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                  <p style="color:#aaa;font-size:11px;margin:8px 0 0;">Maribank</p>
                </div>
              </div>
              <p style="color:#FFD700;font-size:13px;font-weight:700;margin:12px 0 0;text-align:center;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:8px;padding:8px 12px;"><i class="fas fa-search-plus" style="margin-right:6px;"></i>Click or touch the image to zoom</p>
              <div style="margin-top:16px;background:rgba(255,200,40,.08);border:1px solid rgba(255,200,40,.25);border-radius:10px;padding:12px;">
                <p style="color:#cabd8f;font-size:11px;margin:0;line-height:1.5;">
                  <i class="fas fa-info-circle" style="color:#FFD700;margin-right:4px;"></i>
                  <strong>Step 1:</strong> Click the Message Admin to Buy Premium button<br>
                  <strong>Step 2:</strong> The admin will send first the voucher code, before you pay.<br>
                  <strong>Step 3:</strong> Scan the QR code or sending payment to the account number.<br>
                  <strong>Step 4:</strong> Take a screenshot of your payment receipt.<br>
                  <strong>Step 5:</strong> Message the admin with your receipt. The admin will verify your payment.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Watch for Free / Copy URL -->
        <div style="padding:0 22px 18px;">
          ${IS_NATIVE_APP ? `
          <!-- Native app (Electron/Android): Copy button with instructions -->
          <div style="background:rgba(78,205,196,.08);border:1px solid rgba(78,205,196,.25);border-radius:14px;padding:16px 18px;margin-bottom:14px;">
            <p style="color:#aaa;font-size:12px;margin:0 0 12px;text-align:center;line-height:1.5;">
              Don't want Premium? You can watch for free (with ads) in your browser.
            </p>
            <button class="prem-watch-free-btn" onclick="copyJflixUrl()" id="prem-copy-url-btn">
              <i class="fas fa-copy" style="font-size:18px;"></i> Copy jflix.uk
            </button>
            <div id="prem-copy-feedback" style="display:none;color:#2ecc71;font-size:12px;text-align:center;margin-top:10px;font-weight:600;">
              <i class="fas fa-check-circle"></i> Copied! Open your browser and paste it.
            </div>
            <p style="color:#666;font-size:11px;margin:10px 0 0;text-align:center;line-height:1.5;">
              <strong style="color:#4ecdc4;">Step 1:</strong> Tap "Copy jflix.uk"<br>
              <strong style="color:#4ecdc4;">Step 2:</strong> Open your web browser (Chrome, Safari, etc.)<br>
              <strong style="color:#4ecdc4;">Step 3:</strong> Paste in the address bar and press Go
            </p>
          </div>
          ` : `
          <!-- Web browser: Watch for Free button -->
          <button class="prem-watch-free-btn" onclick="openWatchForFree()">
            <i class="fas fa-play-circle" style="font-size:18px;"></i> Watch for Free
          </button>
          <p style="color:#666;font-size:11px;margin:10px 0 0;text-align:center;">Continue watching on JFlix web browser — no premium required.</p>
          `}
        </div>

        <!-- Voucher Redeem Section -->
        <div style="padding:0 22px 20px;">
          <div style="border-top:1px solid rgba(255,255,255,.07);padding-top:18px;">
            <div style="color:#FFD700;font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              <i class="fas fa-ticket-alt"></i> Have a Voucher Code?
            </div>
            <p style="color:#666;font-size:11px;margin:0 0 10px;">Enter your voucher code to activate premium instantly</p>
            <div style="display:flex;gap:8px;">
              <input type="text" id="prem-voucher-code-input" placeholder="JFLIX-XXXXXXXX" maxlength="20"
                style="flex:1;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);color:#fff;padding:11px 13px;border-radius:10px;font-size:13px;letter-spacing:.5px;outline:none;font-family:inherit;transition:border-color .2s;"
                onfocus="this.style.borderColor='rgba(255,215,0,.5)';this.style.boxShadow='0 0 0 2px rgba(255,215,0,.1)';"
                onblur="this.style.borderColor='rgba(255,255,255,.12)';this.style.boxShadow='none';">
              <button id="prem-voucher-redeem-btn"
                style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#1a0a00;border:none;padding:11px 16px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;transition:all .2s;font-family:inherit;"
                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(255,180,0,.4)';"
                onmouseout="this.style.transform='';this.style.boxShadow='none';">
                <i class="fas fa-check"></i> Redeem
              </button>
            </div>
            <div id="prem-voucher-status" style="font-size:12px;margin-top:8px;display:none;padding:8px 10px;border-radius:8px;"></div>
          </div>
        </div>

        <!-- Invitation Code Section -->
        <div style="padding:0 22px 20px;">
          <div style="border-top:1px solid rgba(255,255,255,.07);padding-top:18px;">
            <div style="color:#2ecc71;font-size:12px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
              <i class="fas fa-gift"></i> Have an Invitation Code? Get 30 Days FREE!
            </div>
            <p style="color:#666;font-size:11px;margin:0 0 10px;">Enter a friend's invitation code — you both get <strong style="color:#FFD700;">30 days FREE Premium</strong> instantly</p>
            <div style="display:flex;gap:8px;">
              <input type="text" id="prem-invite-code-input" placeholder="Friend's code..." maxlength="10"
                style="flex:1;background:rgba(0,0,0,.35);border:1px solid rgba(46,204,113,.25);color:#fff;padding:11px 13px;border-radius:10px;font-size:13px;letter-spacing:1px;outline:none;font-family:inherit;transition:border-color .2s;text-transform:uppercase;"
                onfocus="this.style.borderColor='rgba(46,204,113,.6)';this.style.boxShadow='0 0 0 2px rgba(46,204,113,.12)';"
                onblur="this.style.borderColor='rgba(46,204,113,.25)';this.style.boxShadow='none';">
              <button id="prem-invite-apply-btn2"
                style="background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff;border:none;padding:11px 16px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;transition:all .2s;font-family:inherit;"
                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 14px rgba(46,204,113,.4)';"
                onmouseout="this.style.transform='';this.style.boxShadow='none';">
                <i class="fas fa-check"></i> Apply
              </button>
            </div>
            <div id="prem-invite-status2" style="font-size:12px;margin-top:8px;display:none;padding:8px 10px;border-radius:8px;"></div>
          </div>
        </div>

        <div style="padding:20px 22px 24px;text-align:center;">
          <p style="color:#555;font-size:10.5px;margin:0;"><i class="fas fa-lock" style="margin-right:4px;"></i>Secure payment · Premium activates instantly after verification</p>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  document.getElementById('prem-modal').addEventListener('click', e => {
    if (e.target.id === 'prem-modal') closePremiumModal();
  });

  // Voucher redeem handler in premium modal
  const premVoucherBtn = document.getElementById('prem-voucher-redeem-btn');
  const premVoucherInput = document.getElementById('prem-voucher-code-input');
  if (premVoucherBtn) {
    premVoucherBtn.addEventListener('click', _premRedeemVoucher);
  }
  if (premVoucherInput) {
    premVoucherInput.addEventListener('keypress', e => { if (e.key === 'Enter') _premRedeemVoucher(); });
  }

  // Invitation apply handler in premium modal
  const premInviteBtn = document.getElementById('prem-invite-apply-btn2');
  const premInviteInput = document.getElementById('prem-invite-code-input');
  if (premInviteBtn) premInviteBtn.addEventListener('click', _premApplyInvitation);
  if (premInviteInput) premInviteInput.addEventListener('keypress', e => { if (e.key === 'Enter') _premApplyInvitation(); });

  _loadPayPalSDK();
}

// Fallback blocking message when premium modal fails to build
function showFallbackBlockingMessage() {
  // Remove existing fallback if present
  const existing = document.getElementById('premium-fallback-block');
  if (existing) existing.remove();
  
  const fallback = document.createElement('div');
  fallback.id = 'premium-fallback-block';
  fallback.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:999999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;text-align:center;padding:20px;';
  fallback.innerHTML = `
    <div style="font-size:48px;margin-bottom:20px;">👑</div>
    <h2 style="font-size:24px;margin:0 0 10px;font-weight:800;">Premium Required</h2>
    <p style="color:#aaa;font-size:16px;margin:0 0 20px;max-width:400px;">Please upgrade to premium to continue using JFlix.</p>
    <button onclick="location.reload()" style="background:#e50914;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">Refresh</button>
  `;
  document.body.appendChild(fallback);
  document.body.style.overflow = 'hidden';
}

async function _premRedeemVoucher() {
  const input = document.getElementById('prem-voucher-code-input');
  const status = document.getElementById('prem-voucher-status');
  const btn = document.getElementById('prem-voucher-redeem-btn');
  const code = (input ? input.value.trim().toUpperCase() : '');
  if (!code) {
    if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);'; status.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter a voucher code.'; }
    return;
  }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);color:#aaa;'; status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redeeming...'; }
  try {
    const res = await fetch(jflixAuth.apiUrl + '/vouchers/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token') },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (data.success) {
      if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(46,204,113,.15);color:#2ecc71;border:1px solid rgba(46,204,113,.2);'; status.innerHTML = '<i class="fas fa-check-circle"></i> ' + (data.message || 'Premium activated!'); }
      if (input) input.value = '';
      await jflixAuth.fetchCurrentUser();
      jflixAuth.updateAuthUI();
      // Close the premium gate flag if user is now premium
      if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = false;
      setTimeout(() => {
        closePremiumModal();
        // Reload page to apply premium status
        setTimeout(() => location.reload(), 500);
      }, 1800);
    } else {
      if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);'; status.innerHTML = '<i class="fas fa-times-circle"></i> ' + (data.error || 'Invalid voucher code.'); }
    }
  } catch (e) {
    if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);'; status.innerHTML = '<i class="fas fa-times-circle"></i> Network error. Please try again.'; }
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Redeem'; }
}

async function _premApplyInvitation() {
  const input  = document.getElementById('prem-invite-code-input');
  const status = document.getElementById('prem-invite-status2');
  const btn    = document.getElementById('prem-invite-apply-btn2');
  const code   = (input ? input.value.trim().toUpperCase() : '');

  if (!code) {
    if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);'; status.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter an invitation code.'; }
    return;
  }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
  if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);color:#aaa;'; status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...'; }

  try {
    const res = await fetch(jflixAuth.apiUrl + '/invitations/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token') },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (data.success) {
      if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(46,204,113,.15);color:#2ecc71;border:1px solid rgba(46,204,113,.2);'; status.innerHTML = '<i class="fas fa-check-circle"></i> ' + (data.message || '30 days Premium activated!'); }
      if (input) input.value = '';
      await jflixAuth.fetchCurrentUser();
      jflixAuth.updateAuthUI();
      if (typeof window._electronGateActive !== 'undefined') window._electronGateActive = false;
      setTimeout(() => {
        closePremiumModal();
        setTimeout(() => location.reload(), 500);
      }, 2000);
    } else {
      if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);'; status.innerHTML = '<i class="fas fa-times-circle"></i> ' + (data.error || 'Invalid invitation code.'); }
    }
  } catch (e) {
    if (status) { status.style.cssText = 'font-size:12px;margin-top:8px;display:block;padding:8px 10px;border-radius:8px;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);'; status.innerHTML = '<i class="fas fa-times-circle"></i> Network error. Please try again.'; }
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Apply'; }
}

// Make function globally accessible for inline onclick handlers
window.openImageLightbox = function(src) {
  // Remove existing lightbox if present
  const existing = document.getElementById('prem-image-lightbox');
  if (existing) existing.remove();
  
  const lightbox = document.createElement('div');
  lightbox.id = 'prem-image-lightbox';
  lightbox.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:1000020;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';
  
  lightbox.innerHTML = `
    <button onclick="document.getElementById('prem-image-lightbox').remove()" style="position:absolute;top:20px;right:20px;width:44px;height:44px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:50%;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;" onmouseover="this.style.background='rgba(229,9,20,.3)'" onmouseout="this.style.background='rgba(255,255,255,.1)'">
      <i class="fas fa-times"></i>
    </button>
    <img src="${src}" alt="QR Code" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
  `;
  
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.remove();
  });
  
  document.body.appendChild(lightbox);
};

function _premSelectPlan(plan) {
  _premSelectedPlan = plan;
  JFLIX_PLANS.forEach(p => {
    const card  = document.getElementById('pcard-' + p.id);
    const check = document.getElementById('pcheck-' + p.id);
    if (card)  card.classList.toggle('active', p.id === plan.id);
    if (check) check.style.display = p.id === plan.id ? 'block' : 'none';
  });
  _renderPayPalButton();
}

// Rebuild premium modal with current currency
function _rebuildPremiumPlans() {
  const plansContainer = document.getElementById('prem-plans');
  if (!plansContainer) return;
  
  plansContainer.innerHTML = JFLIX_PLANS.map(p => {
    const localPrice = p.price;
    const localDailyPrice = (p.price / p.days);
    const priceStr = _isPhilippines ? localPrice : localPrice.toFixed(2);
    const dailyStr = _isPhilippines ? localDailyPrice.toFixed(1) : localDailyPrice.toFixed(2);
    return `
    <div class="prem-plan${p.popular?' active':''}" id="pcard-${p.id}" onclick="_premSelectPlan(JFLIX_PLANS.find(x=>x.id==='${p.id}'))">
      ${p.popular ? '<div class="prem-popular">⭐ BEST VALUE</div>' : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="color:#fff;font-size:15px;font-weight:700;">${p.label}</div>
          <div style="color:#888;font-size:11px;margin-top:2px;">${_currencySymbol}${dailyStr}/day</div>
        </div>
        <div style="text-align:right;">
          <div style="color:#FFD700;font-size:20px;font-weight:800;">${_currencySymbol}${priceStr}</div>
          <div id="pcheck-${p.id}" style="color:#FFD700;font-size:11px;margin-top:2px;display:${p.popular?'block':'none'};">✓ Selected</div>
        </div>
      </div>
    </div>
  `;
  }).join('');
  
  // Re-select the current plan
  _premSelectPlan(_premSelectedPlan);
}

function _premShowTab(tab) {
  document.getElementById('pane-paypal').style.display  = tab === 'paypal'  ? 'block' : 'none';
  document.getElementById('pane-ewallet').style.display = tab === 'ewallet' ? 'block' : 'none';
  document.getElementById('tab-paypal').classList.toggle('active',  tab === 'paypal');
  document.getElementById('tab-ewallet').classList.toggle('active', tab === 'ewallet');
  if (tab === 'paypal') _renderPayPalButton();
}

function _loadPayPalSDK() {
  if (document.getElementById('paypal-sdk')) {
    // Remove existing SDK if currency changed
    const existingScript = document.getElementById('paypal-sdk');
    const existingCurrency = existingScript.src.match(/currency=([A-Z]{3})/)?.[1];
    if (existingCurrency !== _currentCurrency) {
      existingScript.remove();
      _premPaypalLoaded = false;
    } else {
      return; // Same currency, don't reload
    }
  }
  const s = document.createElement('script');
  s.id  = 'paypal-sdk';
  s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=${_currentCurrency}&intent=capture&components=buttons`;
  s.onload = () => { _premPaypalLoaded = true; _renderPayPalButton(); };
  document.head.appendChild(s);
}

function _renderPayPalButton() {
  const c = document.getElementById('prem-paypal-btn-container');
  if (!c) return;
  
  // Check if container is in DOM before rendering
  if (!document.body.contains(c)) {
    console.warn('[PayPal] Container not in DOM, skipping render');
    return;
  }
  
  c.innerHTML = '';
  if (!_premPaypalLoaded || typeof paypal === 'undefined') {
    c.innerHTML = '<div style="color:#888;font-size:12px;text-align:center;padding:14px;"><i class="fas fa-spinner fa-spin"></i> Loading PayPal...</div>';
    return;
  }
  
  const plan = _premSelectedPlan;
  paypal.Buttons({
    style: { layout:'vertical', color:'gold', shape:'rect', label:'pay', height:44 },
    createOrder: (data, actions) => {
      console.log('PayPal: Creating order for', plan);
      console.log('PayPal: Plan details - ID:', plan.id, 'Price:', plan.price, 'Label:', plan.label, 'Currency:', _currentCurrency);
      return actions.order.create({
        purchase_units: [{ description: `JFlix Premium - ${plan.label}`, amount: { value: plan.price.toString(), currency_code: _currentCurrency } }]
      });
    },
    onApprove: async (data, actions) => {
      console.log('PayPal: Payment approved', data);
      const msg = document.getElementById('prem-paypal-msg');
      msg.style.cssText = 'display:block;background:rgba(255,255,255,.06);color:#aaa;border-radius:10px;font-size:12px;padding:10px 12px;margin-top:12px;text-align:center;';
      msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying payment...';
      
      // Check if user is still authenticated
      const token = localStorage.getItem('jflix_auth_token');
      if (!token) {
        msg.style.cssText = 'display:block;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);border-radius:10px;font-size:12px;padding:10px 12px;margin-top:12px;text-align:center;';
        msg.innerHTML = '<i class="fas fa-times-circle"></i> Session expired. Please log in again.';
        jflixAuth.openAuthModal();
        return;
      }
      
      try {
        // Server-side: verify with PayPal, generate voucher
        const res = await fetch(jflixAuth.apiUrl + '/paypal/verify', {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + token },
          body: JSON.stringify({ orderId: data.orderID, planId: plan.id, days: plan.days, amount: plan.price })
        });
        const result = await res.json();
        console.log('PayPal verification result:', result);
        console.log('PayPal verification status:', res.status);
        console.log('PayPal verification details:', JSON.stringify(result.details, null, 2));
        
        if (result.success) {
          // Show voucher modal
          closePremiumModal();
          showPaypalVoucherModal(result.voucherCode, result.days);
        } else {
          msg.style.cssText = 'display:block;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);border-radius:10px;font-size:12px;padding:10px 12px;margin-top:12px;text-align:center;';
          msg.innerHTML = '<i class="fas fa-times-circle"></i> ' + (result.error || 'Payment verification failed. Contact support.');
        }
      } catch(e) {
        console.error('PayPal verification error:', e);
        msg.style.cssText = 'display:block;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);border-radius:10px;font-size:12px;padding:10px 12px;margin-top:12px;text-align:center;';
        msg.innerHTML = '<i class="fas fa-times-circle"></i> Network error during verification. Contact support with your PayPal receipt.';
      }
    },
    onCancel: (data) => {
      console.log('PayPal: Payment cancelled', data);
      const msg = document.getElementById('prem-paypal-msg');
      if (msg) {
        msg.style.cssText = 'display:block;background:rgba(255,193,7,.15);color:#ffc107;border:1px solid rgba(255,193,7,.2);border-radius:10px;font-size:12px;padding:10px 12px;margin-top:12px;text-align:center;';
        msg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Payment cancelled or session timed out. Please try again.';
      }
    },
    onError: err => {
      console.error('PayPal error:', err);
      const msg = document.getElementById('prem-paypal-msg');
      if (msg) { 
        msg.style.cssText = 'display:block;background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);border-radius:10px;font-size:12px;padding:10px 12px;margin-top:12px;text-align:center;'; 
        msg.innerHTML = '<i class="fas fa-times-circle"></i> PayPal error: ' + (err.message || 'Please try again.'); 
      }
    }
  }).render('#prem-paypal-btn-container');
}

function _premEwalletClick(name, number, color) {
  const detail  = document.getElementById('prem-ewallet-detail');
  const content = document.getElementById('prem-ewallet-detail-content');
  const plan    = _premSelectedPlan;
  detail.style.display = 'block';
  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="width:38px;height:38px;border-radius:10px;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;color:${color};font-size:18px;"><i class="fas fa-mobile-alt"></i></div>
      <div><div style="color:#fff;font-size:14px;font-weight:700;">${name}</div><div style="color:#888;font-size:11px;">Send to number below</div></div>
    </div>
    <div style="background:rgba(0,0,0,.25);border-radius:9px;padding:12px;margin-bottom:4px;">
      <div style="color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Account Number</div>
      <div style="color:#FFD700;font-size:16px;font-weight:800;letter-spacing:1px;">${number}</div>
      <div style="color:#888;font-size:11px;margin-top:2px;">Account Name: JFlix Premium</div>
    </div>
    <div style="background:rgba(255,200,40,.08);border-radius:9px;padding:10px 12px;margin-top:8px;display:flex;align-items:center;gap:8px;">
      <i class="fas fa-info-circle" style="color:#FFD700;font-size:12px;flex-shrink:0;"></i>
      <div style="color:#cabd8f;font-size:11px;">Amount: <strong style="color:#FFD700;">${_currencySymbol}${_isPhilippines ? plan.price : plan.price.toFixed(2)}</strong> for <strong style="color:#FFD700;">${plan.label}</strong> Premium</div>
    </div>
    <button onclick="closePremiumModal();openChatModal();" style="margin-top:12px;width:100%;padding:12px;background:linear-gradient(135deg,#009cde,#0077b5);color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;" onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 15px rgba(0,156,222,.4)';" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';">
      <i class="fas fa-comment"></i> Message Admin to Buy Premium
    </button>
  `;
  detail.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function _premSubmitManual() {
  const ref = document.getElementById('prem-ref-input').value.trim();
  const msg = document.getElementById('prem-ewallet-msg');
  if (!ref) { msg.style.cssText = 'display:block;color:#e50914;'; msg.innerHTML = '⚠ Please enter your reference number.'; return; }
  msg.style.cssText = 'display:block;color:#aaa;';
  msg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  try {
    await fetch(jflixAuth.apiUrl + '/premium/manual-request', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + localStorage.getItem('jflix_auth_token') },
      body: JSON.stringify({ reference: ref, planId: _premSelectedPlan.id, days: _premSelectedPlan.days, amount: _premSelectedPlan.price })
    });
    msg.style.cssText = 'display:block;color:#2ecc71;';
    msg.innerHTML = '<i class="fas fa-check-circle"></i> Submitted! We\'ll verify and activate within 24 hours.';
    document.getElementById('prem-ref-input').value = '';
  } catch(e) {
    msg.style.cssText = 'display:block;color:#e50914;';
    msg.innerHTML = '<i class="fas fa-times-circle"></i> Failed to submit. Please try again.';
  }
}

// ─── Chat Modal (Messenger-like) ─────────────────────────────────────────────

let _chatMessages = [];
let _chatPollingInterval = null;
let _lastUserMessageCount = 0;

function openChatModal() {
  if (!jflixAuth.isAuthenticated()) { jflixAuth.openAuthModal(); return; }
  if (!document.getElementById('chat-modal')) _buildChatModal();
  _lastUserMessageCount = 0; // Reset message count
  document.getElementById('chat-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _loadChatMessages(true); // Force reload on open
  _startChatPolling();
}

function openChatFromProfile() {
  closeProfileModal();
  openChatModal();
  // Mark messages as read and update badges
  markMessagesAsRead();
}

function openChatWithPremiumInstructions() {
  closePremiumModal();
  openChatModal();
  
  // Auto-send premium instructions message
  setTimeout(() => {
    const input = document.getElementById('chat-input');
    if (input) {
      input.value = `📋 Premium Purchase Instructions

1️⃣ Take a screenshot of your payment receipt
2️⃣ Send the screenshot to the admin
3️⃣ The admin will verify your payment
4️⃣ You will receive a voucher code
5️⃣ Click "Redeem" to activate premium

💰 Available payment methods: GCash, Maya, Maribank, Bank Transfer

🛡️ 100% Safe and Refundable`;
      _sendChatMessage();
    }
  }, 500);
}

function closeChatModal() {
  const m = document.getElementById('chat-modal');
  if (m) { m.style.display = 'none'; document.body.style.overflow = ''; }
  _stopChatPolling();
}

// PayPal Voucher Modal
function showPaypalVoucherModal(voucherCode, days) {
  // Remove existing modal if present
  const existing = document.getElementById('paypal-voucher-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'paypal-voucher-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000020;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);';
  
  modal.innerHTML = `
    <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:20px;max-width:420px;width:90%;padding:32px;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,215,0,.2);position:relative;animation:premSlideUp .3s cubic-bezier(.2,.8,.2,1);">
      <button onclick="document.getElementById('paypal-voucher-modal').remove()" style="position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;" onmouseover="this.style.background='rgba(229,9,20,.3)';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,.08)';this.style.color='#888';">
        <i class="fas fa-times"></i>
      </button>
      
      <div style="text-align:center;margin-bottom:24px;">
        <div style="width:64px;height:64px;background:linear-gradient(135deg,#2ecc71 0%,#27ae60 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 8px 24px rgba(46,204,113,.4);">
          <i class="fas fa-check" style="font-size:28px;color:#fff;"></i>
        </div>
        <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">Payment Successful!</h2>
        <p style="color:#888;font-size:14px;margin:0;">Your voucher code has been generated</p>
      </div>
      
      <div style="background:rgba(0,0,0,.3);border:2px solid rgba(255,215,0,.3);border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-align:center;">Voucher Code</div>
        <div id="paypal-voucher-code" style="color:#FFD700;font-size:24px;font-weight:800;letter-spacing:2px;text-align:center;font-family:monospace;margin-bottom:8px;">${voucherCode}</div>
        <div style="color:#2ecc71;font-size:12px;text-align:center;"><i class="fas fa-clock"></i> ${days} days of premium access</div>
      </div>
      
      <div style="display:flex;gap:12px;flex-direction:column;">
        <button onclick="copyPaypalVoucher('${voucherCode}')" style="background:linear-gradient(135deg,#3498db 0%,#2980b9 100%);color:#fff;border:none;padding:14px;border-radius:10px;cursor:pointer;font-size:15px;font-weight:600;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(52,152,219,.3)';" onmouseout="this.style.transform='';this.style.boxShadow='none';">
          <i class="fas fa-copy"></i> Copy Code
        </button>
        <button onclick="redeemPaypalVoucher('${voucherCode}')" style="background:linear-gradient(135deg,#e50914 0%,#b20710 100%);color:#fff;border:none;padding:14px;border-radius:10px;cursor:pointer;font-size:15px;font-weight:600;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(229,9,20,.3)';" onmouseout="this.style.transform='';this.style.boxShadow='none';">
          <i class="fas fa-ticket-alt"></i> Redeem Now
        </button>
      </div>
      
      <p style="color:#666;font-size:11px;text-align:center;margin-top:16px;">Click Redeem to apply premium to your account</p>
    </div>
  `;
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
}

function copyPaypalVoucher(code) {
  navigator.clipboard.writeText(code).then(() => {
    alert('Voucher code copied to clipboard!');
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Voucher code copied to clipboard!');
  });
}

async function redeemPaypalVoucher(code) {
  const btn = event.target.closest('button');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redeeming...';
  
  try {
    const res = await fetch(jflixAuth.apiUrl + '/vouchers/redeem', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + localStorage.getItem('jflix_auth_token') },
      body: JSON.stringify({ code })
    });
    const result = await res.json();
    
    if (result.success) {
      // Remove voucher modal
      document.getElementById('paypal-voucher-modal').remove();
      document.body.style.overflow = '';
      
      // Refresh user data
      await jflixAuth.fetchCurrentUser();
      
      // Update profile modal if it's open
      if (document.getElementById('profile-modal') && document.getElementById('profile-modal').style.display !== 'none') {
        pmLoadUserProfile();
      }
      
      // Update general UI
      jflixAuth.updateAuthUI();
      
      // Hide Get Premium buttons
      document.querySelectorAll('.get-premium-btn').forEach(b => b.style.display = 'none');
      
      // Show success message
      alert(`Premium activated for ${result.daysAdded} days!`);
    } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Redeem Now';
      alert('Failed to redeem: ' + (result.error || 'Unknown error'));
    }
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Redeem Now';
    alert('Error: ' + e.message);
  }
}

function _buildChatModal() {
  if (!document.getElementById('chat-modal-styles')) {
    const s = document.createElement('style');
    s.id = 'chat-modal-styles';
    s.textContent = `
      @keyframes chatFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes chatSlideUp{from{opacity:0;transform:translateY(30px) scale(.96)}to{opacity:1;transform:none}}
      @keyframes chatMsgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      #chat-modal{animation:chatFadeIn .2s ease;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);}
      #chat-inner{animation:chatSlideUp .3s cubic-bezier(.2,.8,.2,1)}
      .chat-msg{animation:chatMsgIn .25s ease}
      #chat-messages{-webkit-overflow-scrolling:touch;}
      #chat-messages::-webkit-scrollbar{width:5px}
      #chat-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}
      .chat-bubble{max-width:75%;min-width:60px;padding:12px 16px;border-radius:18px;font-size:15px;line-height:1.4;position:relative;box-shadow:0 1px 2px rgba(0,0,0,.1);}
      .chat-bubble.sent{background:#0084ff;color:#fff;border-bottom-right-radius:4px;}
      .chat-bubble.received{background:#e4e6eb;color:#050505;border-bottom-left-radius:4px;}
      .chat-bubble img{max-width:100%;border-radius:12px;margin-top:8px;}
      .chat-reactions{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;}
      .chat-reaction{background:rgba(0,0,0,.1);border-radius:12px;padding:2px 8px;font-size:13px;cursor:pointer;transition:all .2s;min-height:32px;min-width:32px;display:flex;align-items:center;justify-content:center;}
      .chat-reaction:hover{background:rgba(0,0,0,.15);}
      .chat-input-area{border-top:1px solid rgba(255,255,255,.08);padding:12px 16px;padding-bottom:calc(12px + env(safe-area-inset-bottom));background:rgba(0,0,0,.2);}
      .chat-input{flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:12px 18px;color:#fff;font-size:15px;outline:none;transition:all .2s;font-family:inherit;}
      .chat-input:focus{border-color:#0084ff;background:rgba(0,132,255,.08);}
      .chat-send-btn{width:44px;height:44px;background:#0084ff;border:none;border-radius:50%;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-left:10px;transition:all .2s;flex-shrink:0;min-width:44px;min-height:44px;-webkit-tap-highlight-color:transparent;}
      .chat-send-btn:hover{transform:scale(1.08);box-shadow:0 4px 16px rgba(0,132,255,.4);}
      .chat-send-btn:active{transform:scale(0.95);}
      .chat-upload-btn{width:44px;height:44px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;margin-right:10px;transition:all .2s;flex-shrink:0;min-width:44px;min-height:44px;-webkit-tap-highlight-color:transparent;}
      .chat-upload-btn:hover{background:rgba(255,255,255,.15);color:#fff;}
      .chat-upload-btn:active{transform:scale(0.95);}
      .chat-reaction-picker{position:absolute;bottom:100%;right:0;background:#1a1a2e;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:8px;display:flex;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);margin-bottom:8px;display:none;z-index:1000032;}
      .chat-reaction-picker.show{display:flex;}
      .chat-reaction-btn{width:32px;height:32px;border:none;background:transparent;font-size:18px;cursor:pointer;border-radius:6px;transition:all .2s;min-width:32px;min-height:32px;-webkit-tap-highlight-color:transparent;}
      .chat-reaction-btn:hover{background:rgba(255,255,255,.1);transform:scale(1.15);}
      .chat-time{font-size:11px;color:#888;margin-top:4px;}
      .chat-seen{font-size:11px;color:#0084ff;margin-left:4px;}
      @media(max-width:640px){
        #chat-inner{border-radius:0;margin:0;height:100vh;max-width:100%;}
        .chat-bubble{max-width:85%;}
      }
    `;
    document.head.appendChild(s);
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="chat-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000020;display:none;align-items:center;justify-content:center;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
      <div id="chat-inner" style="background:#12121f;border-radius:20px;max-width:600px;width:100%;max-height:85vh;height:600px;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(0,156,222,.2);position:relative;overflow:hidden;">

        <!-- Header -->
        <div style="padding:16px 20px;padding-top:calc(16px + env(safe-area-inset-top));border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.2);">
          <div style="width:44px;height:44px;background:linear-gradient(135deg,#009cde,#0078b5);border-radius:50%;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-headset" style="color:#fff;font-size:18px;"></i>
          </div>
          <div style="flex:1;">
            <div style="color:#fff;font-size:16px;font-weight:700;">Admin Support</div>
            <div style="color:#888;font-size:12px;">Typically replies within a few hours</div>
          </div>
          <button onclick="closeChatModal()" style="width:44px;height:44px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;min-width:44px;min-height:44px;-webkit-tap-highlight-color:transparent;" onmouseover="this.style.background='rgba(229,9,20,.3)';this.style.color='#fff';" onmouseout="this.style.background='rgba(255,255,255,.08)';this.style.color='#888';">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Messages -->
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px;">
          <div style="text-align:center;color:#666;font-size:13px;padding:20px;">
            <i class="fas fa-comment-dots" style="font-size:32px;margin-bottom:12px;color:#009cde;"></i>
            <p>Start a conversation with our admin team</p>
          </div>
        </div>

        <!-- Input -->
        <div class="chat-input-area" style="display:flex;align-items:center;gap:8px;">
          <input type="file" id="chat-file-input" accept="image/*" style="display:none;" onchange="_handleChatFileUpload(this)">
          <button class="chat-upload-btn" onclick="document.getElementById('chat-file-input').click()" title="Send photo">
            <i class="fas fa-image"></i>
          </button>
          <input type="text" id="chat-input" class="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter')_sendChatMessage()">
          <button class="chat-send-btn" onclick="_sendChatMessage()" title="Send">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>

      </div>
    </div>
    
    <!-- Image Lightbox -->
    <div id="image-lightbox" style="position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:1000030;display:none;align-items:center;justify-content:center;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);">
      <button onclick="closeImageLightbox()" style="position:absolute;top:20px;right:20px;width:44px;height:44px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;transition:all .2s;z-index:1000031;" onmouseover="this.style.background='rgba(229,9,20,.8)';this.style.transform='scale(1.1)';" onmouseout="this.style.background='rgba(255,255,255,.15)';this.style.transform='scale(1)';">
        <i class="fas fa-times"></i>
      </button>
      <img id="lightbox-image" src="" alt="Full size image" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
    </div>
  `;
  document.body.appendChild(wrap);

  document.getElementById('chat-modal').addEventListener('click', e => {
    if (e.target.id === 'chat-modal') closeChatModal();
  });
}

async function _loadChatMessages(forceReload = false) {
  try {
    const token = localStorage.getItem('jflix_auth_token');
    console.log('Loading messages, token exists:', !!token);
    const res = await fetch(jflixAuth.apiUrl + '/messages/conversation', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    console.log('Load messages response:', data);
    if (data.success) {
      const newMessages = data.messages || [];
      
      // Silent update - only append new messages
      if (!forceReload && newMessages.length > _lastUserMessageCount) {
        const newMessagesList = newMessages.slice(_lastUserMessageCount);
        newMessagesList.forEach(msg => _appendUserMessageSilently(msg));
        _lastUserMessageCount = newMessages.length;
        _chatMessages = newMessages;
      } else {
        // Full render on first load or force reload
        const oldMessageCount = _chatMessages.length;
        _chatMessages = newMessages;
        _lastUserMessageCount = newMessages.length;
        
        // Check if user was at bottom before rendering
        const container = document.getElementById('chat-messages');
        const wasAtBottom = container && (container.scrollHeight - container.scrollTop - container.clientHeight < 50);
        
        _renderChatMessages(wasAtBottom, oldMessageCount, forceReload);
      }
      
      await fetch(jflixAuth.apiUrl + '/messages/mark-read', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    } else {
      console.error('Load messages failed:', data.error);
    }
  } catch(e) {
    console.error('Load messages error:', e);
  }
}

function _escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Parse a UTC timestamp from SQLite correctly — ensures local timezone display
function _parseUTCDate(str) {
  if (!str) return new Date();
  if (typeof str === 'string' && !str.endsWith('Z') && !/[+\-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  return new Date(str);
}

function _renderChatMessages(wasAtBottom = true, oldMessageCount = 0, forceReload = false) {
  const container = document.getElementById('chat-messages');
  if (_chatMessages.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;color:#666;font-size:13px;padding:20px;">
        <i class="fas fa-comment-dots" style="font-size:32px;margin-bottom:12px;color:#009cde;"></i>
        <p>Start a conversation with our admin team</p>
      </div>
    `;
    return;
  }

  let currentUserId = localStorage.getItem('jflix_user_id');
  console.log('Initial currentUserId from localStorage:', currentUserId);

  // Fallback: get user_id from jflix_user object if not stored separately
  if (!currentUserId) {
    const userData = localStorage.getItem('jflix_user');
    console.log('No currentUserId, checking jflix_user:', !!userData);
    if (userData) {
      try {
        const user = JSON.parse(userData);
        console.log('Parsed user object:', user);
        currentUserId = user.user_id || user.id; // Fallback to id if user_id missing
        console.log('Extracted currentUserId from user object:', currentUserId);
        localStorage.setItem('jflix_user_id', currentUserId);
      } catch (e) {
        console.error('Failed to parse jflix_user:', e);
      }
    }
  }

  // Fallback: get from jflixAuth instance
  if (!currentUserId && jflixAuth && jflixAuth.user) {
    console.log('No currentUserId, checking jflixAuth.user:', jflixAuth.user);
    currentUserId = jflixAuth.user.user_id || jflixAuth.user.id; // Fallback to id if user_id missing
    console.log('Extracted currentUserId from jflixAuth.user:', currentUserId);
    localStorage.setItem('jflix_user_id', currentUserId);
  }

  // Fallback: decode JWT token to get userId
  if (!currentUserId) {
    const token = localStorage.getItem('jflix_auth_token');
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          currentUserId = payload.userId || payload.user_id;
          console.log('Extracted currentUserId from JWT token:', currentUserId);
          localStorage.setItem('jflix_user_id', currentUserId);
        }
      } catch (e) {
        console.error('Failed to decode JWT token:', e);
      }
    }
  }

  console.log('Final currentUserId:', currentUserId, 'message count:', _chatMessages.length);

  // Only re-render if messages have changed OR force reload is requested
  if (!forceReload && oldMessageCount === _chatMessages.length && container.innerHTML !== '') {
    console.log('No new messages, skipping render to prevent blinking');
    return;
  }

  container.innerHTML = _chatMessages.map(msg => {
    const isSent = String(msg.sender_id).trim() === String(currentUserId).trim();
    const reactions = msg.reactions ? (typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions) : [];
    console.log('[Render Chat] Message reactions:', { messageId: msg.id, reactions, rawReactions: msg.reactions });
    const time = _parseUTCDate(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    console.log('Msg sender_id:', msg.sender_id, 'isSent:', isSent, 'content:', msg.content?.substring(0, 20), 'image_url:', msg.image_url);

    // Calculate expiration countdown if image exists (48 hours from message creation)
    let countdownHtml = '';
    if (msg.image_url && msg.created_at) {
      const createdAt = _parseUTCDate(msg.created_at);
      const expiresAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000); // 48 hours
      const now = new Date();
      const timeLeft = expiresAt - now;
      
      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        countdownHtml = `<div class="image-countdown" data-expires="${expiresAt.toISOString()}" style="font-size:11px;color:#e50914;margin-top:4px;display:flex;align-items:center;gap:4px;"><i class="fas fa-clock"></i> Expires in <span class="countdown-timer">${hours}h ${minutes}m ${seconds}s</span></div>`;
      } else {
        countdownHtml = `<div class="image-countdown" style="font-size:11px;color:#888;margin-top:4px;"><i class="fas fa-clock"></i> Image expired</div>`;
      }
    }

    // Detect voucher message and add copy/redeem buttons
    let voucherHtml = '';
    const voucherMatch = msg.content?.match(/Code:\s*(JFLIX-[A-Z0-9]+)/i);
    console.log('Checking for voucher in message:', msg.content, 'Match:', voucherMatch);
    if (voucherMatch && !isSent) {
      const voucherCode = voucherMatch[1];
      console.log('Voucher code found:', voucherCode);
      voucherHtml = `
        <div style="margin-top:12px;padding:12px;background:rgba(229,9,20,0.15);border:1px solid rgba(229,9,20,0.3);border-radius:8px;">
          <div style="font-size:11px;color:#e50914;margin-bottom:8px;"><i class="fas fa-ticket-alt"></i> Voucher Code</div>
          <div style="font-family:monospace;font-size:16px;color:#fff;letter-spacing:1px;margin-bottom:12px;text-align:center;padding:8px;background:rgba(0,0,0,0.3);border-radius:6px;">${voucherCode}</div>
          <div style="display:flex;gap:8px;">
            <button onclick="copyVoucherCode('${voucherCode}')" style="flex:1;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:12px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;min-height:44px;min-width:44px;-webkit-tap-highlight-color:transparent;" onmouseover="this.style.background='rgba(255,255,255,0.2)';" onmouseout="this.style.background='rgba(255,255,255,0.1)';">
              <i class="fas fa-copy"></i> Copy
            </button>
            <button onclick="redeemVoucherFromChat('${voucherCode}')" style="flex:1;background:#e50914;color:#fff;border:none;padding:12px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.2s;min-height:44px;min-width:44px;-webkit-tap-highlight-color:transparent;" onmouseover="this.style.background='#c4080c';" onmouseout="this.style.background='#e50914';">
              <i class="fas fa-check-circle"></i> Redeem
            </button>
          </div>
        </div>
      `;
    }

    const DEFAULT_AVATAR_URL = 'images/icon-192x192.png';
    const ADMIN_AVATAR_URL   = 'images/icon-192x192.png';
    const ADMIN_SENDER_ID    = 'jflix-admin-system';
    const isAdminMsg = String(msg.sender_id).trim() === ADMIN_SENDER_ID;
    
    // Get user avatar from jflixAuth with fallbacks for different auth providers
    const getUserAvatar = () => {
      if (window.jflixAuth && window.jflixAuth.user) {
        const user = window.jflixAuth.user;
        // Check for avatarUrl (Supabase uploaded), avatar_url (database), or picture (Google)
        return user.avatarUrl || user.avatar_url || user.picture || DEFAULT_AVATAR_URL;
      }
      return DEFAULT_AVATAR_URL;
    };
    
    const senderAvatarUrl = isSent
      ? getUserAvatar()
      : (isAdminMsg ? ADMIN_AVATAR_URL : (msg.sender_avatar || DEFAULT_AVATAR_URL));

    return `
      <div class="chat-msg" data-message-id="${msg.id}" style="display:flex;justify-content:${isSent ? 'flex-end' : 'flex-start'};align-items:center;gap:8px;width:100%;">
        ${!isSent ? `<img src="${senderAvatarUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(0,132,255,0.3);" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_URL}';">` : ''}
        <button onclick="toggleUserEmojiPicker('${msg.id}')" class="chat-emoji-btn" style="width:28px;height:28px;background:rgba(255,255,255,0.9);border:none;border-radius:50%;color:#333;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <i class="fas fa-smile"></i>
        </button>
        <div style="max-width:75%;">
          <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
            ${msg.image_url ? `<img src="${msg.image_url}" alt="Image" style="max-width:100%;border-radius:12px;margin-bottom:8px;cursor:pointer;" onerror="this.style.display='none';console.error('Image failed to load:', this.src);" onload="console.log('Image loaded successfully:', this.src);" onclick="openImageLightbox('${msg.image_url}')">` : ''}
            ${countdownHtml}
            ${_escapeHtml(msg.content) || ''}
            ${voucherHtml}
            ${reactions && reactions.length > 0 ? `
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${isSent ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'};display:flex;flex-wrap:wrap;gap:4px;">
                ${reactions.map(r => `<span style="font-size:16px;">${r.emoji}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="chat-time" style="text-align:${isSent ? 'right' : 'left'};">
            ${time}
            ${isSent && msg.is_read ? '<span class="chat-seen"><i class="fas fa-check-double"></i> Seen</span>' : ''}
          </div>
        </div>
        ${isSent ? `<button onclick="deleteUserMessage('${msg.id}')" class="chat-delete-btn" style="width:28px;height:28px;background:rgba(229,9,20,0.9);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <i class="fas fa-trash"></i>
        </button>` : ''}
        ${isSent ? `<img src="${senderAvatarUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(229,9,20,0.3);" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_URL}';">` : ''}
      </div>
    `;
  }).join('');

  // Start countdown timer updates
  updateCountdownTimers();

  // Only auto-scroll to bottom if user was already at bottom - don't scroll on updates
  if (wasAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

// Image lightbox functions
function openImageLightbox(imageUrl) {
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-image');
  if (lightbox && lightboxImg) {
    lightboxImg.src = imageUrl;
    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeImageLightbox() {
  const lightbox = document.getElementById('image-lightbox');
  if (lightbox) {
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Toggle emoji picker for user chat message
function toggleUserEmojiPicker(messageId) {
  const existingPicker = document.getElementById(`user-emoji-picker-modal-${messageId}`);
  if (existingPicker) {
    existingPicker.remove();
    return;
  }

  // Close any other open emoji pickers
  document.querySelectorAll('[id^="user-emoji-picker-modal-"]').forEach(picker => picker.remove());

  const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👏', '🙏', '😍', '🤣', '😎', '🤔', '😴', '🥳', '😇', '🤗', '😋', '🤤', '😏', '🤐', '😶', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '🤖', '💀', '👾', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];
  
  const pickerHtml = `
    <div id="user-emoji-picker-modal-${messageId}" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;width:320px;max-height:400px;box-shadow:0 8px 32px rgba(0,0,0,0.5);z-index:1000033;display:flex;flex-direction:column;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="color:#fff;margin:0;font-size:16px;font-weight:600;">React with Emoji</h3>
        <button onclick="closeUserEmojiPicker('${messageId}')" style="background:none;border:none;color:#888;cursor:pointer;font-size:20px;padding:4px;border-radius:4px;transition:all 0.2s;" onmouseover="this.style.color='#fff';this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#888';this.style.background='none'">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div style="flex:1;overflow-y:auto;padding-right:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:8px;">
        ${emojis.map(emoji => `<button onclick="addUserMessageReaction('${messageId}', '${emoji}')" style="background:none;border:none;font-size:24px;cursor:pointer;padding:8px;border-radius:8px;transition:background 0.2s;display:flex;align-items:center;justify-content:center;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">${emoji}</button>`).join('')}
      </div>
    </div>
    <div id="user-emoji-picker-backdrop-${messageId}" onclick="closeUserEmojiPicker('${messageId}')" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000032;"></div>
  `;

  document.body.insertAdjacentHTML('beforeend', pickerHtml);
}

// Close user emoji picker
function closeUserEmojiPicker(messageId) {
  const picker = document.getElementById(`user-emoji-picker-modal-${messageId}`);
  const backdrop = document.getElementById(`user-emoji-picker-backdrop-${messageId}`);
  if (picker) picker.remove();
  if (backdrop) backdrop.remove();
}

// Add reaction to user message
async function addUserMessageReaction(messageId, emoji) {
  try {
    console.log('[Emoji Reaction] Adding reaction:', { messageId, emoji });
    const token = localStorage.getItem('jflix_auth_token');
    const res = await fetch(jflixAuth.apiUrl + '/messages/react', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ messageId, emoji })
    });
    const data = await res.json();
    console.log('[Emoji Reaction] Backend response:', data);
    if (data.success) {
      // Close picker
      closeUserEmojiPicker(messageId);
      // Force reload messages to show updated reactions
      console.log('[Emoji Reaction] Reloading messages...');
      _loadChatMessages(true);
    } else {
      alert('Failed to add reaction: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Delete user message
async function deleteUserMessage(messageId) {
  if (!confirm('Are you sure you want to delete this message?')) {
    return;
  }
  try {
    const token = localStorage.getItem('jflix_auth_token');
    const res = await fetch(jflixAuth.apiUrl + '/messages/' + messageId, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const data = await res.json();
    if (data.success) {
      _loadChatMessages(true); // Force reload
    } else {
      alert('Failed to delete message: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// Countdown timer update function
let countdownInterval = null;

function updateCountdownTimers() {
  // Clear existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  // Update immediately
  updateTimerDisplay();

  // Update every second
  countdownInterval = setInterval(updateTimerDisplay, 1000);
}

function updateTimerDisplay() {
  const countdownElements = document.querySelectorAll('.image-countdown[data-expires]');
  countdownElements.forEach(el => {
    const expiresAt = new Date(el.dataset.expires);
    const now = new Date();
    const timeLeft = expiresAt - now;
    const timerSpan = el.querySelector('.countdown-timer');

    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
      
      if (timerSpan) {
        timerSpan.textContent = `${hours}h ${minutes}m ${seconds}s`;
      }
    } else {
      // Image expired
      if (timerSpan) {
        el.innerHTML = '<i class="fas fa-clock"></i> Image expired';
        el.style.color = '#888';
      }
    }
  });
}

async function copyVoucherCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    alert('Voucher code copied to clipboard!');
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = code;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      alert('Voucher code copied to clipboard!');
    } catch (err) {
      alert('Failed to copy voucher code');
    }
    document.body.removeChild(textArea);
  }
}

async function redeemVoucherFromChat(code) {
  try {
    const res = await fetch(jflixAuth.apiUrl + '/vouchers/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jflixAuth.getToken()}`
      },
      body: JSON.stringify({ code })
    });
    const data = await res.json();

    if (data.success) {
      // Send confirmation message to admin
      const daysAdded = data.daysAdded || 30;
      const expiryDate = data.subscriptionExpiresAt ? new Date(data.subscriptionExpiresAt).toLocaleDateString() : 'Lifetime';
      await sendChatMessageDirect(`✅ I have redeemed the voucher with ${daysAdded} days valid until ${expiryDate}`);
      
      // Refresh user data
      await jflixAuth.fetchCurrentUser();
      jflixAuth.updateAuthUI();
      
      // Update profile modal if it's open
      if (document.getElementById('profile-modal') && document.getElementById('profile-modal').style.display !== 'none') {
        pmLoadUserProfile();
      }
      
      alert('Voucher redeemed successfully! Your premium has been extended.');
    } else {
      alert('Failed to redeem voucher: ' + data.error);
    }
  } catch (error) {
    alert('Error redeeming voucher: ' + error.message);
  }
}

async function sendChatMessageDirect(content) {
  try {
    const res = await fetch(jflixAuth.apiUrl + '/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jflixAuth.getToken()}`
      },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (data.success) {
      // Reload messages
      loadChatMessages();
    }
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

async function _sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  input.disabled = true;

  try {
    const res = await fetch(jflixAuth.apiUrl + '/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token')
      },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    console.log('Send message response:', data);
    if (data.success) {
      // Append message silently instead of full reload
      if (data.message) {
        _appendUserMessageSilently(data.message);
      }
    } else {
      console.error('Send message failed:', data.error);
      alert('Failed to send: ' + (data.error || 'Unknown error'));
    }
  } catch(e) {
    console.error('Send message error:', e);
    alert('Network error: ' + e.message);
  }

  input.disabled = false;
  input.focus();
}

// Append new message silently without full reload (user chat)
function _appendUserMessageSilently(message) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Check if message with this ID already exists to prevent duplicates
  if (document.querySelector(`[data-message-id="${message.id}"]`)) {
    console.log('Message already exists, skipping append:', message.id);
    return;
  }

  // Remove "Start a conversation" message if present
  if (container.textContent.includes('Start a conversation')) {
    container.innerHTML = '';
  }

  const currentUserId = localStorage.getItem('jflix_user_id');
  const isSent = String(message.sender_id).trim() === String(currentUserId).trim();
  const time = _parseUTCDate(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const DEFAULT_AVATAR_URL = 'images/icon-192x192.png';
  const ADMIN_AVATAR_URL = 'images/icon-192x192.png';
  const ADMIN_SENDER_ID = 'jflix-admin-system';
  const isAdminMsg = String(message.sender_id).trim() === ADMIN_SENDER_ID;
  
  // Get user avatar from jflixAuth with fallbacks for different auth providers
  const getUserAvatar = () => {
    if (window.jflixAuth && window.jflixAuth.user) {
      const user = window.jflixAuth.user;
      // Check for avatarUrl (Supabase uploaded), avatar_url (database), or picture (Google)
      return user.avatarUrl || user.avatar_url || user.picture || DEFAULT_AVATAR_URL;
    }
    return DEFAULT_AVATAR_URL;
  };
  
  const senderAvatarUrl = isSent
    ? getUserAvatar()
    : (isAdminMsg ? ADMIN_AVATAR_URL : (message.sender_avatar || DEFAULT_AVATAR_URL));

  const reactions = typeof message.reactions === 'string' ? JSON.parse(message.reactions || '[]') : (message.reactions || []);

  // Detect voucher code in message content
  const voucherCodeMatch = message.content && message.content.match(/JFLIX-[A-Z0-9]{8}/i);
  const voucherCode = voucherCodeMatch ? voucherCodeMatch[0].toUpperCase() : null;

  // Process message content - highlight voucher code and add redeem button
  let processedContent = _escapeHtml(message.content) || '';
  if (voucherCode && !isSent) {
    // Replace voucher code with highlighted version + redeem button
    processedContent = processedContent.replace(
      new RegExp(voucherCode, 'gi'),
      `<span style="background:rgba(255,215,0,0.2);color:#FFD700;font-weight:bold;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,215,0,0.5);">${voucherCode}</span> <button onclick="redeemVoucherFromChat('${voucherCode}')" style="background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff;border:none;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;margin-left:8px;transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Redeem</button>`
    );
  }

  const messageHtml = `
    <div class="chat-msg" data-message-id="${message.id}" style="display:flex;justify-content:${isSent ? 'flex-end' : 'flex-start'};align-items:center;gap:8px;width:100%;opacity:0;transition:opacity 0.3s;">
      ${!isSent ? `<img src="${senderAvatarUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(0,132,255,0.3);" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_URL}';">` : ''}
      <button onclick="toggleUserEmojiPicker('${message.id}')" class="chat-emoji-btn" style="width:28px;height:28px;background:rgba(255,255,255,0.9);border:none;border-radius:50%;color:#333;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <i class="fas fa-smile"></i>
      </button>
      <div style="max-width:75%;">
        <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
          ${processedContent}
          ${reactions && reactions.length > 0 ? `
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${isSent ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'};display:flex;flex-wrap:wrap;gap:4px;">
              ${reactions.map(r => `<span style="font-size:16px;">${r.emoji}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="chat-time" style="text-align:${isSent ? 'right' : 'left'};">
          ${time}
        </div>
      </div>
      ${isSent ? `<button onclick="deleteUserMessage('${message.id}')" class="chat-delete-btn" style="width:28px;height:28px;background:rgba(229,9,20,0.9);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
        <i class="fas fa-trash"></i>
      </button>` : ''}
      ${isSent ? `<img src="${senderAvatarUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(229,9,20,0.3);" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_URL}';">` : ''}
    </div>`;

  container.insertAdjacentHTML('beforeend', messageHtml);
  const newMessage = container.lastElementChild;
  setTimeout(() => newMessage.style.opacity = '1', 10);

  // Add to messages array
  _chatMessages.push(message);

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// Redeem voucher from chat message
window.redeemVoucherFromChat = async function(voucherCode) {
  const token = localStorage.getItem('jflix_auth_token');
  if (!token) {
    console.log('[Chat Voucher] No auth token found');
    return;
  }

  try {
    // Find the redeem button by searching for buttons with onclick containing the voucher code
    const allButtons = document.querySelectorAll('button[onclick*="redeemVoucherFromChat"]');
    let redeemBtn = null;
    for (const btn of allButtons) {
      if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(voucherCode)) {
        redeemBtn = btn;
        break;
      }
    }

    // Show loading state
    const originalText = redeemBtn ? redeemBtn.textContent : 'Redeem';
    if (redeemBtn) {
      try {
        redeemBtn.textContent = 'Redeeming...';
        redeemBtn.disabled = true;
      } catch (e) {
        console.error('[Chat Voucher] Error updating button state:', e);
      }
    }

    const response = await fetch(jflixAuth.apiUrl + '/vouchers/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ code: voucherCode })
    });

    const data = await response.json();

    if (data.success) {
      console.log('[Chat Voucher] Voucher redeemed successfully');

      // Refresh user data to update premium status
      try {
        if (jflixAuth && typeof jflixAuth.fetchCurrentUser === 'function') {
          await jflixAuth.fetchCurrentUser();
        }
        if (jflixAuth && typeof jflixAuth.updateAuthUI === 'function') {
          jflixAuth.updateAuthUI();
        }
      } catch (e) {
        console.error('[Chat Voucher] Error updating auth UI:', e);
      }

      // Deactivate premium gate immediately
      if (typeof window._electronGateActive !== 'undefined') {
        window._electronGateActive = false;
      }

      // Close premium modal if open
      try {
        const premiumModal = document.getElementById('prem-modal');
        if (premiumModal && premiumModal.style.display === 'flex') {
          if (typeof closePremiumModal === 'function') {
            closePremiumModal();
          }
        }
      } catch (e) {
        console.error('[Chat Voucher] Error closing premium modal:', e);
      }

      // Close chat modal
      try {
        const chatModal = document.getElementById('chat-modal');
        if (chatModal) {
          chatModal.style.display = 'none';
        }
      } catch (e) {
        console.error('[Chat Voucher] Error closing chat modal:', e);
      }

      // Update button to show success
      if (redeemBtn) {
        try {
          redeemBtn.textContent = 'Redeemed!';
          redeemBtn.style.background = '#4ecdc4';
        } catch (e) {
          console.error('[Chat Voucher] Error updating button to success state:', e);
        }
      }

      // Hide Get Premium buttons
      try {
        document.querySelectorAll('.get-premium-btn').forEach(b => b.style.display = 'none');
      } catch (e) {
        console.error('[Chat Voucher] Error hiding premium buttons:', e);
      }

      // Show success toast with days added
      const daysAdded = data.daysAdded || 7;
      const expiryDate = data.expiryDate || 'N/A';
      const toast = document.createElement('div');
      toast.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: #fff; padding: 16px 24px; border-radius: 12px; box-shadow: 0 10px 40px rgba(46, 204, 113, 0.4); z-index: 1000001; animation: slideIn 0.3s ease; max-width: 350px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-check-circle" style="font-size: 24px;"></i>
            <div>
              <div style="font-weight: bold; font-size: 15px;">Voucher Redeemed!</div>
              <div style="font-size: 13px; opacity: 0.95; margin-top: 2px;">Premium extended by ${daysAdded} days</div>
              <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">Valid until: ${expiryDate}</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 5000);

      // DO NOT reload page - this causes crashes in native apps
      // The UI will update automatically with the new premium status
    } else {
      console.log('[Chat Voucher] Failed to redeem voucher:', data.error);
      
      // Show error toast
      const isAlreadyRedeemed = data.error && data.error.toLowerCase().includes('already');
      const toast = document.createElement('div');
      toast.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: #fff; padding: 16px 24px; border-radius: 12px; box-shadow: 0 10px 40px rgba(231, 76, 60, 0.4); z-index: 1000001; animation: slideIn 0.3s ease; max-width: 350px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-exclamation-circle" style="font-size: 24px;"></i>
            <div>
              <div style="font-weight: bold; font-size: 15px;">${isAlreadyRedeemed ? 'Already Redeemed' : 'Redemption Failed'}</div>
              <div style="font-size: 13px; opacity: 0.95; margin-top: 2px;">${data.error || 'Unknown error'}</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 5000);

      if (redeemBtn) {
        try {
          redeemBtn.textContent = originalText;
          redeemBtn.disabled = false;
        } catch (e) {
          console.error('[Chat Voucher] Error resetting button on failure:', e);
        }
      }
    }
  } catch (error) {
    console.error('[Chat Voucher] Error redeeming voucher:', error);
    // Find and reset button
    try {
      const allButtons = document.querySelectorAll('button[onclick*="redeemVoucherFromChat"]');
      for (const btn of allButtons) {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(voucherCode)) {
          btn.textContent = 'Redeem';
          btn.disabled = false;
          break;
        }
      }
    } catch (e) {
      console.error('[Chat Voucher] Error resetting button on error:', e);
    }
  }
};

async function _resizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width *= scale;
        height *= scale;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

async function _handleChatFileUpload(input) {
  console.log('_handleChatFileUpload called, files:', input.files);
  let file = input.files[0];
  if (!file) {
    console.log('No file selected');
    return;
  }
  console.log('File selected:', file.name, file.size, file.type);

  // Show loading indicator
  const btn = document.querySelector('.chat-upload-btn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.disabled = true;

  try {
    // Optimize image before upload (resize to max 1200px, compress to JPEG)
    file = await _resizeImage(file);
  } catch (err) {
    console.log('Image optimization skipped, uploading original');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(jflixAuth.apiUrl + '/messages/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token') },
      body: formData
    });
    const data = await res.json();
    console.log('Upload response:', data);
    if (data.success) {
      const sendRes = await fetch(jflixAuth.apiUrl + '/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token')
        },
        body: JSON.stringify({ image_url: data.imageUrl })
      });
      const sendData = await sendRes.json();
      console.log('Send image message response:', sendData);
      if (sendData.success) {
        await _loadChatMessages();
      } else {
        console.error('Send image message failed:', sendData.error);
        alert('Failed to send photo: ' + (sendData.error || 'Unknown error'));
      }
    } else {
      console.error('Upload failed:', data.error);
      alert('Upload failed: ' + (data.error || 'Unknown error'));
    }
  } catch(e) {
    console.error('Upload error:', e);
    alert('Upload error: ' + e.message);
  }

  btn.innerHTML = originalHTML;
  btn.disabled = false;
  input.value = '';
}

function _startChatPolling() {
  _stopChatPolling();
  _chatPollingInterval = setInterval(_loadChatMessages, 5000);
}

function _stopChatPolling() {
  if (_chatPollingInterval) {
    clearInterval(_chatPollingInterval);
    _chatPollingInterval = null;
  }
}

// ─── Profile Modal ───────────────────────────────────────────────────────────

function createProfileModal() {
  // Remove existing modal if present to force rebuild
  const existingModal = document.getElementById('profile-modal');
  if (existingModal) {
    existingModal.parentElement.remove();
  }

  // Inject scoped CSS
  if (!document.getElementById('profile-modal-styles')) {
    const s = document.createElement('style');
    s.id = 'profile-modal-styles';
    s.textContent = `
      @keyframes pmFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes pmSlideUp{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes pmShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
      @keyframes pmGlow{0%,100%{box-shadow:0 0 22px rgba(255,200,40,.35),0 0 0 0 rgba(255,200,40,.25)}50%{box-shadow:0 0 36px rgba(255,200,40,.6),0 0 0 6px rgba(255,200,40,0)}}
      @keyframes pmFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      #profile-modal{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent;animation:pmFadeIn .25s ease}
      #profile-modal::-webkit-scrollbar{width:6px}
      #profile-modal::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:3px}
      #pm-inner{animation:pmSlideUp .35s cubic-bezier(.2,.8,.2,1)}
      .pm-input{width:100%;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);color:#fff;padding:12px 15px;border-radius:11px;font-size:14px;box-sizing:border-box;transition:border-color .2s,box-shadow .2s,background .2s;font-family:inherit}
      .pm-input:focus{outline:none;border-color:rgba(229,9,20,.6);background:rgba(0,0,0,.45);box-shadow:0 0 0 3px rgba(229,9,20,.12)}
      .pm-input::placeholder{color:#555}
      .pm-textarea{resize:vertical;min-height:84px;line-height:1.5}
      .pm-label{display:block;color:#8a8a9a;font-size:10.5px;text-transform:uppercase;letter-spacing:.7px;font-weight:600;margin-bottom:7px}
      .pm-fgroup{margin-bottom:16px}
      .pm-btn-p{background:linear-gradient(135deg,#e50914,#b20710);color:#fff;border:none;padding:12px 24px;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .25s;box-shadow:0 4px 16px rgba(229,9,20,.35);font-family:inherit}
      .pm-btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(229,9,20,.5)}
      .pm-btn-p:active{transform:translateY(0)}
      .pm-btn-s{background:rgba(255,255,255,.06);color:#ccc;border:1px solid rgba(255,255,255,.1);padding:11px 18px;border-radius:11px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:all .2s;font-family:inherit;width:100%;justify-content:center}
      .pm-btn-s:hover{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.2)}
      .pm-card{background:rgba(255,255,255,.035);border-radius:16px;padding:18px;border:1px solid rgba(255,255,255,.07);transition:transform .25s,box-shadow .25s}
      .pm-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,.3)}
      .pm-card-title{font-size:12px;font-weight:600;color:#fff;margin-bottom:13px;display:flex;align-items:center;gap:7px;letter-spacing:.3px}
      .pm-card-title i{color:#e50914;font-size:11px}
      .pm-stat{background:rgba(255,255,255,.04);border-radius:12px;padding:13px 8px;text-align:center;border:1px solid rgba(255,255,255,.05);transition:all .2s}
      .pm-stat:hover{background:rgba(229,9,20,.08);border-color:rgba(229,9,20,.2);transform:translateY(-2px)}
      .pm-stat-v{color:#e50914;font-size:21px;font-weight:800;line-height:1}
      .pm-stat-l{color:#777;font-size:9.5px;margin-top:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:600}
      .pm-vs{font-size:12px;margin-top:9px;padding:9px 11px;border-radius:9px;display:none}
      .pm-vs.success{background:rgba(46,204,113,.15);color:#2ecc71;border:1px solid rgba(46,204,113,.2);display:block}
      .pm-vs.error{background:rgba(229,9,20,.15);color:#e50914;border:1px solid rgba(229,9,20,.2);display:block}
      .pm-ss{font-size:12px;margin-left:10px;display:none}
      .pm-ss.success{color:#2ecc71;display:inline-flex;align-items:center;gap:4px}
      .pm-ss.error{color:#e50914;display:inline-flex;align-items:center;gap:4px}

      /* ── PREMIUM THEME ── */
      #pm-inner.pm-premium{border:1px solid rgba(255,200,40,.35);box-shadow:0 32px 90px rgba(0,0,0,.7),0 0 60px rgba(255,180,30,.12)}
      .pm-prem-hdr{border-bottom:1px solid rgba(255,200,40,.22)!important}
      .pm-prem-av{border-color:#FFD700!important;animation:pmGlow 3s ease-in-out infinite!important}
      .pm-crown-float{position:absolute;top:-14px;left:50%;transform:translateX(-50%);color:#FFD700;font-size:15px;filter:drop-shadow(0 2px 6px rgba(255,180,0,.6));animation:pmFloat 3s ease-in-out infinite;z-index:3}
      .pm-prem-badge{background:linear-gradient(110deg,#b8860b,#FFD700 30%,#fff6c4 50%,#FFD700 70%,#b8860b)!important;background-size:200% auto!important;color:#3a2800!important;border:none!important;font-weight:800!important;letter-spacing:.4px;animation:pmShimmer 4s linear infinite;box-shadow:0 3px 14px rgba(255,180,0,.4)}
      .pm-prem-cover::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 80% 50%,rgba(255,190,30,.15) 0%,transparent 65%)}
      .pm-prem-card{background:linear-gradient(160deg,rgba(255,200,40,.12),rgba(255,160,0,.04))!important;border:1px solid rgba(255,200,40,.3)!important}
      .pm-prem-name{background:linear-gradient(90deg,#fff,#FFD700);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
      .pm-prem-divider{background:linear-gradient(90deg,transparent,#FFD700,transparent)!important}

      @media(max-width:640px){
        #pm-body{grid-template-columns:1fr!important;padding:16px!important}
        #pm-inner{border-radius:16px!important;margin:8px auto!important}
        #pm-header{padding:0 16px 16px!important}
      }
    `;
    document.head.appendChild(s);
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="profile-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:1000003;display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:28px 14px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);">
      <div id="pm-inner" style="background:#141428;border-radius:20px;max-width:820px;width:100%;margin:auto;box-shadow:0 32px 90px rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.07);position:relative;overflow:hidden;">

        <!-- Close button -->
        <button onclick="closeProfileModal()" title="Close"
          style="position:absolute;top:14px;right:14px;z-index:10;width:32px;height:32px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.12);border-radius:50%;color:#888;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;line-height:1;"
          onmouseover="this.style.background='rgba(229,9,20,.35)';this.style.color='#fff';"
          onmouseout="this.style.background='rgba(0,0,0,.45)';this.style.color='#888';">&times;</button>

        <!-- Header row -->
        <div id="pm-header" style="padding:26px 26px 20px;display:flex;gap:16px;align-items:center;border-bottom:1px solid rgba(255,255,255,.06);">
          <div style="position:relative;flex-shrink:0;">
            <i id="pm-crown" class="fas fa-crown pm-crown-float" style="display:none;"></i>
            <img id="pm-avatar" src="" alt="Profile"
              style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:4px solid rgba(229,9,20,.6);box-shadow:0 6px 20px rgba(229,9,20,.3);display:block;background:#1a1a2e;"
              onerror="this.onerror=null;this.src='images/icon-192x192.png';">
            <div style="position:absolute;bottom:3px;right:3px;width:14px;height:14px;background:#2ecc71;border-radius:50%;border:3px solid #141428;"></div>
          </div>
          <div style="flex:1;padding-bottom:4px;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <h3 id="pm-name" style="color:#fff;margin:0;font-size:19px;font-weight:800;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Loading...</h3>
            </div>
            <p id="pm-email" style="color:#666;font-size:12px;margin:0 0 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></p>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span id="pm-badge" style="display:inline-flex;align-items:center;gap:5px;background:rgba(229,9,20,.15);color:#e50914;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(229,9,20,.3);">
                <i class="fab fa-google"></i> Google Account
              </span>
              <button id="pm-message-admin-btn" onclick="openChatFromProfile()" style="background:rgba(0,156,222,0.2);border:1px solid rgba(0,156,222,0.3);border-radius:6px;color:#009cde;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:600;transition:all 0.2s;display:flex;align-items:center;gap:4px;position:relative;" onmouseover="this.style.background='rgba(0,156,222,0.4)'" onmouseout="this.style.background='rgba(0,156,222,0.2)'">
                <i class="fas fa-comment"></i> Message Admin
                <span id="pm-message-unread-badge" style="background:#e50914;color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;display:none;">0</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Big Get Premium Button -->
        <div style="padding:0 26px 20px;">
          <button id="pm-get-premium-btn" onclick="openPremiumModal(true)" style="width:100%;background:linear-gradient(135deg,#FFD700,#FFA500);color:#1a0a00;border:none;padding:16px 24px;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;letter-spacing:.5px;box-shadow:0 4px 20px rgba(255,180,0,.5);transition:all .3s;" onmouseover="this.style.transform='scale(1.03) translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(255,180,0,.7)';" onmouseout="this.style.transform='scale(1) translateY(0)';this.style.boxShadow='0 4px 20px rgba(255,180,0,.5)';">
            <i class="fas fa-crown" style="font-size:20px;"></i> Get Premium
          </button>
        </div>

        <!-- Body -->
        <div id="pm-body" style="display:grid;grid-template-columns:1fr;max-width:500px;margin:0 auto;gap:22px;padding:24px 26px 28px;">

          <!-- Stats -->
          <div class="pm-card">
            <div class="pm-card-title"><i class="fas fa-chart-bar"></i> Your Stats</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div class="pm-stat"><div id="pm-stat-comments" class="pm-stat-v">0</div><div class="pm-stat-l">Comments</div></div>
              <div class="pm-stat"><div id="pm-stat-reactions" class="pm-stat-v">0</div><div class="pm-stat-l">Reactions</div></div>
              <div class="pm-stat"><div id="pm-stat-views" class="pm-stat-v">0</div><div class="pm-stat-l">Views</div></div>
              <div class="pm-stat"><div id="pm-stat-days" class="pm-stat-v">0</div><div class="pm-stat-l">Days Active</div></div>
            </div>
          </div>

          <!-- Subscription -->
          <div id="pm-sub-card" class="pm-card">
            <div class="pm-card-title" id="pm-sub-title"><i class="fas fa-crown"></i> Subscription</div>
            <div id="pm-sub-content">
              <div style="display:flex;align-items:center;gap:8px;color:#aaa;font-size:13px;margin-bottom:6px;"><i class="fas fa-user"></i> Free Member</div>
              <p style="color:#666;font-size:11px;margin:0;">Upgrade to Premium for exclusive benefits</p>
            </div>
          </div>

          <!-- Voucher -->
          <div class="pm-card">
            <div class="pm-card-title"><i class="fas fa-ticket-alt"></i> Redeem Voucher</div>
            <p style="color:#666;font-size:11px;margin:0 0 10px;">Enter code to unlock premium</p>
            <div style="display:flex;gap:8px;">
              <input type="text" id="pm-voucher-input" class="pm-input" placeholder="JFLIX..." maxlength="20"
                style="flex:1;padding:11px 13px;font-size:13px;letter-spacing:.5px;">
              <button id="pm-redeem-btn" class="pm-btn-p" style="padding:11px 15px;font-size:12px;white-space:nowrap;">
                <i class="fas fa-check"></i>
              </button>
            </div>
            <div id="pm-vs" class="pm-vs"></div>
          </div>

          <!-- Invitation Code -->
          <div class="pm-card" id="pm-invite-card">
            <div class="pm-card-title"><i class="fas fa-user-plus"></i> Invite Friends</div>
            <p style="color:#666;font-size:11px;margin:0 0 10px;">Share your code — both of you get <strong style="color:#FFD700;">30 days FREE Premium</strong>!</p>
            <div id="pm-invite-loading" style="color:#555;font-size:12px;text-align:center;padding:8px 0;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
            <div id="pm-invite-code-section" style="display:none;">
              <div style="display:flex;gap:8px;align-items:center;">
                <div id="pm-invite-code-display"
                  style="flex:1;background:rgba(255,215,0,.08);border:1.5px solid rgba(255,215,0,.35);border-radius:10px;padding:11px 13px;font-size:15px;font-weight:800;letter-spacing:2px;color:#FFD700;text-align:center;font-family:monospace;cursor:pointer;user-select:all;"
                  title="Click to copy"></div>
                <button id="pm-invite-copy-btn" class="pm-btn-p" style="padding:11px 13px;font-size:12px;white-space:nowrap;" title="Copy code">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
              <div id="pm-invite-usage" style="color:#555;font-size:10px;margin-top:6px;text-align:center;"></div>
              <div id="pm-invite-copy-status" style="font-size:11px;margin-top:5px;text-align:center;display:none;color:#FFD700;"></div>
            </div>
          </div>

          <!-- Apply Invitation Code -->
          <div class="pm-card" id="pm-apply-invite-card">
            <div class="pm-card-title"><i class="fas fa-gift"></i> Apply Invitation Code</div>
            <p style="color:#666;font-size:11px;margin:0 0 10px;">Enter a friend's invitation code to get <strong style="color:#FFD700;">30 days FREE Premium</strong></p>
            <div style="display:flex;gap:8px;">
              <input type="text" id="pm-invite-input" class="pm-input" placeholder="Friend's code..." maxlength="10"
                style="flex:1;padding:11px 13px;font-size:13px;letter-spacing:1px;text-transform:uppercase;">
              <button id="pm-invite-apply-btn" class="pm-btn-p" style="padding:11px 15px;font-size:12px;white-space:nowrap;">
                <i class="fas fa-check"></i>
              </button>
            </div>
            <div id="pm-invite-status" class="pm-vs"></div>
          </div>

          <!-- Newsletter -->
          <div class="pm-card" id="pm-newsletter-card">
            <div class="pm-card-title"><i class="fas fa-envelope-open-text"></i> Email Newsletter</div>
            <p style="color:#666;font-size:11px;margin:0 0 12px;">Get weekly <strong style="color:#FFD700;">"What's New on JFlix"</strong> updates — new releases, trending picks, and exclusive offers.</p>
            <div id="pm-newsletter-status" style="font-size:12px;margin-bottom:10px;display:none;padding:8px 10px;border-radius:8px;"></div>
            <div style="display:flex;align-items:center;gap:10px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#ccc;user-select:none;">
                <input type="checkbox" id="pm-newsletter-toggle" style="width:18px;height:18px;accent-color:#e50914;cursor:pointer;">
                Subscribe to weekly newsletter
              </label>
            </div>
            <div id="pm-newsletter-email-display" style="color:#555;font-size:11px;margin-top:8px;display:none;"></div>
          </div>

          <!-- Sign out -->
          <button onclick="jflixAuth.logout();closeProfileModal();" class="pm-btn-s">
            <i class="fas fa-sign-out-alt"></i> Sign Out
          </button>

        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // Close on backdrop click
  document.getElementById('profile-modal').addEventListener('click', (e) => {
    if (e.target.id === 'profile-modal') closeProfileModal();
  });

  // Voucher
  const redeemBtn = document.getElementById('pm-redeem-btn');
  const voucherInput = document.getElementById('pm-voucher-input');
  if (redeemBtn) redeemBtn.addEventListener('click', pmRedeemVoucher);
  if (voucherInput) voucherInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') pmRedeemVoucher();
  });

  // Invitation
  pmLoadInvitationCode();
  const applyBtn = document.getElementById('pm-invite-apply-btn');
  const inviteInput = document.getElementById('pm-invite-input');
  if (applyBtn) applyBtn.addEventListener('click', pmApplyInvitation);
  if (inviteInput) inviteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') pmApplyInvitation();
  });
  const copyBtn = document.getElementById('pm-invite-copy-btn');
  const codeDisplay = document.getElementById('pm-invite-code-display');
  if (copyBtn) copyBtn.addEventListener('click', pmCopyInviteCode);
  if (codeDisplay) codeDisplay.addEventListener('click', pmCopyInviteCode);

  // Newsletter
  pmLoadNewsletterStatus();
  const newsletterToggle = document.getElementById('pm-newsletter-toggle');
  if (newsletterToggle) {
    newsletterToggle.addEventListener('change', function() {
      if (this.checked) {
        pmNewsletterSubscribe();
      } else {
        pmNewsletterUnsubscribe();
      }
    });
  }
}

// ── Newsletter functions ────────────────────────────────────────────────────
async function pmLoadNewsletterStatus() {
  try {
    const token = jflixAuth.getToken();
    if (!token) return;
    const res = await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/auth/newsletter/status', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.success) {
      const toggle = document.getElementById('pm-newsletter-toggle');
      const emailDisplay = document.getElementById('pm-newsletter-email-display');
      if (toggle) toggle.checked = data.subscribed;
      if (emailDisplay && data.email) {
        emailDisplay.style.display = 'block';
        emailDisplay.innerHTML = '<i class="fas fa-envelope" style="margin-right:4px;"></i> Newsletter emails will be sent to: <strong style="color:#aaa;">' + data.email + '</strong>';
      }
    }
  } catch (e) {
    console.error('[Newsletter] Status load failed:', e);
  }
}

async function pmNewsletterSubscribe() {
  const status = document.getElementById('pm-newsletter-status');
  try {
    const token = jflixAuth.getToken();
    if (!token) { if (status) { status.style.display = 'block'; status.style.background = 'rgba(229,9,20,.15)'; status.style.color = '#e50914'; status.textContent = 'Please log in first.'; } return; }
    if (status) { status.style.display = 'block'; status.style.background = 'rgba(46,204,113,.1)'; status.style.color = '#2ecc71'; status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subscribing...'; }
    const res = await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/auth/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.success) {
      if (status) { status.style.background = 'rgba(46,204,113,.12)'; status.style.color = '#2ecc71'; status.innerHTML = '<i class="fas fa-check-circle"></i> Subscribed! Check your email for confirmation.'; }
    } else {
      if (status) { status.style.background = 'rgba(229,9,20,.15)'; status.style.color = '#e50914'; status.textContent = data.error || 'Failed to subscribe.'; }
      const toggle = document.getElementById('pm-newsletter-toggle'); if (toggle) toggle.checked = false;
    }
  } catch (e) {
    if (status) { status.style.background = 'rgba(229,9,20,.15)'; status.style.color = '#e50914'; status.textContent = 'Network error. Please try again.'; }
    const toggle = document.getElementById('pm-newsletter-toggle'); if (toggle) toggle.checked = false;
  }
}

async function pmNewsletterUnsubscribe() {
  const status = document.getElementById('pm-newsletter-status');
  try {
    const token = jflixAuth.getToken();
    if (!token) return;
    if (status) { status.style.display = 'block'; status.style.background = 'rgba(255,255,255,.05)'; status.style.color = '#888'; status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Unsubscribing...'; }
    const res = await fetch('https://jflix-api.junrel-sapantaicloud.workers.dev/api/auth/newsletter/unsubscribe', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.success) {
      if (status) { status.style.background = 'rgba(255,255,255,.05)'; status.style.color = '#888'; status.innerHTML = '<i class="fas fa-times"></i> Unsubscribed. You won\'t receive newsletter emails.'; }
    } else {
      if (status) { status.style.background = 'rgba(229,9,20,.15)'; status.style.color = '#e50914'; status.textContent = data.error || 'Failed to unsubscribe.'; }
      const toggle = document.getElementById('pm-newsletter-toggle'); if (toggle) toggle.checked = true;
    }
  } catch (e) {
    if (status) { status.style.background = 'rgba(229,9,20,.15)'; status.style.color = '#e50914'; status.textContent = 'Network error. Please try again.'; }
    const toggle = document.getElementById('pm-newsletter-toggle'); if (toggle) toggle.checked = true;
  }
}

function openProfileModal() {
  createProfileModal();
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    pmLoadUserProfile();
  }
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    // Remove from DOM so it rebuilds fresh next open (no stale styles)
    modal.parentElement.remove();
  }
}

async function pmLoadUserProfile() {
  const user = await jflixAuth.fetchCurrentUser();
  if (!user) return;

  const av = document.getElementById('pm-avatar');
  const nm = document.getElementById('pm-name');
  const em = document.getElementById('pm-email');
  if (av) {
    av.onerror = function() { this.onerror = null; this.src = 'images/icon-192x192.png'; };
    // Use Google picture (avatar), Supabase avatarUrl, or fallback to JFlix icon
    av.src = user.picture || user.avatarUrl || user.avatar_url || 'images/icon-192x192.png';
  }
  if (nm) nm.textContent = user.nickname || user.name || 'User';
  if (em) em.textContent = user.email || '';

  const nick = document.getElementById('pm-nickname');
  const bio  = document.getElementById('pm-bio');
  const loc  = document.getElementById('pm-location');
  if (nick) nick.value = user.nickname || '';
  if (bio)  bio.value  = user.bio || '';
  if (loc)  loc.value  = user.location || '';

  // Get Premium button always visible in modal
  const premiumBtn = document.getElementById('pm-get-premium-btn');
  if (premiumBtn) {
    premiumBtn.style.display = 'flex';
  }

  // Handle message admin button visibility
  const messageAdminBtn = document.getElementById('pm-message-admin-btn');
  console.log('Message admin button check:', { messageAdminBtn, email: user.email });
  
  if (messageAdminBtn) {
    // Hide if user is admin
    if (user.email && user.email.includes('admin')) {
      messageAdminBtn.style.display = 'none';
      console.log('Hiding message admin button for admin user');
    } else {
      messageAdminBtn.style.display = 'flex';
      console.log('Showing message admin button for regular user');
    }
  }

  // Fetch and update unread count
  updateUnreadMessageCount();

  // Stats
  const created = user.createdAt || user.created_at;
  if (created) {
    const days = Math.floor((new Date() - new Date(created)) / 86400000);
    const el = document.getElementById('pm-stat-days');
    if (el) el.textContent = days;
  }
  const sc = document.getElementById('pm-stat-comments');
  const sr = document.getElementById('pm-stat-reactions');
  const sv = document.getElementById('pm-stat-views');
  if (sc) sc.textContent = user.commentCount  || user.comment_count  || 0;
  if (sr) sr.textContent = user.reactionCount || user.reaction_count || 0;
  if (sv) sv.textContent = user.viewCount     || user.view_count     || 0;

  pmUpdateSubscriptionUI(user);
}

// Update unread message count badges
async function updateUnreadMessageCount() {
  try {
    const token = localStorage.getItem('jflix_auth_token');
    if (!token) return;

    const res = await fetch(jflixAuth.apiUrl + '/messages/unread-count', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const data = await res.json();
    if (data.success) {
      const unreadCount = data.unreadCount || 0;
      
      // Update profile modal badge
      const pmBadge = document.getElementById('pm-message-unread-badge');
      if (pmBadge) {
        if (unreadCount > 0) {
          pmBadge.textContent = unreadCount;
          pmBadge.style.display = 'inline-block';
        } else {
          pmBadge.style.display = 'none';
        }
      }
      
      // Update header profile badge
      const headerBadge = document.getElementById('header-profile-unread-badge');
      if (headerBadge) {
        if (unreadCount > 0) {
          headerBadge.textContent = unreadCount;
          headerBadge.style.display = 'flex';
        } else {
          headerBadge.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch unread count:', error);
  }
}

// Mark messages as read and update badges
async function markMessagesAsRead() {
  try {
    const token = localStorage.getItem('jflix_auth_token');
    if (!token) return;

    const res = await fetch(jflixAuth.apiUrl + '/messages/mark-read', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const data = await res.json();
    if (data.success) {
      // Update badges to hide them
      const pmBadge = document.getElementById('pm-message-unread-badge');
      if (pmBadge) pmBadge.style.display = 'none';
      
      const headerBadge = document.getElementById('header-profile-unread-badge');
      if (headerBadge) headerBadge.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to mark messages as read:', error);
  }
}

function pmUpdateSubscriptionUI(user) {
  const inner   = document.getElementById('pm-inner');
  const header  = document.getElementById('pm-header');
  const cover    = document.getElementById('pm-cover');
  const coverLine = document.getElementById('pm-cover-line');
  const avatar  = document.getElementById('pm-avatar');
  const crown   = document.getElementById('pm-crown');
  const name    = document.getElementById('pm-name');
  const badge   = document.getElementById('pm-badge');
  const subCard = document.getElementById('pm-sub-card');
  const subTitle = document.getElementById('pm-sub-title');
  const subContent = document.getElementById('pm-sub-content');

  const isPremium  = user.subscriptionType === 'premium' || user.subscription_type === 'premium';
  const expiryDate = user.subscriptionExpiresAt || user.subscription_expires_at;
  const isExpired  = expiryDate && new Date(expiryDate) < new Date();

  if (isPremium && !isExpired) {
    if (inner)  inner.classList.add('pm-premium');
    if (header) header.classList.add('pm-prem-hdr');
    if (cover) { cover.classList.add('pm-prem-cover'); cover.style.cssText = 'height:96px;position:relative;overflow:hidden;background:#1c1608;'; }
    if (coverLine) coverLine.classList.add('pm-prem-divider');
    if (avatar) avatar.classList.add('pm-prem-av');
    if (crown)  crown.style.display = 'block';
    if (name)   name.classList.add('pm-prem-name');
    if (subCard) subCard.classList.add('pm-prem-card');
    if (subTitle) subTitle.querySelector('i').style.color = '#FFD700';
    if (badge) {
      badge.className = 'pm-prem-badge';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:20px;font-size:11px;';
      badge.innerHTML = '<i class="fas fa-crown"></i> PREMIUM MEMBER';
    }
    let daysText = 'Lifetime Access';
    let daysSub = '';
    if (expiryDate) {
      const d = Math.ceil((new Date(expiryDate) - new Date()) / 86400000);
      daysText = d + ' days remaining';
      daysSub = `<div style="font-size:9.5px;color:rgba(255,215,0,.6);margin-top:1px;">Expires ${new Date(expiryDate).toLocaleDateString()}</div>`;
    }
    if (subContent) subContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:12px;">
        <div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#FFD700,#FFA500);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(255,180,0,.35);flex-shrink:0;">
          <i class="fas fa-crown" style="color:#3a2800;font-size:15px;"></i>
        </div>
        <div>
          <div style="color:#FFD700;font-size:14px;font-weight:800;line-height:1.1;">Premium Member</div>
          <div style="color:rgba(255,215,0,.65);font-size:10px;">Active subscription</div>
        </div>
      </div>
      <div style="background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.18);border-radius:10px;padding:10px 11px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-clock" style="color:#FFA500;font-size:12px;"></i>
        <div><div style="color:#FFD700;font-size:12px;font-weight:700;line-height:1.1;">${daysText}</div>${daysSub}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        <div style="color:#cabd8f;font-size:11px;display:flex;align-items:center;gap:7px;"><i class="fas fa-check-circle" style="color:#FFD700;font-size:10px;"></i> Ad-free experience</div>
        <div style="color:#cabd8f;font-size:11px;display:flex;align-items:center;gap:7px;"><i class="fas fa-check-circle" style="color:#FFD700;font-size:10px;"></i> Full HD streaming</div>
        <div style="color:#cabd8f;font-size:11px;display:flex;align-items:center;gap:7px;"><i class="fas fa-check-circle" style="color:#FFD700;font-size:10px;"></i> Exclusive content</div>
      </div>
    `;
  } else {
    if (inner)  inner.classList.remove('pm-premium');
    if (header) header.classList.remove('pm-prem-hdr');
    if (cover) { cover.classList.remove('pm-prem-cover'); cover.style.cssText = 'height:96px;position:relative;overflow:hidden;background:linear-gradient(135deg,#1a0a0e,#2d0a11 30%,#1a1a2e 70%,#0f0f23);'; }
    if (coverLine) coverLine.classList.remove('pm-prem-divider');
    if (avatar) avatar.classList.remove('pm-prem-av');
    if (crown)  crown.style.display = 'none';
    if (name)   name.classList.remove('pm-prem-name');
    if (subCard) subCard.classList.remove('pm-prem-card');
    if (subTitle) subTitle.querySelector('i').style.color = '#e50914';
    if (badge) {
      badge.className = '';
      const isSupabase = user.authProvider === 'supabase';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:rgba(229,9,20,.15);color:#e50914;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid rgba(229,9,20,.3);';
      badge.innerHTML = isSupabase ? '<i class="fas fa-envelope"></i> Email Account' : '<i class="fab fa-google"></i> Google Account';
    }
    const isSupabaseFree = user.authProvider === 'supabase';
    if (subContent) subContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;color:#aaa;font-size:13px;margin-bottom:8px;font-weight:600;"><i class="fas fa-user"></i> Free Member</div>
      <p style="color:#666;font-size:11px;margin:0 0 10px;">${isExpired ? '<span style="color:#e50914;"><i class="fas fa-exclamation-circle"></i> Premium expired</span>' : 'Upgrade to Premium for exclusive benefits'}</p>
      <div style="background:linear-gradient(160deg,rgba(255,215,0,.1),rgba(255,160,0,.03));border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:11px;margin-bottom:0;">
        <div style="color:#FFD700;font-size:11px;font-weight:700;margin-bottom:6px;"><i class="fas fa-star"></i> Premium Perks</div>
        <div style="color:#9a8f6f;font-size:10.5px;line-height:1.7;">Ad-free · Full HD · Exclusive content</div>
      </div>
    `;
  }
}

async function pmRedeemVoucher() {
  const input = document.getElementById('pm-voucher-input');
  const status = document.getElementById('pm-vs');
  const code = input.value.trim().toUpperCase();

  if (!code) {
    status.className = 'pm-vs error';
    status.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter a voucher code';
    return;
  }

  status.className = 'pm-vs';
  status.style.display = 'block';
  status.style.background = 'rgba(255,255,255,.05)';
  status.style.color = '#aaa';
  status.style.border = 'none';
  status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Redeeming...';

  try {
    const response = await fetch(jflixAuth.apiUrl + '/vouchers/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token')
      },
      body: JSON.stringify({ code })
    });
    const data = await response.json();
    if (data.success) {
      status.className = 'pm-vs success';
      status.innerHTML = '<i class="fas fa-check-circle"></i> ' + data.message;
      input.value = '';
      await pmLoadUserProfile();
    } else {
      status.className = 'pm-vs error';
      status.innerHTML = '<i class="fas fa-times-circle"></i> ' + data.error;
    }
  } catch (err) {
    status.className = 'pm-vs error';
    status.innerHTML = '<i class="fas fa-times-circle"></i> Failed to redeem. Please try again.';
  }
}

// ── Invitation Code functions ─────────────────────────────────────────────────

async function pmLoadInvitationCode() {
  const loading = document.getElementById('pm-invite-loading');
  const section = document.getElementById('pm-invite-code-section');
  const display = document.getElementById('pm-invite-code-display');
  const usage   = document.getElementById('pm-invite-usage');
  const applyCard = document.getElementById('pm-apply-invite-card');

  try {
    const res = await fetch(jflixAuth.apiUrl + '/invitations/my-code', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token') }
    });
    const data = await res.json();
    if (data.success) {
      if (display) display.textContent = data.code;
      if (usage) usage.textContent = data.timesUsed > 0
        ? `Used ${data.timesUsed} time${data.timesUsed !== 1 ? 's' : ''} · Each use gives you both 30 days Premium`
        : 'Not used yet · Share and both get 30 days Premium!';
      if (loading) loading.style.display = 'none';
      if (section) section.style.display = 'block';

      // Hide "Apply" card if already used an invitation themselves
      // (API won't block it — UI hint only; server enforces)
    } else {
      if (loading) loading.textContent = 'Could not load invitation code';
    }
  } catch (err) {
    if (loading) loading.textContent = 'Could not load invitation code';
  }
}

function pmCopyInviteCode() {
  const display = document.getElementById('pm-invite-code-display');
  const status  = document.getElementById('pm-invite-copy-status');
  if (!display || !display.textContent) return;
  const code = display.textContent.trim();
  try {
    navigator.clipboard.writeText(code).then(() => {
      if (status) { status.textContent = '✓ Code copied!'; status.style.display = 'block'; setTimeout(() => { status.style.display = 'none'; }, 2000); }
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      if (status) { status.textContent = '✓ Code copied!'; status.style.display = 'block'; setTimeout(() => { status.style.display = 'none'; }, 2000); }
    });
  } catch (_) {}
}

async function pmApplyInvitation() {
  const input  = document.getElementById('pm-invite-input');
  const status = document.getElementById('pm-invite-status');
  const btn    = document.getElementById('pm-invite-apply-btn');
  const code   = (input ? input.value.trim().toUpperCase() : '');

  if (!code) {
    if (status) { status.className = 'pm-vs error'; status.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please enter an invitation code'; }
    return;
  }

  if (status) { status.className = 'pm-vs'; status.style.display = 'block'; status.style.background = 'rgba(255,255,255,.05)'; status.style.color = '#aaa'; status.style.border = 'none'; status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...'; }
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(jflixAuth.apiUrl + '/invitations/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('jflix_auth_token') },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (data.success) {
      if (status) { status.className = 'pm-vs success'; status.innerHTML = '<i class="fas fa-check-circle"></i> ' + data.message; }
      if (input) input.value = '';
      // Refresh profile to show new premium status
      await jflixAuth.fetchCurrentUser();
      await pmLoadUserProfile();
      await pmLoadInvitationCode();
    } else {
      if (status) { status.className = 'pm-vs error'; status.innerHTML = '<i class="fas fa-times-circle"></i> ' + data.error; }
    }
  } catch (err) {
    if (status) { status.className = 'pm-vs error'; status.innerHTML = '<i class="fas fa-times-circle"></i> Failed to apply. Please try again.'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Handle force-logout verification link: ?jflix_force_logout=TOKEN
// Called when the user clicks the verification email link
async function handleForceLogoutLink() {
  const params = new URLSearchParams(window.location.search);
  const flToken = params.get('jflix_force_logout');
  if (!flToken) return false;

  // Remove param from URL without reload
  const cleanUrl = window.location.href.replace(/[?&]jflix_force_logout=[^&]+/, '').replace(/\?$/, '');
  window.history.replaceState({}, '', cleanUrl);

  const apiUrl = 'https://jflix-api.junrel-sapantaicloud.workers.dev/api';
  try {
    const res = await fetch(`${apiUrl}/auth/execute-force-logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: flToken })
    });
    const data = await res.json();

    const div = document.createElement('div');
    div.id = 'force-logout-result-modal';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:1000010;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);padding:20px;box-sizing:border-box;';
    const safeErr = (data.error || 'The link may have expired or already been used.').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (data.success) {
      div.innerHTML = `
        <div style="background:linear-gradient(135deg,#0a1a0a,#0d2a0d);border-radius:20px;max-width:400px;width:100%;padding:36px 28px;border:1px solid rgba(46,204,113,.3);box-shadow:0 30px 80px rgba(0,0,0,.6);text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">✅</div>
          <h3 style="color:#fff;margin:0 0 10px;font-size:20px;font-weight:700;">All Other Devices Logged Out</h3>
          <p style="color:#aaa;font-size:13px;margin:0 0 24px;line-height:1.6;">Your account has been secured. You can now sign in on your other device.</p>
          <button onclick="document.getElementById('force-logout-result-modal').remove()" style="background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Done</button>
        </div>`;
    } else {
      div.innerHTML = `
        <div style="background:#1a1a2e;border-radius:20px;max-width:400px;width:100%;padding:36px 28px;border:1px solid rgba(229,9,20,.3);text-align:center;">
          <div style="font-size:48px;margin-bottom:16px;">❌</div>
          <h3 style="color:#fff;margin:0 0 10px;font-size:20px;">Verification Failed</h3>
          <p style="color:#888;font-size:13px;margin:0 0 24px;">${safeErr}</p>
          <button onclick="document.getElementById('force-logout-result-modal').remove()" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;padding:12px 28px;border-radius:10px;font-size:14px;cursor:pointer;">Close</button>
        </div>`;
    }
    document.body.appendChild(div);
  } catch (err) {
    console.error('[ForceLogout] Error:', err);
  }
  return true;
}

// Initialize auth UI when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  jflixAuth.updateAuthUI();

  // Handle Supabase OAuth callback (Google Sign-In redirect)
  const oauthHandled = await jflixAuth.handleSupabaseOAuthCallback();
  if (oauthHandled) {
    console.log('[Auth] OAuth callback handled successfully');
    return; // Skip auth modal if OAuth was handled
  }

  // Handle force-logout verification link (from email)
  const forceLogoutHandled = await handleForceLogoutLink();
  if (forceLogoutHandled) return;

  // Electron/Android App/Localhost: show sign-in modal on startup if not authenticated
  // System browsers excluded - should show Get Premium button instead
  if (SHOULD_SHOW_AUTH_MODAL && !jflixAuth.isAuthenticated()) {
    setTimeout(() => jflixAuth.openAuthModal(), 400);
  } else if (SHOULD_SHOW_AUTH_MODAL && jflixAuth.isAuthenticated()) {
    // If user is authenticated but modal is open, close it
    const modal = document.getElementById('auth-modal');
    if (modal && modal.style.display === 'flex') {
      jflixAuth.closeAuthModal();
    }
  }
  
  // Periodically check subscription status (every 30 seconds)
  setInterval(async () => {
    if (jflixAuth.isAuthenticated()) {
      const user = await jflixAuth.fetchCurrentUser();
      if (user) {
        jflixAuth.updateAuthUI();
        // Update profile modal if open
        if (document.getElementById('profile-modal') && document.getElementById('profile-modal').style.display !== 'none') {
          pmLoadUserProfile();
        }
      }
    }
  }, 30000); // Check every 30 seconds
  
  // Add click handlers for login buttons - directly opens auth modal
  document.querySelectorAll('.login-btn').forEach(btn => {
    btn.addEventListener('click', () => jflixAuth.openAuthModal());
  });

  // Add click handlers for logout buttons
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => jflixAuth.logout());
  });

  // Intercept profile link in navbar — open modal instead of navigating
  // Use event delegation to handle dynamically added elements
  // Support both click and touch events for mobile compatibility
  function handleProfileClick(e) {
    if (e.target.closest('.logout-btn') || e.target.closest('.get-premium-btn')) {
      return;
    }
    const profileLink = e.target.closest('.user-menu a, .user-avatar, .user-name');
    const isUserMenu = e.target.closest('.user-menu');
    
    if (profileLink || (isUserMenu && !e.target.closest('button'))) {
      console.log('Profile clicked, handling navigation/modal');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (jflixAuth && typeof jflixAuth.isAuthenticated === 'function' && jflixAuth.isAuthenticated()) {
        if (window.location.pathname.includes('profile.html')) {
          if (window.hideLoader) window.hideLoader();
          return false;
        }
        openProfileModal();
      } else {
        if (jflixAuth && typeof jflixAuth.openAuthModal === 'function') {
          jflixAuth.openAuthModal();
        } else {
          window.location.href = 'profile.html';
        }
      }

      // Hide any page loader triggered by the link click
      if (window.hideLoader) window.hideLoader();
      return false;
    }
  }

  document.addEventListener('click', handleProfileClick, true); // Use capture phase to catch the event earlier
  document.addEventListener('touchstart', handleProfileClick, { passive: false, capture: true });
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const chatModal = document.getElementById('chat-modal');
    if (chatModal && chatModal.style.display === 'flex') { closeChatModal(); return; }
    const premModal = document.getElementById('prem-modal');
    if (premModal && premModal.style.display === 'flex') { closePremiumModal(); return; }
    const profileModal = document.getElementById('profile-modal');
    if (profileModal && profileModal.style.display === 'flex') { closeProfileModal(); return; }
    // In Electron, don't allow closing the auth modal via Escape
    if (!SHOULD_SHOW_AUTH_MODAL) jflixAuth.closeAuthModal();
  }
});

// Create floating chat button
function createChatFAB() {
  if (document.getElementById('chat-fab')) return;
  const btn = document.createElement('button');
  btn.id = 'chat-fab';
  btn.innerHTML = '<i class="fas fa-comment-dots"></i>';
  btn.title = 'Message Admin Support';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:linear-gradient(135deg,#009cde,#0078b5);border:none;border-radius:50%;color:#fff;font-size:24px;cursor:pointer;z-index:1000010;box-shadow:0 4px 16px rgba(0,132,255,.4);display:flex;align-items:center;justify-content:center;transition:all .2s;';
  btn.onmouseover = () => { btn.style.transform = 'scale(1.1)'; btn.style.boxShadow = '0 6px 24px rgba(0,132,255,.6)'; };
  btn.onmouseout = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 4px 16px rgba(0,132,255,.4)'; };
  btn.onclick = () => openChatModal();
  document.body.appendChild(btn);
}

// Inject chat FAB on page load (disabled)
// document.addEventListener('DOMContentLoaded', () => {
//   createChatFAB();
// });

} // end else block (native apps/localhost/iOS PWA only)
