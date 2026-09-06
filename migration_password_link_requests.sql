-- Migration: Create password_link_requests table
-- Description: Stores password link requests for Google users who want to add email/password authentication
-- Created: 2026-06-04

CREATE TABLE IF NOT EXISTS password_link_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_link_requests_token ON password_link_requests(token);

-- Create index on email for user lookups
CREATE INDEX IF NOT EXISTS idx_password_link_requests_email ON password_link_requests(email);

-- Create index on expires_at for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_link_requests_expires_at ON password_link_requests(expires_at);
