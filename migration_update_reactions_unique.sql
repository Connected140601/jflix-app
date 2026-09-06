-- Migration to update reactions table UNIQUE constraint
-- This changes the constraint from allowing multiple reaction types per user to only one reaction per user per content

-- Step 1: Create a new table with the correct UNIQUE constraint
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

-- Step 2: Copy data from old table to new table (keeping only the most recent reaction per user per content)
INSERT INTO reactions_new (media_type, media_id, season_number, episode_number, user_id, reaction_type, created_at, updated_at)
SELECT r1.media_type, r1.media_id, r1.season_number, r1.episode_number, r1.user_id, r1.reaction_type, r1.created_at, r1.updated_at
FROM reactions r1
WHERE r1.id = (
  SELECT MAX(r2.id)
  FROM reactions r2
  WHERE r2.media_type = r1.media_type
    AND r2.media_id = r1.media_id
    AND (r2.season_number = r1.season_number OR (r2.season_number IS NULL AND r1.season_number IS NULL))
    AND (r2.episode_number = r1.episode_number OR (r2.episode_number IS NULL AND r1.episode_number IS NULL))
    AND r2.user_id = r1.user_id
);

-- Step 3: Update reaction_counts to match the new data
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

-- Step 4: Drop old table
DROP TABLE reactions;

-- Step 5: Rename new table to reactions
ALTER TABLE reactions_new RENAME TO reactions;
