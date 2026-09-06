-- Add missing premium-related columns to users table
-- Migration for premium_source, trial_expires_at, and is_premium_lifetime

-- Add premium_source column
ALTER TABLE users ADD COLUMN premium_source TEXT;

-- Add trial_expires_at column
ALTER TABLE users ADD COLUMN trial_expires_at DATETIME;

-- Add is_premium_lifetime column
ALTER TABLE users ADD COLUMN is_premium_lifetime INTEGER DEFAULT 0;
