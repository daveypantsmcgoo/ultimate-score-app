import { DatabaseService } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { divisionId } = req.query;
  
  if (!divisionId) {
    return res.status(400).json({ error: 'divisionId parameter is required' });
  }

  try {
    console.log(`👥 Fetching teams for division ${divisionId} from database...`);
    
    const teams = await DatabaseService.getTeams(divisionId);
    
    if (teams.length === 0) {
      return res.status(404).json({ 
        error: `No teams found for division ${divisionId}`,
        details: 'Division may not exist or teams may not be scraped yet'
      });
    }

    // Transform to match expected API format
    const formattedTeams = teams.map(team => ({
      id: team.id,
      name: team.name,
      divisionId: team.division_id,
      jerseyColor: team.jersey_color || 'Unknown'
    }));

    // Add cache headers
    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes
    res.setHeader('X-Data-Source', 'database');
    res.setHeader('X-Data-Count', teams.length.toString());
    res.setHeader('X-Division-Id', divisionId);
    
    console.log(`✅ Returned ${teams.length} teams for division ${divisionId}`);
    
    res.status(200).json(formattedTeams);
    
  } catch (error) {
    console.error(`❌ Error fetching teams for division ${divisionId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch teams',
      details: error.message
    });
  }
}