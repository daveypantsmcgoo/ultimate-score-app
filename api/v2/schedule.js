import { DatabaseService } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamId, divisionId } = req.query;
  
  if (!teamId || !divisionId) {
    return res.status(400).json({ error: 'teamId and divisionId parameters are required' });
  }

  try {
    console.log(`📅 Fetching schedule for team ${teamId} in division ${divisionId} from database...`);
    
    const games = await DatabaseService.getTeamSchedule(teamId, divisionId);
    
    if (games.length === 0) {
      return res.status(404).json({ 
        error: `No schedule found for team ${teamId}`,
        details: 'Team may not exist or schedule may not be scraped yet'
      });
    }

    // Transform to match expected API format
    const formattedGames = games.map(game => {
      // Determine which team is A and which is B for this specific team
      const isTeamA = game.team_a_id === teamId;
      const currentTeam = {
        id: teamId,
        name: isTeamA ? game.team_a_name : game.team_b_name,
        divisionId: game.division_id
      };
      const opponent = {
        id: isTeamA ? game.team_b_id : game.team_a_id,
        name: isTeamA ? game.team_b_name : game.team_a_name,
        divisionId: game.division_id
      };

      // Create field object
      const field = game.field_name ? {
        id: game.field_id,
        name: game.field_name,
        mapUrl: game.field_map_url,
        diagramUrl: game.field_diagram_url
      } : {
        id: 'unknown',
        name: 'TBD',
        mapUrl: null,
        diagramUrl: null
      };

      return {
        id: game.id,
        date: game.game_date ? new Date(game.game_date).toISOString() : null,
        time: game.game_time || 'TBD',
        teamA: currentTeam,
        teamB: opponent,
        field,
        isComplete: game.is_complete || false,
        // Include scores if available
        ...(game.team_a_score !== null && game.team_b_score !== null && {
          score: {
            teamA: isTeamA ? game.team_a_score : game.team_b_score,
            teamB: isTeamA ? game.team_b_score : game.team_a_score
          }
        })
      };
    });

    // Sort by date
    formattedGames.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get latest refresh info for debugging
    const latestRefresh = await DatabaseService.getLatestRefresh('games', divisionId);
    
    // Add cache headers
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('X-Data-Source', 'database');
    res.setHeader('X-Data-Count', games.length.toString());
    res.setHeader('X-Team-Id', teamId);
    res.setHeader('X-Division-Id', divisionId);
    
    if (latestRefresh) {
      res.setHeader('X-Last-Refresh', latestRefresh.refresh_completed_at || latestRefresh.refresh_started_at);
      res.setHeader('X-Refresh-Success', latestRefresh.success.toString());
    }
    
    console.log(`✅ Returned ${formattedGames.length} games for team ${teamId}`);
    
    res.status(200).json(formattedGames);
    
  } catch (error) {
    console.error(`❌ Error fetching schedule for team ${teamId}:`, error);
    res.status(500).json({
      error: 'Failed to fetch schedule',
      details: error.message
    });
  }
}