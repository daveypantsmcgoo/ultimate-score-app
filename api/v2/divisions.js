import { DatabaseService } from '../_lib/database/connection.js';
import { requireAuth } from '../_lib/auth.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📋 Fetching divisions from database...');
    
    const divisions = await DatabaseService.getDivisions();
    
    if (divisions.length === 0) {
      return res.status(404).json({ 
        error: 'No divisions found',
        details: 'Database may not be initialized or current season not set'
      });
    }

    // Transform to match expected API format
    const formattedDivisions = divisions.map(div => ({
      id: div.id,
      name: div.name,
      season: div.season_id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) // 'fall-2025' -> 'Fall 2025'
    }));

    // Add cache headers since this data changes infrequently
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('X-Data-Source', 'database');
    res.setHeader('X-Data-Count', divisions.length.toString());
    
    console.log(`✅ Returned ${divisions.length} divisions from database`);
    
    res.status(200).json(formattedDivisions);
    
  } catch (error) {
    console.error('❌ Error fetching divisions:', error);
    res.status(500).json({
      error: 'Failed to fetch divisions',
      details: error.message
    });
  }
}

export default requireAuth(handler);