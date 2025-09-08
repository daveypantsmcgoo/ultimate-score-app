import { load } from 'cheerio';
import { DatabaseService, sql } from '../_lib/database/connection.js';

const MUFA_BASE_URL = 'https://www.mufa.org';

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
    // Get current season and divisions
    const currentSeason = await DatabaseService.getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No current season found in database');
    }

    const divisions = await DatabaseService.getDivisions(currentSeason.id);
    if (divisions.length === 0) {
      throw new Error('No divisions found for current season');
    }

    console.log(`📋 Found ${divisions.length} divisions to scrape`);

    let totalUpdated = 0;
    const results = {};

    // Scrape each division
    for (const division of divisions) {
      console.log(`🔍 Scraping division: ${division.name} (${division.id})`);
      
      try {
        const divisionResult = await scrapeDivisionData(division);
        results[division.id] = divisionResult;
        totalUpdated += divisionResult.gamesUpdated;
        
        // Log successful refresh
        await DatabaseService.logRefresh(
          'games', 
          division.id, 
          true, 
          divisionResult.gamesUpdated, 
          null, 
          Date.now() - startTime
        );
        
      } catch (divisionError) {
        console.error(`❌ Error scraping division ${division.id}:`, divisionError);
        results[division.id] = { error: divisionError.message };
        
        // Log failed refresh
        await DatabaseService.logRefresh(
          'games', 
          division.id, 
          false, 
          0, 
          divisionError.message, 
          Date.now() - startTime
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Scraping completed in ${duration}ms. Total games updated: ${totalUpdated}`);

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
  // First, get teams for this division (we'll need them for game scraping)
  let teams = await DatabaseService.getTeams(division.id);
  
  // If no teams in database, scrape them first
  if (teams.length === 0) {
    console.log(`📝 No teams found for ${division.id}, scraping teams first...`);
    teams = await scrapeAndStoreTeams(division);
  }

  console.log(`👥 Found ${teams.length} teams in division ${division.id}`);

  let gamesUpdated = 0;

  // Scrape schedule for each team
  for (const team of teams) {
    try {
      const teamGames = await scrapeTeamSchedule(team, division.id);
      gamesUpdated += teamGames.length;
      console.log(`📅 Updated ${teamGames.length} games for team ${team.name}`);
    } catch (teamError) {
      console.error(`❌ Error scraping team ${team.id}:`, teamError);
    }
  }

  return { gamesUpdated, teamsCount: teams.length };
}

async function scrapeAndStoreTeams(division) {
  const response = await fetch(`${MUFA_BASE_URL}/League/Division/HomeArticle.aspx?d=${division.id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
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
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
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