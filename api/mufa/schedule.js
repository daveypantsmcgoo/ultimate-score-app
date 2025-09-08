import { load } from 'cheerio';

const MUFA_BASE_URL = 'https://www.mufa.org';

// In-memory cache with timestamps 
let scheduleCache = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for schedules

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { teamId, divisionId } = req.query;
  
  if (!teamId || !divisionId) {
    return res.status(400).json({ error: 'teamId and divisionId parameters are required' });
  }

  try {
    // Check cache first
    const cacheKey = `schedule_${teamId}_${divisionId}`;
    const cached = scheduleCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log(`Returning cached schedule for team ${teamId}`);
      return res.status(200).json(cached.data);
    }

    const response = await fetch(`${MUFA_BASE_URL}/League/Division/Team.aspx?t=${teamId}&d=${divisionId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);
    
    const games = [];
    
    console.log(`Parsing schedule for team ${teamId}`);
    
    // Extract team name from the page
    const currentTeamName = $('#cpMain_cpMain_lblTeamName').text().trim() || 'Your Team';
    console.log(`Team name: ${currentTeamName}`);
    
    // Parse mobile schedule table (d-lg-none section)
    $('.clickable-row').each((index, element) => {
      const $row = $(element);
      
      // Extract date and time from the first strong element
      const dateTimeText = $row.find('strong').first().text(); // "Sun, Sep-07 6:00 PM"
      console.log(`Found game ${index + 1}: ${dateTimeText}`);
      
      if (!dateTimeText) return;
      
      // Parse date and time
      const dateTimeMatch = dateTimeText.match(/([A-Za-z]{3}),\s+([A-Za-z]{3})-(\d{2})\s+(\d{1,2}:\d{2}\s*[AP]M)/);
      if (!dateTimeMatch) {
        console.error(`Could not parse datetime: ${dateTimeText}`);
        return;
      }
      
      const monthStr = dateTimeMatch[2];
      const dayStr = dateTimeMatch[3];
      const timeStr = dateTimeMatch[4];
      
      // Convert to proper date
      const currentYear = 2025;
      const monthMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = monthMap[monthStr];
      const day = parseInt(dayStr);
      
      if (month === undefined) {
        console.error(`Unknown month: ${monthStr}`);
        return;
      }
      
      const gameDate = new Date(currentYear, month, day);
      
      // Extract opponent team name (look for team link)
      const opponentLink = $row.find('a[href*="Team.aspx?t="]');
      const opponent = opponentLink.text().trim();
      
      if (!opponent) {
        console.log(`No opponent found for game ${index + 1}`);
        return;
      }
      
      // Extract field name (look for field link)
      const fieldLink = $row.find('a[href*="Field.aspx?f="]');
      const fieldName = fieldLink.text().trim();
      
      // Check if game is complete (look for W/L result)
      const resultElement = $row.find('span[data-toggle="tooltip"]');
      const isComplete = resultElement.length > 0 && resultElement.attr('title') && 
                        (resultElement.attr('title').includes('Won') || resultElement.attr('title').includes('Lost'));
      
      console.log(`Game ${index + 1} - Opponent: ${opponent}, Field: ${fieldName}, Complete: ${isComplete}, Date: ${gameDate.toISOString()}`);
      
      // Extract opponent team ID from the link
      const opponentHref = opponentLink.attr('href');
      const opponentIdMatch = opponentHref ? opponentHref.match(/t=(\d+)/) : null;
      const opponentId = opponentIdMatch ? opponentIdMatch[1] : `opponent_${teamId}_${index}`;
      
      // Create field object
      const field = fieldName ? {
        id: fieldName.toLowerCase().replace(/\s+/g, ''),
        name: fieldName,
        mapUrl: `https://maps.google.com/search/${encodeURIComponent(fieldName + ' Madison WI')}`,
        diagramUrl: null
      } : {
        id: 'unknown',
        name: 'TBD', 
        mapUrl: null,
        diagramUrl: null
      };
      
      // Create team objects
      const currentTeam = { id: teamId, name: currentTeamName, divisionId };
      const opponentTeam = { 
        id: opponentId, 
        name: opponent, 
        divisionId 
      };
      
      games.push({
        id: `game_${teamId}_${gameDate.getTime()}_${index}`,
        date: gameDate.toISOString(),
        time: timeStr,
        teamA: currentTeam,
        teamB: opponentTeam,
        field,
        isComplete
      });
    });

    if (games.length === 0) {
      console.error(`No schedule found for team ${teamId} in division ${divisionId}`);
      console.error('Page title:', $('title').text());
      console.error('Tables found:', $('table').length);
      return res.status(404).json({ 
        error: `No schedule found for team ${teamId}`,
        details: 'No schedule data found - team may not exist or have no games scheduled'
      });
    }

    // Cache the result
    scheduleCache[cacheKey] = {
      data: games,
      timestamp: Date.now()
    };
    
    res.status(200).json(games);
  } catch (error) {
    console.error(`Error scraping schedule for team ${teamId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch schedule from MUFA website',
      details: error.message
    });
  }
}