-- Migration: Add image_uploads table
-- This table tracks R2 bucket image uploads with 24h expiration

CREATE TABLE IF NOT EXISTS image_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME DEFAULT (datetime('now', '+24 hours')),
  content_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_image_uploads_expires ON image_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_image_uploads_key ON image_uploads(r2_key);
