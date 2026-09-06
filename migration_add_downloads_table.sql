-- Migration: Add downloads table for tracking app downloads
-- Version 6.0

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  download_type TEXT NOT NULL, -- 'macos_silicon', 'macos_intel', 'windows_setup', 'windows_portable', 'android'
  download_count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(download_type)
);

-- Insert initial records
INSERT OR IGNORE INTO downloads (download_type, download_count) VALUES
  ('macos_silicon', 0),
  ('macos_intel', 0),
  ('windows_setup', 0),
  ('windows_portable', 0),
  ('android', 0);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_downloads_type ON downloads(download_type);
