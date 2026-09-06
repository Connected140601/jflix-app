// Supabase Configuration
// Used for Android web browser and localhost authentication
// Version 1.0

const SUPABASE_URL = 'https://wqxnnplolrudxvaqfias.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxeG5ucGxvbHJ1ZHh2YXFmaWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODM4MDUsImV4cCI6MjA5NTU1OTgwNX0.tgDgxBtQ2i9dD4E1dGppmWeGg00FMPY1Kw9lqK0cBbs';

// Initialize Supabase client
let supabaseClient = null;

function getSupabaseClient() {
  if (!supabaseClient && typeof window !== 'undefined' && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseClient;
}

// Load Supabase SDK dynamically
function loadSupabaseSDK() {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.async = true;
    script.onload = () => {
      // Initialize client immediately after SDK loads
      if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            storage: localStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      }
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Export functions
window.SupabaseConfig = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  getSupabaseClient,
  loadSupabaseSDK
};
