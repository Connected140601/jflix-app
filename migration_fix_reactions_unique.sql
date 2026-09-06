-- Migration to fix reactions table UNIQUE constraint
-- This recreates the reactions table to enforce the UNIQUE constraint properly

-- Step 1: Delete all duplicate reactions (keep only the most recent one per user per content)
DELETE FROM reactions WHERE id NOT IN (
  SELECT MAX(id) FROM reactions 
  GROUP BY media_type, media_id, season_number, episode_number, user_id
);

-- Step 2: Create a new table with the correct UNIQUE constraint
CREATE TABLE IF NOT EXISTS reactions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  season_number INTEGER,
  episode_number INTEGER,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(media_type, media_id, season_number, episode_number, user_id)
);

-- Step 3: Copy data from old table to new table
INSERT INTO reactions_new (media_type, media_id, season_number, episode_number, user_id, reaction_type, created_at, updated_at)
SELECT media_type, media_id, season_number, episode_number, user_id, reaction_type, created_at, updated_at
FROM reactions;

-- Step 4: Update reaction_counts to match the new data
-- First, reset all counts to 0
UPDATE reaction_counts SET count = 0;

-- Then, recount based on the new reactions table
INSERT OR REPLACE INTO reaction_counts (media_type, media_id, season_number, episode_number, reaction_type, count, updated_at)
SELECT
  media_type,
  media_id,
  season_number,
  episode_number,
  reaction_type,
  COUNT(*) as count,
  CURRENT_TIMESTAMP as updated_at
FROM reactions_new
GROUP BY media_type, media_id, season_number, episode_number, reaction_type;

-- Step 5: Drop old table
DROP TABLE reactions;

-- Step 6: Rename new table to reactions
ALTER TABLE reactions_new RENAME TO reactions;
