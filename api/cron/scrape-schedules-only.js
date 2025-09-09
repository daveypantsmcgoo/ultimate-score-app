import { load } from 'cheerio';
import { DatabaseService, sql } from '../_lib/database/connection.js';

const MUFA_BASE_URL = 'https://mufa.org';

export default async function handler(req, res) {
  // Verify this is a cron request or admin request
  const authHeader = req.headers.authorization;
  const isValidCron = authHeader && authHeader.includes('Bearer cron-');
  const isAdminRequest = req.query.admin === 'true';
  
  if (!isValidCron && !isAdminRequest) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  console.log('⚡ Starting optimized schedule-only scraping (v3 - fixed parsing)...');

  try {
    // Get current season
    const currentSeason = await DatabaseService.getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No current season found. Please run season setup first.');
    }

    // Get all active teams (these are static, populated during season setup)
    const allTeams = await sql.unsafe(`
      SELECT t.*, d.name as division_name 
      FROM teams t 
      JOIN divisions d ON t.division_id = d.id 
      WHERE t.is_active = TRUE 
      ORDER BY d.id, t.name
    `);

    if (allTeams.length === 0) {
      throw new Error('No teams found. Please run season setup first.');
    }

    console.log(`📋 Found ${allTeams.length} teams across divisions - scraping schedules only`);

    // Process teams in parallel for maximum speed
    const teamPromises = allTeams.map(async (team) => {
      try {
        const gamesUpdated = await scrapeTeamScheduleOnly(team);
        console.log(`📅 Updated ${gamesUpdated} games for ${team.name} (${team.division_name})`);
        return { teamId: team.id, gamesUpdated };
      } catch (error) {
        console.error(`❌ Failed to scrape ${team.name}:`, error.message);
        return { teamId: team.id, gamesUpdated: 0, error: error.message };
      }
    });

    // Wait for all teams to complete
    const results = await Promise.all(teamPromises);
    
    // Calculate totals
    const totalGamesUpdated = results.reduce((sum, r) => sum + r.gamesUpdated, 0);
    const errors = results.filter(r => r.error);
    
    const duration = Date.now() - startTime;
    console.log(`✅ Schedule scraping completed in ${duration}ms. Updated ${totalGamesUpdated} games`);

    if (errors.length > 0) {
      console.warn(`⚠️ ${errors.length} teams had errors:`, errors);
    }

    // Log refresh
    await DatabaseService.logRefresh(
      'schedules-only', 
      null, 
      true, 
      totalGamesUpdated, 
      errors.length > 0 ? `${errors.length} team errors` : null, 
      duration
    );

    return res.status(200).json({
      success: true,
      duration,
      totalGamesUpdated,
      teamsProcessed: allTeams.length,
      errors: errors.length,
      message: `Optimized scraping: only game schedules updated, ${totalGamesUpdated} games processed`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Schedule scraping failed:', error);
    
    await DatabaseService.logRefresh('schedules-only', null, false, 0, error.message, duration);
    
    return res.status(500).json({
      success: false,
      duration,
      error: error.message,
      message: 'Schedule scraping failed'
    });
  }
}

// Optimized function - only scrapes schedules for existing teams
async function scrapeTeamScheduleOnly(team) {
  const response = await fetch(`${MUFA_BASE_URL}/League/Division/Team.aspx?t=${team.id}&d=${team.division_id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Connection': 'keep-alive'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  
  const games = [];
  
  $('.clickable-row.top-level-row').each((index, element) => {
    try {
      const $row = $(element);
      
      // Extract date and time from the first col-8 div (e.g., "Tue, Jun-02 7:30 PM")
      const dateTimeText = $row.find('.col-8 strong').first().text().trim();
      
      // Extract opponent team name from the link in col-8 text-right
      const opponentLink = $row.find('.col-8.text-right a');
      const opponentName = opponentLink.length > 0 ? opponentLink.text().trim() : null;
      
      // Extract field from the location row (usually contains field info)
      let fieldText = '';
      const locationDivs = $row.find('div').filter((i, el) => {
        const text = $(el).text().trim();
        return text.includes('Field') || text.includes('Park') || text.includes('School') || 
               text.includes('Memorial') || text.includes('East') || text.includes('West') ||
               text.includes('North') || text.includes('South') || text.includes('Madison');
      });
      
      if (locationDivs.length > 0) {
        fieldText = $(locationDivs[0]).text().trim();
      } else {
        // Fallback: look for any text that might be a field
        const allDivs = $row.find('div');
        for (let i = 0; i < allDivs.length; i++) {
          const text = $(allDivs[i]).text().trim();
          if (text && !text.includes('Opp.') && !text.includes('Jersey') && 
              !text.includes('White') && !text.includes('Dark') && 
              !text.includes('PM') && !text.includes('AM') &&
              text.length > 5) {
            fieldText = text;
            break;
          }
        }
      }
      
      if (dateTimeText && opponentName) {
        // Parse date and time from combined string
        const { gameDate, gameTime } = parseMufaDateTime(dateTimeText);
        
        if (gameDate && gameTime) {
          // Create team objects
          const teamA = { id: team.id, name: team.name };
          const teamB = { id: 'unknown', name: opponentName };
          
          games.push({
            teamA,
            teamB,
            date: gameDate,
            time: gameTime,
            field: fieldText || 'TBD',
            divisionId: team.division_id
          });
        }
      }
    } catch (error) {
      console.warn(`Error parsing game row for ${team.name}:`, error.message);
    }
  });

  // Store games in database
  let gamesUpdated = 0;
  for (const game of games) {
    try {
      await storeGameOptimized(game);
      gamesUpdated++;
    } catch (error) {
      console.error(`Error storing game for ${team.name}:`, error.message);
    }
  }

  return gamesUpdated;
}

// Store game with optimized upsert
async function storeGameOptimized(game) {
  const gameId = `game-${game.divisionId}-${game.teamA.id}-${game.teamB.id}-${game.date}`;
  const fieldId = generateFieldId(game.field);
  
  // Ensure field exists
  await sql.unsafe(`
    INSERT INTO fields (id, name, map_url)
    VALUES ('${fieldId}', '${game.field.replace(/'/g, "''")}', 'https://maps.google.com/search/${encodeURIComponent(game.field)}%20Madison%20WI')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = NOW()
  `);

  // Upsert game
  await sql.unsafe(`
    INSERT INTO games (
      id, division_id, team_a_id, team_b_id, field_id,
      game_date, game_time, is_complete, created_at, updated_at
    )
    VALUES (
      '${gameId}', '${game.divisionId}', '${game.teamA.id}', '${game.teamB.id}', '${fieldId}',
      '${game.date}', '${game.time}', FALSE, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      field_id = EXCLUDED.field_id,
      game_date = EXCLUDED.game_date,
      game_time = EXCLUDED.game_time,
      updated_at = NOW()
  `);
}

// Helper functions
function parseMufaDateTime(dateTimeText) {
  // Handle formats like "Tue, Jun-02 7:30 PM" or "Thu, Jul-02 6:00 PM"
  const match = dateTimeText.match(/(\w{3}),?\s*(\w{3})-(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return { gameDate: null, gameTime: null };
  
  const [, , monthStr, day, hours, minutes, ampm] = match;
  
  // Parse date
  const year = new Date().getFullYear();
  const month = new Date(`${monthStr} 1, ${year}`).getMonth();
  const gameDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // Parse time
  let hour = parseInt(hours);
  if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
  if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
  const gameTime = `${String(hour).padStart(2, '0')}:${minutes}:00`;
  
  return { gameDate, gameTime };
}


function generateFieldId(fieldName) {
  return fieldName.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}