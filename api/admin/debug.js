import { DatabaseService, sql } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  // Security check
  if (req.query.admin !== 'true') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Check current season
    const currentSeason = await DatabaseService.getCurrentSeason();
    
    // Get all seasons
    const allSeasons = await sql`SELECT * FROM seasons ORDER BY created_at DESC`;
    
    // Get divisions count  
    const divisions = await DatabaseService.getDivisions();
    
    // Get teams count
    const teams = await sql`SELECT COUNT(*) as count FROM teams`;
    
    // Get games count
    const games = await sql`SELECT COUNT(*) as count FROM games`;

    return res.status(200).json({
      success: true,
      currentSeason,
      allSeasons: allSeasons || [],
      stats: {
        divisions: divisions?.length || 0,
        teams: teams?.[0]?.count || 0,
        games: games?.[0]?.count || 0
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}