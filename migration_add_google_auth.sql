-- Migration: Add Google OAuth authentication support
-- Version 7.0

-- Update users table to support Google OAuth
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'; -- 'local', 'google'
ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN last_login DATETIME;

-- Create user_sessions table for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create user_profiles table for extended profile information
CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  birth_date TEXT,
  preferences TEXT, -- JSON string for user preferences
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create user_activity_log table for tracking user actions
CREATE TABLE IF NOT EXISTS user_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login', 'logout', 'view', 'comment', etc.
  details TEXT, -- JSON string with additional details
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_log(created_at DESC);

-- Insert or update admin user with Google OAuth capability
INSERT OR IGNORE INTO users (user_id, nickname, email, auth_provider, is_active) 
VALUES ('admin-001', 'Admin', 'junrel.sapanta@icloud.com', 'local', 1);
