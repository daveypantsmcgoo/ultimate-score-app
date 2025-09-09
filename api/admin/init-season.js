import { DatabaseService, sql } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  // Security check
  if (req.query.admin !== 'true') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Check if current season exists
    let currentSeason = await DatabaseService.getCurrentSeason();
    
    if (!currentSeason) {
      console.log('🌟 No current season found, creating Fall 2025...');
      
      // Create Fall 2025 season
      await sql`
        INSERT INTO seasons (id, name, start_date, end_date, is_current)
        VALUES ('fall-2025', 'Fall 2025', '2025-08-01', '2025-12-31', TRUE)
        ON CONFLICT (id) DO UPDATE SET
          is_current = TRUE,
          updated_at = NOW()
      `;
      
      currentSeason = await DatabaseService.getCurrentSeason();
      console.log('✅ Created Fall 2025 season');
    }

    // Run the migration to ensure all columns exist
    await DatabaseService.ensureMigration();

    // Get stats
    const divisions = await DatabaseService.getDivisions();
    const teams = await sql`SELECT COUNT(*) as count FROM teams`;
    const games = await sql`SELECT COUNT(*) as count FROM games`;

    return res.status(200).json({
      success: true,
      message: 'Season initialized successfully',
      currentSeason,
      migration: 'completed',
      stats: {
        divisions: divisions?.length || 0,
        teams: teams?.[0]?.count || 0,
        games: games?.[0]?.count || 0
      }
    });
    
  } catch (error) {
    console.error('Init season error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
}