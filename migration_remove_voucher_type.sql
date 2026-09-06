-- Migration: Remove voucher type constraint
-- Run with: wrangler d1 execute jflix-db --file=migration_remove_voucher_type.sql

-- Since SQLite doesn't support ALTER TABLE DROP CONSTRAINT directly,
-- we need to recreate the table without the constraint

-- Step 1: Create new vouchers table without type constraint
CREATE TABLE IF NOT EXISTS vouchers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT,
  duration_days INTEGER,
  expires_at DATETIME,
  created_by TEXT,
  is_active INTEGER DEFAULT 1,
  used_by TEXT,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy data from old table to new table
INSERT INTO vouchers_new (id, code, type, duration_days, expires_at, created_by, is_active, used_by, used_at, created_at)
SELECT id, code, type, duration_days, expires_at, created_by, is_active, used_by, used_at, created_at
FROM vouchers;

-- Step 3: Drop old table
DROP TABLE vouchers;

-- Step 4: Rename new table to vouchers
ALTER TABLE vouchers_new RENAME TO vouchers;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_used_by ON vouchers(used_by);
