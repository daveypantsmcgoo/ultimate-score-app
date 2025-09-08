import { validateCurrentSeason, getSeasonStatus } from '../_lib/seasonManager.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { check } = req.query;

  try {
    let seasonStatus;
    
    if (check === 'true') {
      // Force a fresh check
      console.log('Performing fresh season validation...');
      seasonStatus = await validateCurrentSeason();
    } else {
      // Return cached status
      seasonStatus = getSeasonStatus();
      
      // If we haven't checked recently and there's no active check, do it
      if (seasonStatus.needsCheck && seasonStatus.isValid !== null) {
        console.log('Performing background season validation...');
        // Don't await - let it run in background
        validateCurrentSeason().catch(err => 
          console.error('Background season check failed:', err)
        );
      }
    }

    // Determine overall system health
    let status = 'healthy';
    let recommendations = [];

    if (seasonStatus.isValid === false) {
      status = 'season_outdated';
      recommendations.push('Update season configuration in code');
      recommendations.push('Refresh team data with ?refresh=true');
      recommendations.push('Update division lists if needed');
    } else if (seasonStatus.isValid === null) {
      status = 'unknown';
      recommendations.push('Check network connectivity');
      recommendations.push('Retry season validation');
    }

    const response = {
      status,
      season: {
        expected: 'Fall 2025',
        current: seasonStatus.currentSeason || seasonStatus.name,
        isValid: seasonStatus.isValid,
        lastChecked: seasonStatus.lastChecked,
        needsCheck: seasonStatus.needsCheck
      },
      recommendations,
      endpoints: {
        divisions: status === 'healthy' ? 'fast' : 'may_have_warnings',
        teams: status === 'healthy' ? 'fast' : 'may_have_warnings', 
        schedule: 'normal_scraping'
      }
    };

    if (seasonStatus.error) {
      response.error = seasonStatus.error;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Season status check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      season: getSeasonStatus()
    });
  }
}