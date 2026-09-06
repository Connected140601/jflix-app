-- Daily limit tracker for trial verification email sends
-- Prevents abuse of the free-trial email flow
CREATE TABLE IF NOT EXISTS trial_email_limits (
  date       TEXT PRIMARY KEY,         -- YYYY-MM-DD in UTC
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
