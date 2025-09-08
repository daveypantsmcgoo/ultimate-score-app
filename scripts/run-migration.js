import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(DATABASE_URL);
  
  try {
    console.log('🔄 Running scrape timestamps migration...');
    
    const migrationPath = join(__dirname, '../api/_lib/database/migrations/add-scrape-timestamps.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await sql.unsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Added timestamp tracking for selective scraping');
    
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
    
    console.log('📋 Verification:');
    console.log(`   Teams: ${teamColumns.length} new columns`);
    console.log(`   Games: ${gameColumns.length} new columns`);
    console.log(`   Seasons: ${seasonColumns.length} new columns`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();