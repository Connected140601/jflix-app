/**
 * Supabase Authentication Module
 * Handles email/password and Google OAuth authentication
 * Version 2.1 - Enhanced error handling and edge case coverage
 */

class SupabaseAuth {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || 'https://jflix-api.junrel-sapantaicloud.workers.dev/api';
    this.supabase = null;
    this.user = null;
    this.session = null;
    this._clientPromise = null;
  }

  async getClient() {
    // Cache the client promise to avoid multiple SDK loads
    if (!this._clientPromise) {
      this._clientPromise = this._initializeClient();
    }
    return this._clientPromise;
  }

  async _initializeClient() {
    try {
      if (!window.SupabaseConfig) {
        throw new Error('SupabaseConfig not found. Ensure supabase-config.js is loaded.');
      }
      await window.SupabaseConfig.loadSupabaseSDK();
      this.supabase = window.SupabaseConfig.getSupabaseClient();
      if (!this.supabase) {
        throw new Error('Failed to get Supabase client from SupabaseConfig');
      }
      return this.supabase;
    } catch (error) {
      console.error('[Supabase Auth] Client initialization error:', error);
      this._clientPromise = null; // Reset promise on error
      throw error;
    }
  }

  // Sign up - handles both email confirmation modes
  async signUp(email, password, displayName, callback) {
    try {
      // Validate inputs
      if (!email || !password) {
        const error = new Error('Email and password are required');
        if (callback) callback(error, null);
        return;
      }

      const sb = await this.getClient();
      // Use canonical URL so email links always redirect to production site
      // (important for Android WebView where window.location.origin may differ)
      const redirectBase = 'https://jflix.uk';
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectBase,
          data: { full_name: displayName || email.split('@')[0] }
        }
      });

      if (error) {
        console.error('[Supabase Auth] Sign up error:', error);
        if (callback) callback(error, null);
        return;
      }

      console.log('[Supabase Auth] Sign up success:', data);

      // If Supabase returned a session immediately (email confirmation OFF),
      // sync with backend right away so the user is fully signed in
      if (data.session) {
        this.session = data.session;
        this.user = data.user;
        const backendData = await this.syncWithBackend(data.session);
        if (callback) callback(null, {
          success: true,
          requiresConfirmation: false,
          hasSession: true,
          session: data.session,
          supabaseUser: data.user,
          backendData,
          email
        });
        return;
      }

      // No session — email confirmation is ON (user must verify first)
      if (callback) callback(null, {
        success: true,
        requiresConfirmation: true,
        hasSession: false,
        email,
        message: 'Confirmation email sent! Check your inbox to verify your account.'
      });
    } catch (err) {
      console.error('[Supabase Auth] Sign up exception:', err);
      if (callback) callback(err, null);
    }
  }

  // Sign in with Google OAuth
  async signInWithGoogle(callback) {
    try {
      const sb = await this.getClient();

      // Check if there's already a valid Supabase session — skip OAuth redirect if so
      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData && sessionData.session) {
        console.log('[Supabase Auth] Existing session found, skipping Google redirect');
        this.session = sessionData.session;
        this.user = sessionData.session.user;
        const backendData = await this.syncWithBackend(sessionData.session);
        
        if (callback) callback(null, { success: true, session: sessionData.session, backendData });
        return;
      }

      // No existing session — trigger OAuth redirect
      const redirectBase = (window.location.origin || 'https://jflix.uk').replace(/\/+$/, '') + '/';
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectBase,
          queryParams: {
            prompt: 'select_account',
          }
        }
      });

      if (error) {
        console.error('[Supabase Auth] Google sign in error:', error);
        if (callback) callback(error, null);
        return;
      }

      console.log('[Supabase Auth] Google sign in initiated:', data);
      // OAuth flow will redirect, so we don't return a callback here
      // The callback will be handled by the URL hash on redirect
    } catch (err) {
      console.error('[Supabase Auth] Google sign in exception:', err);
      if (callback) callback(err, null);
    }
  }

  // Sign in - returns Supabase session + backend data via callback
  async signIn(email, password, callback) {
    try {
      // Validate inputs
      if (!email || !password) {
        const error = new Error('Email and password are required');
        if (callback) callback(error, null);
        return;
      }

      const sb = await this.getClient();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('[Supabase Auth] Sign in error:', error);
        if (callback) callback(error, null);
        return;
      }

      console.log('[Supabase Auth] Sign in success, syncing with backend...');
      this.session = data.session;
      this.user = data.user;

      // Sync with JFlix backend and return combined result
      const backendData = await this.syncWithBackend(data.session);

      if (callback) callback(null, {
        success: true,
        session: data.session,
        supabaseUser: data.user,
        backendData
      });
    } catch (err) {
      console.error('[Supabase Auth] Sign in exception:', err);
      if (callback) callback(err, null);
    }
  }

  // Sign out
  async signOut(callback) {
    try {
      const sb = await this.getClient();
      const { error } = await sb.auth.signOut();

      this.session = null;
      this.user = null;
      this._clientPromise = null; // Reset client promise

      localStorage.removeItem('jflix_auth_token');
      localStorage.removeItem('jflix_user');
      localStorage.removeItem('jflix_user_id');

      if (error) console.error('[Supabase Auth] Sign out error:', error);
      if (callback) callback(error || null);
    } catch (err) {
      console.error('[Supabase Auth] Sign out exception:', err);
      // Still clear local data even if sign out fails
      this.session = null;
      this.user = null;
      this._clientPromise = null;
      localStorage.removeItem('jflix_auth_token');
      localStorage.removeItem('jflix_user');
      localStorage.removeItem('jflix_user_id');
      if (callback) callback(err);
    }
  }

  // Forgot password - sends reset link
  async resetPassword(email, callback) {
    try {
      if (!email) {
        const error = new Error('Email is required');
        if (callback) callback(error, null);
        return;
      }

      const sb = await this.getClient();
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://jflix.uk/reset-password.html'
      });

      if (error) {
        if (callback) callback(error, null);
        return;
      }

      if (callback) callback(null, {
        success: true,
        message: 'Password reset link sent! Check your email.'
      });
    } catch (err) {
      console.error('[Supabase Auth] Reset password exception:', err);
      if (callback) callback(err, null);
    }
  }

  // Resend verification email
  async resendVerificationEmail(email, callback) {
    try {
      if (!email) {
        const error = new Error('Email is required');
        if (callback) callback(error, null);
        return;
      }

      const sb = await this.getClient();
      const { error } = await sb.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: 'https://jflix.uk' }
      });

      if (error) {
        if (callback) callback(error, null);
        return;
      }

      if (callback) callback(null, {
        success: true,
        message: 'Verification email resent!'
      });
    } catch (err) {
      console.error('[Supabase Auth] Resend verification exception:', err);
      if (callback) callback(err, null);
    }
  }

  // Check if current Supabase session has a verified email
  async checkEmailVerified() {
    try {
      const sb = await this.getClient();
      const { data: { user } } = await sb.auth.getUser();
      return user && !!user.email_confirmed_at;
    } catch {
      return false;
    }
  }

  // Get current Supabase session
  async getCurrentSession() {
    try {
      const sb = await this.getClient();
      const { data: { session } } = await sb.auth.getSession();
      return session;
    } catch {
      return null;
    }
  }

  // Sync Supabase session with JFlix backend
  async syncWithBackend(session) {
    try {
      if (!session || !session.user) {
        console.error('[Supabase Auth] Invalid session provided to syncWithBackend');
        return { success: false, error: 'Invalid session' };
      }

      // Extract Google picture from Supabase user metadata if available
      const googlePicture = session.user.user_metadata?.picture || session.user.user_metadata?.avatar_url;
      
      const response = await fetch(`${this.apiUrl}/auth/supabase/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseAccessToken: session.access_token,
          supabaseUserId: session.user.id,
          email: session.user.email,
          picture: googlePicture, // Send Google picture to backend
          authProvider: 'google' // Indicate this is Google OAuth
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase Auth] Backend sync HTTP error:', response.status, errorText);
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log('[Supabase Auth] Backend sync:', data.success ? 'OK' : data.error);

      if (data.success) {
        localStorage.setItem('jflix_auth_token', data.token);
        localStorage.setItem('jflix_user', JSON.stringify(data.user));
        localStorage.setItem('jflix_user_id', data.user.user_id);
      }

      return data;
    } catch (error) {
      console.error('[Supabase Auth] Sync error:', error);
      return { success: false, error: error.message };
    }
  }

  // Clear all cached data (useful for testing or forced logout)
  clearCache() {
    this.supabase = null;
    this.user = null;
    this.session = null;
    this._clientPromise = null;
  }
}

// Global instance (lazy - only used from auth.js helpers)
window._supabaseAuthInstance = null;
function getSupabaseAuthInstance() {
  if (!window._supabaseAuthInstance) {
    window._supabaseAuthInstance = new SupabaseAuth();
  }
  return window._supabaseAuthInstance;
}
