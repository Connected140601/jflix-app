-- Migration: Add premium status tracking columns
-- This ensures proper tracking of premium vs free members
-- Version: 1.0

-- Add trial_expires_at column to users table (if not exists)
-- This tracks when the user's free trial expires
ALTER TABLE users ADD COLUMN trial_expires_at DATETIME;

-- Add is_premium_lifetime column to users table (if not exists)
-- This tracks users with lifetime premium access
ALTER TABLE users ADD COLUMN is_premium_lifetime INTEGER DEFAULT 0;

-- Add premium_source column to users table (if not exists)
-- This tracks how the user got premium (trial, paypal, admin, etc.)
ALTER TABLE users ADD COLUMN premium_source TEXT DEFAULT NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_trial_expires ON users(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_premium_source ON users(premium_source);
