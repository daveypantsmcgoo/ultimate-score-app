import { DatabaseService } from '../_lib/database/connection.js';
import { requireAuth } from '../_lib/auth.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamId, divisionId } = req.body;
  
  if (!teamId || !divisionId) {
    return res.status(400).json({ 
      error: 'teamId and divisionId are required',
      example: { teamId: '6097', divisionId: '517' }
    });
  }

  const startTime = Date.now();
  console.log(`🔄 Manual refresh requested for team ${teamId} in division ${divisionId}`);

  try {
    // Get current data for comparison
    const currentGames = await DatabaseService.getTeamSchedule(teamId, divisionId);
    const currentGameCount = currentGames.length;
    const currentScores = currentGames.filter(g => g.is_complete).length;

    // Trigger scraping for this specific division
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    const scrapeResponse = await fetch(`${baseUrl}/api/cron/scrape-schedule?admin=true&divisionId=${divisionId}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Manual-Refresh-Internal'
      }
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Scraping failed: ${scrapeResponse.status}`);
    }

    const scrapeResult = await scrapeResponse.json();

    // Get updated data
    const updatedGames = await DatabaseService.getTeamSchedule(teamId, divisionId);
    const updatedGameCount = updatedGames.length;
    const updatedScores = updatedGames.filter(g => g.is_complete).length;

    // Calculate changes
    const changes = {
      newGames: updatedGameCount - currentGameCount,
      newScores: updatedScores - currentScores,
      hasChanges: updatedGameCount !== currentGameCount || updatedScores !== currentScores
    };

    const duration = Date.now() - startTime;

    // Log the manual refresh
    await DatabaseService.logRefresh(
      'manual-refresh', 
      divisionId, 
      true, 
      changes.newGames + changes.newScores, 
      null, 
      duration,
      { teamId, trigger: 'manual', changes }
    );

    console.log(`✅ Manual refresh completed in ${duration}ms. Changes: ${JSON.stringify(changes)}`);

    res.status(200).json({
      success: true,
      duration,
      changes,
      data: {
        games: updatedGames,
        lastRefresh: new Date().toISOString()
      },
      message: changes.hasChanges 
        ? `Found ${changes.newGames} new games and ${changes.newScores} new scores!`
        : 'No new updates found - you have the latest information.'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Manual refresh failed for team ${teamId}:`, error);
    
    await DatabaseService.logRefresh(
      'manual-refresh', 
      divisionId, 
      false, 
      0, 
      error.message, 
      duration,
      { teamId, trigger: 'manual', error: error.message }
    );

    res.status(500).json({
      success: false,
      duration,
      error: 'Failed to refresh data',
      details: error.message,
      fallback: 'Try again in a few moments, or check back later.'
    });
  }
}

export default requireAuth(handler);