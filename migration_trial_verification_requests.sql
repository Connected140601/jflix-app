-- Migration: Add trial_verification_requests table
-- This table stores trial verification email requests

CREATE TABLE IF NOT EXISTS trial_verification_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_trial_verification_token ON trial_verification_requests(token);
CREATE INDEX IF NOT EXISTS idx_trial_verification_email ON trial_verification_requests(email);
