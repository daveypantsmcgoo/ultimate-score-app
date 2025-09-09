import { sql } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  // Security check
  if (req.query.admin !== 'true') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    console.log('🔍 Testing raw database connection...');
    
    // Test basic connection
    const timeTest = await sql`SELECT NOW() as current_time`;
    console.log('✅ Time test:', timeTest);
    
    // Test seasons table exists
    const tableTest = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'seasons'
      );
    `;
    console.log('✅ Table exists test:', tableTest);
    
    // Test insert/select cycle
    console.log('🔍 Testing insert/select cycle...');
    
    // Insert test season
    const insertResult = await sql`
      INSERT INTO seasons (id, name, start_date, end_date, is_current)
      VALUES ('test-season-' || extract(epoch from now()), 'Test Season', '2025-01-01', '2025-12-31', FALSE)
      RETURNING *
    `;
    console.log('✅ Insert result:', insertResult);
    
    // Select all seasons
    const allSeasons = await sql`SELECT * FROM seasons ORDER BY created_at DESC`;
    console.log('✅ All seasons:', allSeasons);
    
    // Select current season specifically
    const currentSeason = await sql`
      SELECT * FROM seasons 
      WHERE is_current = TRUE 
      LIMIT 1
    `;
    console.log('✅ Current season query:', currentSeason);
    
    // Clean up test season
    await sql`DELETE FROM seasons WHERE id LIKE 'test-season-%'`;
    
    return res.status(200).json({
      success: true,
      tests: {
        connection: timeTest?.length > 0,
        tableExists: tableTest?.[0]?.exists,
        insertWorks: insertResult?.length > 0,
        totalSeasons: allSeasons?.length || 0,
        currentSeasonFound: currentSeason?.length > 0,
        currentSeasonData: currentSeason?.[0] || null
      },
      debug: {
        allSeasons: allSeasons || [],
        currentSeason: currentSeason || []
      }
    });
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}