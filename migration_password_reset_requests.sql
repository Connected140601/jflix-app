-- Migration: Create password_reset_requests table
-- Description: Stores password reset requests with OTP verification codes
-- Created: 2026-06-06

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  user_id TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_token ON password_reset_requests(token);

-- Create index on email for user lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email ON password_reset_requests(email);

-- Create index on expires_at for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at ON password_reset_requests(expires_at);

-- Create index on otp_code for verification
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_otp_code ON password_reset_requests(otp_code);
