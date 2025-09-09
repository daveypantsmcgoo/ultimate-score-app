import { load } from 'cheerio';
import { DatabaseService, sql } from '../_lib/database/connection.js';
import { requireAdmin } from '../_lib/auth/middleware.js';

const MUFA_BASE_URL = 'https://mufa.org';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('🌟 Starting season setup (static data: divisions & teams)...');

  try {
    const { seasonId, seasonName, forceRefresh = false } = req.body;

    if (!seasonId || !seasonName) {
      return res.status(400).json({
        error: 'seasonId and seasonName are required',
        example: { seasonId: 'fall-2025', seasonName: 'Fall 2025' }
      });
    }

    // Create or update season
    await sql.unsafe(`
      INSERT INTO seasons (id, name, is_current, start_date, end_date)
      VALUES ('${seasonId}', '${seasonName}', TRUE, CURRENT_DATE, CURRENT_DATE + INTERVAL '4 months')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        is_current = TRUE,
        updated_at = NOW()
    `);

    // Mark other seasons as not current
    await sql.unsafe(`
      UPDATE seasons SET is_current = FALSE WHERE id != '${seasonId}'
    `);

    console.log(`✅ Season '${seasonName}' set as current`);

    // Check if divisions already exist (unless forcing refresh)
    const existingDivisions = await sql.unsafe(`
      SELECT COUNT(*) as count FROM divisions WHERE season_id = '${seasonId}'
    `);

    const divisionCount = parseInt(existingDivisions[0]?.count || 0);

    if (divisionCount > 0 && !forceRefresh) {
      return res.status(200).json({
        success: true,
        message: `Season '${seasonName}' already has ${divisionCount} divisions. Use forceRefresh=true to re-scrape.`,
        seasonId,
        seasonName,
        divisionsFound: divisionCount
      });
    }

    // Scrape divisions and teams (static data)
    console.log('🔍 Scraping divisions and teams (this may take a moment)...');
    
    const divisionsData = await scrapeDivisionsAndTeams(seasonId);
    
    const duration = Date.now() - startTime;
    
    // Log setup
    await DatabaseService.logRefresh(
      'season-setup', 
      seasonId, 
      true, 
      divisionsData.totalTeams, 
      null, 
      duration
    );

    console.log(`✅ Season setup completed in ${duration}ms`);

    return res.status(200).json({
      success: true,
      duration,
      message: `Season '${seasonName}' setup complete`,
      seasonId,
      seasonName,
      divisionsSetup: divisionsData.divisionsCount,
      teamsSetup: divisionsData.totalTeams,
      details: divisionsData.divisions
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Season setup failed:', error);
    
    return res.status(500).json({
      success: false,
      duration,
      error: error.message,
      message: 'Season setup failed'
    });
  }
}

// Scrape divisions and their teams (static data)
async function scrapeDivisionsAndTeams(seasonId) {
  // This would typically involve scraping the main MUFA divisions page
  // For now, let's use the known division structure
  
  const knownDivisions = [
    { id: '517', name: 'Sun - FMP' },
    { id: '518', name: 'Sun - MMP' },
    { id: '519', name: 'Mon (Early Bird) - Mixed' },
    { id: '520', name: 'Mon (Night Owl) - Open' },
    { id: '521', name: 'Tues - Mixed' },
    { id: '522', name: 'Thurs - Mixed' },
    { id: '523', name: 'Mon/Wed - Mixed' },
    { id: '524', name: 'Tues/Thurs - Mixed' },
    { id: '525', name: 'Fall Sub Only' }
  ];

  const results = {
    divisionsCount: 0,
    totalTeams: 0,
    divisions: []
  };

  for (const division of knownDivisions) {
    try {
      console.log(`📋 Setting up division: ${division.name} (${division.id})`);
      
      // Create/update division
      await sql.unsafe(`
        INSERT INTO divisions (id, season_id, name, is_active)
        VALUES ('${division.id}', '${seasonId}', '${division.name}', TRUE)
        ON CONFLICT (id) DO UPDATE SET
          season_id = EXCLUDED.season_id,
          name = EXCLUDED.name,
          is_active = TRUE,
          updated_at = NOW()
      `);

      // Scrape teams for this division
      const teams = await scrapeTeamsForDivision(division);
      
      console.log(`👥 Found ${teams.length} teams in ${division.name}`);
      
      results.divisionsCount++;
      results.totalTeams += teams.length;
      results.divisions.push({
        id: division.id,
        name: division.name,
        teamsCount: teams.length
      });

    } catch (error) {
      console.error(`❌ Failed to setup division ${division.id}:`, error.message);
      results.divisions.push({
        id: division.id,
        name: division.name,
        error: error.message
      });
    }
  }

  return results;
}

// Scrape teams for a specific division
async function scrapeTeamsForDivision(division) {
  const response = await fetch(`${MUFA_BASE_URL}/League/Division/HomeArticle.aspx?d=${division.id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Connection': 'keep-alive'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for division ${division.id}`);
  }

  const html = await response.text();
  const $ = load(html);
  
  const teams = [];
  
  // Extract team links
  $('a[href*="Team.aspx?t="]').each((i, element) => {
    const $link = $(element);
    const href = $link.attr('href');
    const name = $link.text().trim();
    
    if (href && name) {
      const teamMatch = href.match(/[?&]t=(\d+)/);
      const divisionMatch = href.match(/[?&]d=(\d+)/);
      
      if (teamMatch && divisionMatch && divisionMatch[1] === division.id) {
        teams.push({
          id: teamMatch[1],
          name: name,
          divisionId: division.id
        });
      }
    }
  });

  // Store teams in database
  for (const team of teams) {
    try {
      await sql.unsafe(`
        INSERT INTO teams (id, division_id, name, jersey_color, is_active)
        VALUES ('${team.id}', '${team.divisionId}', '${team.name.replace(/'/g, "''")}', 'Unknown', TRUE)
        ON CONFLICT (id) DO UPDATE SET
          division_id = EXCLUDED.division_id,
          name = EXCLUDED.name,
          is_active = TRUE,
          updated_at = NOW()
      `);
    } catch (error) {
      console.error(`Error storing team ${team.id}:`, error.message);
    }
  }

  return teams;
}

export default requireAdmin(handler);