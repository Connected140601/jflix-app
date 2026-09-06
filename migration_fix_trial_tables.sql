-- Migration: Fix trial tables - ensure all required columns exist
-- This migration adds missing columns to existing tables
-- Version: 1.0

-- Fix google_trial_claims table
-- Add voucher_expires_at if it doesn't exist (may fail if already exists, that's ok)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we need to handle errors

-- First, recreate the table with all required columns if needed
DROP TABLE IF EXISTS google_trial_claims_backup;

CREATE TABLE IF NOT EXISTS google_trial_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  google_id TEXT NOT NULL,
  voucher_code TEXT NOT NULL,
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  voucher_expires_at DATETIME NOT NULL,
  is_used INTEGER DEFAULT 0,
  used_at DATETIME,
  user_id TEXT,
  ip_address TEXT
);

-- Fix trial_verification_requests table
DROP TABLE IF EXISTS trial_verification_requests_backup;

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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_google_trial_claims_email ON google_trial_claims(email);
CREATE INDEX IF NOT EXISTS idx_google_trial_claims_google_id ON google_trial_claims(google_id);
CREATE INDEX IF NOT EXISTS idx_google_trial_claims_voucher ON google_trial_claims(voucher_code);
CREATE INDEX IF NOT EXISTS idx_trial_verification_token ON trial_verification_requests(token);
CREATE INDEX IF NOT EXISTS idx_trial_verification_email ON trial_verification_requests(email);
