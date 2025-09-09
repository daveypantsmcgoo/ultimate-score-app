import { load } from 'cheerio';
import { DatabaseService, sql } from '../_lib/database/connection.js';

const MUFA_BASE_URL = 'https://www.mufa.org';

// HTTP optimization - reusable headers with keep-alive connections
const httpHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Connection': 'keep-alive',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Cache-Control': 'no-cache'
};

export default async function handler(req, res) {
  // Verify this is a cron request or admin request
  const authHeader = req.headers.authorization;
  const isValidCron = authHeader && authHeader.includes('Bearer cron-');
  const isAdminRequest = req.query.admin === 'true';
  
  if (!isValidCron && !isAdminRequest) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('🕐 Starting scheduled MUFA data scraping...');

  try {
    // Debug: Check database connection and migration
    console.log('🔍 Testing database connection and migration...');
    await DatabaseService.ensureMigration();
    
    // Debug: Try to find any seasons
    const debugSeasons = await sql`SELECT * FROM seasons ORDER BY created_at DESC LIMIT 5`;
    console.log('🔍 Debug seasons found:', debugSeasons?.length || 0, debugSeasons);

    // Get current season and divisions
    let currentSeason = await DatabaseService.getCurrentSeason();
    console.log('🔍 Current season result:', currentSeason);
    
    if (!currentSeason) {
      // Try to create season if missing
      console.log('🌟 Creating Fall 2025 season in scraper...');
      await sql`
        INSERT INTO seasons (id, name, start_date, end_date, is_current)
        VALUES ('fall-2025', 'Fall 2025', '2025-08-01', '2025-12-31', TRUE)
        ON CONFLICT (id) DO UPDATE SET
          is_current = TRUE,
          updated_at = NOW()
      `;
      
      currentSeason = await DatabaseService.getCurrentSeason();
      console.log('🔍 After creation, current season:', currentSeason);
      
      if (!currentSeason) {
        throw new Error('No current season found in database even after creation attempt');
      }
    }

    const divisions = await DatabaseService.getDivisions(currentSeason.id);
    if (divisions.length === 0) {
      throw new Error('No divisions found for current season');
    }

    console.log(`📋 Found ${divisions.length} divisions to scrape`);

    // Process divisions in parallel for much better performance
    console.log(`🚀 Processing ${divisions.length} divisions in parallel...`);
    
    const divisionPromises = divisions.map(async (division) => {
      console.log(`🔍 Starting division: ${division.name} (${division.id})`);
      
      try {
        const divisionResult = await scrapeDivisionData(division);
        
        // Log successful refresh
        await DatabaseService.logRefresh(
          'games', 
          division.id, 
          true, 
          divisionResult.gamesUpdated, 
          null, 
          Date.now() - startTime
        );
        
        console.log(`✅ Completed division ${division.id}: ${divisionResult.gamesUpdated} games updated`);
        return { [division.id]: divisionResult };
        
      } catch (divisionError) {
        console.error(`❌ Error scraping division ${division.id}:`, divisionError);
        
        // Log failed refresh
        await DatabaseService.logRefresh(
          'games', 
          division.id, 
          false, 
          0, 
          divisionError.message, 
          Date.now() - startTime
        );
        
        return { [division.id]: { error: divisionError.message } };
      }
    });

    // Wait for all divisions to complete
    const divisionResults = await Promise.all(divisionPromises);
    
    // Combine results and analyze performance
    const results = {};
    let totalUpdated = 0;
    let totalSkipped = 0;
    let selectiveCount = 0;
    
    divisionResults.forEach(result => {
      Object.assign(results, result);
      const divisionId = Object.keys(result)[0];
      const divResult = result[divisionId];
      
      if (divResult.gamesUpdated !== undefined) {
        totalUpdated += divResult.gamesUpdated;
      }
      if (divResult.skipped) {
        totalSkipped++;
      }
      if (divResult.selective) {
        selectiveCount++;
      }
    });

    // Reset force refresh flag if it was enabled
    if (await DatabaseService.shouldForceRefresh()) {
      await DatabaseService.setForceRefresh(false);
      console.log('🔄 Force refresh flag reset after completion');
    }

    const duration = Date.now() - startTime;
    const efficiency = totalSkipped > 0 ? ` (${totalSkipped} divisions skipped, ${selectiveCount} used selective refresh)` : '';
    console.log(`✅ Scraping completed in ${duration}ms. Total games updated: ${totalUpdated}${efficiency}`);

    return res.status(200).json({
      success: true,
      duration,
      totalUpdated,
      divisionsProcessed: Object.keys(results).length,
      results
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Scraping failed:', error);
    
    // Log overall failure
    await DatabaseService.logRefresh('games', null, false, 0, error.message, duration);
    
    return res.status(500).json({
      success: false,
      duration,
      error: error.message
    });
  }
}

async function scrapeDivisionData(division) {
  // Check if force refresh is enabled
  const forceRefresh = await DatabaseService.shouldForceRefresh();
  
  let teams;
  if (forceRefresh) {
    // Force refresh: get all teams
    teams = await DatabaseService.getTeams(division.id);
    console.log(`🔄 Force refresh enabled - processing all ${teams.length} teams in ${division.id}`);
  } else {
    // Selective refresh: only get stale teams (default: older than 2 hours)
    teams = await DatabaseService.getStaleTeams(division.id, 120);
    console.log(`⚡ Selective refresh - processing ${teams.length} stale teams in ${division.id}`);
  }
  
  // If no teams found and not a force refresh, check if we need to scrape new teams
  if (teams.length === 0 && !forceRefresh) {
    const allTeams = await DatabaseService.getTeams(division.id);
    if (allTeams.length === 0) {
      console.log(`📝 No teams found for ${division.id}, scraping teams first...`);
      teams = await scrapeAndStoreTeams(division);
    } else {
      console.log(`✅ All teams in ${division.id} are up to date - skipping`);
      return { gamesUpdated: 0, teamsCount: allTeams.length, skipped: true };
    }
  }

  let gamesUpdated = 0;
  const teamUpdatePromises = [];

  // Process teams in parallel for better performance
  for (const team of teams) {
    const updatePromise = (async () => {
      try {
        const teamGames = await scrapeTeamSchedule(team, division.id);
        await DatabaseService.updateTeamScrapedTime(team.id);
        console.log(`📅 Updated ${teamGames.length} games for team ${team.name}`);
        return teamGames.length;
      } catch (teamError) {
        console.error(`❌ Error scraping team ${team.id}:`, teamError);
        return 0;
      }
    })();
    
    teamUpdatePromises.push(updatePromise);
  }

  // Wait for all team updates to complete
  const results = await Promise.all(teamUpdatePromises);
  gamesUpdated = results.reduce((sum, count) => sum + count, 0);

  return { 
    gamesUpdated, 
    teamsCount: teams.length,
    selective: !forceRefresh,
    processed: teams.length 
  };
}

async function scrapeAndStoreTeams(division) {
  const response = await fetch(`${MUFA_BASE_URL}/League/Division/HomeArticle.aspx?d=${division.id}`, {
    headers: httpHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch division ${division.id}: ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const teams = [];

  // Extract team links
  $('a[href*="Team.aspx?t="]').each((i, element) => {
    const $link = $(element);
    const href = $link.attr('href');
    const name = $link.text().trim();
    
    if (href && name && name.length > 2) {
      const teamMatch = href.match(/[?&]t=(\d+)/);
      if (teamMatch) {
        const teamId = teamMatch[1];
        if (!teams.find(t => t.id === teamId)) {
          teams.push({
            id: teamId,
            name,
            division_id: division.id,
            jersey_color: 'Unknown'
          });
        }
      }
    }
  });

  // Store teams in database
  for (const team of teams) {
    try {
      await sql`
        INSERT INTO teams (id, division_id, name, jersey_color)
        VALUES (${team.id}, ${team.division_id}, ${team.name}, ${team.jersey_color})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          jersey_color = EXCLUDED.jersey_color,
          updated_at = NOW()
      `;
    } catch (error) {
      console.error(`Error storing team ${team.id}:`, error);
    }
  }

  console.log(`💾 Stored ${teams.length} teams for division ${division.id}`);
  return teams;
}

async function scrapeTeamSchedule(team, divisionId) {
  const response = await fetch(`${MUFA_BASE_URL}/League/Division/Team.aspx?t=${team.id}&d=${divisionId}`, {
    headers: httpHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch team ${team.id} schedule: ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const games = [];

  // Parse schedule using the same logic as before
  $('.clickable-row').each((index, element) => {
    const $row = $(element);
    
    const dateTimeText = $row.find('strong').first().text();
    if (!dateTimeText) return;
    
    const dateTimeMatch = dateTimeText.match(/([A-Za-z]{3}),\s+([A-Za-z]{3})-(\d{2})\s+(\d{1,2}:\d{2}\s*[AP]M)/);
    if (!dateTimeMatch) return;
    
    const monthStr = dateTimeMatch[2];
    const dayStr = dateTimeMatch[3]; 
    const timeStr = dateTimeMatch[4];
    
    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const month = monthMap[monthStr];
    const day = parseInt(dayStr);
    
    if (month === undefined) return;
    
    const gameDate = new Date(2025, month, day);
    
    // Extract opponent
    const opponentLink = $row.find('a[href*="Team.aspx?t="]');
    const opponentName = opponentLink.text().trim();
    const opponentHref = opponentLink.attr('href');
    const opponentIdMatch = opponentHref ? opponentHref.match(/t=(\d+)/) : null;
    const opponentId = opponentIdMatch ? opponentIdMatch[1] : null;
    
    if (!opponentName || !opponentId) return;
    
    // Extract field
    const fieldLink = $row.find('a[href*="Field.aspx?f="]');
    const fieldName = fieldLink.text().trim();
    
    // Check completion status
    const resultElement = $row.find('span[data-toggle="tooltip"]');
    const isComplete = resultElement.length > 0 && resultElement.attr('title') && 
                      (resultElement.attr('title').includes('Won') || resultElement.attr('title').includes('Lost'));
    
    games.push({
      team_id: team.id,
      opponent_id: opponentId,
      opponent_name: opponentName,
      field_name: fieldName,
      game_date: gameDate,
      game_time: timeStr,
      is_complete: isComplete
    });
  });

  // Store games in database
  for (const game of games) {
    try {
      const gameId = `game-${divisionId}-${team.id}-${game.opponent_id}-${game.game_date.toISOString().split('T')[0]}`;
      
      // Create field if doesn't exist
      let fieldId = null;
      if (game.field_name) {
        fieldId = game.field_name.toLowerCase().replace(/\s+/g, '-');
        await sql`
          INSERT INTO fields (id, name, map_url)
          VALUES (${fieldId}, ${game.field_name}, ${`https://maps.google.com/search/${encodeURIComponent(game.field_name + ' Madison WI')}`})
          ON CONFLICT (id) DO NOTHING
        `;
      }
      
      // Store game
      await sql`
        INSERT INTO games (
          id, division_id, team_a_id, team_b_id, field_id,
          game_date, game_time, is_complete
        )
        VALUES (
          ${gameId}, ${divisionId}, ${team.id}, ${game.opponent_id}, ${fieldId},
          ${game.game_date.toISOString().split('T')[0]}, ${game.game_time}, ${game.is_complete}
        )
        ON CONFLICT (id) DO UPDATE SET
          is_complete = EXCLUDED.is_complete,
          updated_at = NOW()
      `;
    } catch (error) {
      console.error(`Error storing game:`, error);
    }
  }

  return games;
}