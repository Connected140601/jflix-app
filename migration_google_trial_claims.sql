-- Migration: Add Google Trial Claims table
-- This table tracks which Google accounts have claimed their 3-day free trial
-- Version: 1.0

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

CREATE INDEX IF NOT EXISTS idx_google_trial_claims_email ON google_trial_claims(email);
CREATE INDEX IF NOT EXISTS idx_google_trial_claims_google_id ON google_trial_claims(google_id);
CREATE INDEX IF NOT EXISTS idx_google_trial_claims_voucher ON google_trial_claims(voucher_code);
