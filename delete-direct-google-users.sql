-- Delete Direct Google Sign-In Users (NOT Supabase Google users)
-- This script deletes users who signed in via direct Google OAuth
-- It PRESERVES Supabase Google users (google_id starts with 'supabase_')

-- ============================================
-- STEP 1: REVIEW USERS TO BE DELETED
-- ============================================
-- Run this first to see what will be deleted
SELECT 
  user_id,
  email,
  nickname,
  google_id,
  auth_provider,
  created_at,
  subscription_type
FROM users 
WHERE auth_provider = 'google' 
  AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%');

-- ============================================
-- STEP 2: DELETE RELATED DATA (Foreign Key Order)
-- ============================================

-- Delete from conversations (referenced by messages)
DELETE FROM conversations 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from messages
DELETE FROM messages 
WHERE sender_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
)
OR receiver_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from comment_replies
DELETE FROM comment_replies 
WHERE comment_id IN (
  SELECT id FROM comments 
  WHERE user_id IN (
    SELECT user_id FROM users 
    WHERE auth_provider = 'google' 
      AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
  )
);

-- Delete from reactions
DELETE FROM reactions 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from comments
DELETE FROM comments 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from user_activity_log
DELETE FROM user_activity_log 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from user_profiles
DELETE FROM user_profiles 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from user_sessions
DELETE FROM user_sessions 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- Delete from google_trial_claims
DELETE FROM google_trial_claims 
WHERE user_id IN (
  SELECT user_id FROM users 
  WHERE auth_provider = 'google' 
    AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%')
);

-- ============================================
-- STEP 3: DELETE THE USERS
-- ============================================
DELETE FROM users 
WHERE auth_provider = 'google' 
  AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%');

-- ============================================
-- STEP 4: VERIFY DELETION
-- ============================================
-- Run this to verify no direct Google users remain
SELECT COUNT(*) as remaining_direct_google_users
FROM users 
WHERE auth_provider = 'google' 
  AND (google_id IS NULL OR google_id NOT LIKE 'supabase_%');

-- Verify Supabase Google users are preserved
SELECT COUNT(*) as preserved_supabase_google_users
FROM users 
WHERE google_id LIKE 'supabase_%';
