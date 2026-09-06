-- Migration: Add vouchers and subscription support
-- Run with: wrangler d1 execute jflix-db --file=migration_vouchers.sql

-- Add subscription fields to users table
ALTER TABLE users ADD COLUMN subscription_type TEXT DEFAULT 'free' CHECK(subscription_type IN ('free', 'premium'));
ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME;
ALTER TABLE users ADD COLUMN voucher_code TEXT;

-- Create vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('free_trial', 'premium_month', 'premium_year', 'lifetime')),
    duration_days INTEGER,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_by TEXT,
    used_at DATETIME,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (used_by) REFERENCES users(user_id)
);

-- Create index for faster voucher lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_used_by ON vouchers(used_by);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_type);
