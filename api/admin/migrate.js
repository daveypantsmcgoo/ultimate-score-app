import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(req, res) {
  // Security check
  if (req.method !== 'POST' || req.query.admin !== 'true') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const sql = postgres(DATABASE_URL);
  
  try {
    console.log('🔄 Running scrape timestamps migration...');
    
    const migrationSQL = `
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
    `;
    
    await sql.unsafe(migrationSQL);
    
    // Update existing records to have a baseline timestamp
    await sql`UPDATE teams SET last_scraped = NOW() - INTERVAL '1 day' WHERE last_scraped IS NULL`;
    await sql`UPDATE games SET last_updated = updated_at WHERE last_updated IS NULL`;
    await sql`UPDATE seasons SET last_full_scrape = NOW() - INTERVAL '1 day' WHERE last_full_scrape IS NULL AND is_current = TRUE`;
    
    console.log('✅ Migration completed successfully');
    
    // Verify the changes
    const teamColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'teams' AND column_name IN ('last_scraped')
    `;
    
    const gameColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'games' AND column_name IN ('last_updated')
    `;
    
    const seasonColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'seasons' AND column_name IN ('last_full_scrape', 'force_refresh')
    `;
    
    const result = {
      success: true,
      message: 'Migration completed successfully',
      changes: {
        teams: teamColumns.length,
        games: gameColumns.length,
        seasons: seasonColumns.length
      }
    };
    
    console.log('📋 Migration result:', result);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  } finally {
    await sql.end();
  }
}