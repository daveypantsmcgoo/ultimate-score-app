-- Migration: Add scraping timestamp tracking for selective updates
-- This enables the scraper to only update stale data, dramatically improving performance

-- Add last_scraped timestamp to teams table for per-team tracking
ALTER TABLE teams ADD COLUMN IF NOT EXISTS last_scraped TIMESTAMP WITH TIME ZONE;

-- Add last_updated timestamp to games table to track when game data changed
ALTER TABLE games ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add league-wide scraping metadata to seasons table
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS last_full_scrape TIMESTAMP WITH TIME ZONE;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS force_refresh BOOLEAN DEFAULT FALSE;

-- Create indexes for performance on timestamp queries
CREATE INDEX IF NOT EXISTS idx_teams_last_scraped ON teams(last_scraped);
CREATE INDEX IF NOT EXISTS idx_games_last_updated ON games(last_updated);
CREATE INDEX IF NOT EXISTS idx_games_date_complete ON games(game_date, is_complete);
CREATE INDEX IF NOT EXISTS idx_teams_division_scraped ON teams(division_id, last_scraped);

-- Update existing records to have a baseline timestamp
UPDATE teams SET last_scraped = NOW() - INTERVAL '1 day' WHERE last_scraped IS NULL;
UPDATE games SET last_updated = updated_at WHERE last_updated IS NULL;
UPDATE seasons SET last_full_scrape = NOW() - INTERVAL '1 day' WHERE last_full_scrape IS NULL AND is_current = TRUE;

COMMENT ON COLUMN teams.last_scraped IS 'When this team''s schedule was last scraped from MUFA';
COMMENT ON COLUMN games.last_updated IS 'When this game''s data was last modified';
COMMENT ON COLUMN seasons.last_full_scrape IS 'When a full league-wide scrape was last completed';
COMMENT ON COLUMN seasons.force_refresh IS 'Force all teams to be re-scraped on next run';