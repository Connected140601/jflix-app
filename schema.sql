-- JFlix Database Schema for Cloudflare D1
-- Version 5.2
-- This schema supports comments, reactions, and view counts

-- Users table for nickname management
-- NOTE: Existing deployments may need ALTER TABLE to add missing columns
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  google_id TEXT,
  email TEXT,
  avatar_url TEXT,
  auth_provider TEXT DEFAULT 'local',
  is_active INTEGER DEFAULT 1,
  subscription_type TEXT DEFAULT 'free',
  subscription_expires_at DATETIME,
  voucher_code TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- View counts table
CREATE TABLE IF NOT EXISTS view_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL, -- 'movie', 'tv', 'anime', 'korean', 'cartoon'
  media_id INTEGER NOT NULL, -- TMDB ID
  season_number INTEGER, -- For TV shows/anime
  episode_number INTEGER, -- For TV shows/anime
  view_count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_type, media_id, season_number, episode_number)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL, -- 'movie', 'tv', 'anime', 'korean', 'cartoon'
  media_id INTEGER NOT NULL, -- TMDB ID
  season_number INTEGER, -- For TV shows/anime
  episode_number INTEGER, -- For TV shows/anime
  user_id TEXT NOT NULL, -- Reference to users.user_id
  nickname TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  admin_seen INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL, -- 'movie', 'tv', 'anime', 'korean', 'cartoon'
  media_id INTEGER NOT NULL, -- TMDB ID
  season_number INTEGER, -- For TV shows/anime
  episode_number INTEGER, -- For TV shows/anime
  user_id TEXT NOT NULL, -- Reference to users.user_id
  reaction_type TEXT NOT NULL, -- 'like', 'love', 'laugh', 'wow', 'sad', 'angry'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_type, media_id, season_number, episode_number, user_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Reaction counts table (aggregated)
CREATE TABLE IF NOT EXISTS reaction_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  season_number INTEGER,
  episode_number INTEGER,
  reaction_type TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_type, media_id, season_number, episode_number, reaction_type)
);

-- Comment replies table
CREATE TABLE IF NOT EXISTS comment_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  reply_text TEXT NOT NULL,
  is_admin_reply INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Image uploads table (R2 bucket tracking with 24h expiration)
CREATE TABLE IF NOT EXISTS image_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+24 hours')),
  content_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_image_uploads_expires ON image_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_image_uploads_key ON image_uploads(r2_key);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_view_counts_media ON view_counts(media_type, media_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_comments_media ON comments(media_type, media_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_media ON reactions(media_type, media_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id, media_type, media_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_reaction_counts_media ON reaction_counts(media_type, media_id, season_number, episode_number);

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  download_type TEXT NOT NULL UNIQUE,
  download_count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  duration_days INTEGER,
  expires_at DATETIME,
  created_by TEXT,
  is_active INTEGER DEFAULT 1,
  used_by TEXT,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  location TEXT,
  website TEXT,
  birth_date TEXT,
  preferences TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User activity log table
CREATE TABLE IF NOT EXISTS user_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  reactions TEXT DEFAULT '[]',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  last_message_id INTEGER,
  last_message_at DATETIME,
  unread_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_admin ON conversations(admin_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique ON conversations(user_id, admin_id);

-- Newsletter subscribers table
-- Tracks which users have opted in to receive weekly "What's New on JFlix" emails
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nickname TEXT,
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- Newsletter log table — tracks sent newsletters
CREATE TABLE IF NOT EXISTS newsletter_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  recipient_count INTEGER DEFAULT 0,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_log_sent ON newsletter_log(sent_at DESC);
