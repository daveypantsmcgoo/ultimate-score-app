// Static teams for Fall 2025 season - updated at season start
// To refresh: add ?refresh=true to the URL
const FALL_2025_TEAMS = {
  '517': [ // Sun - FMP
    { id: '6092', name: 'Chupacabra', divisionId: '517', jerseyColor: 'White' },
    { id: '6093', name: 'Grootslang', divisionId: '517', jerseyColor: 'Dark' },
    { id: '6094', name: 'Bunyip', divisionId: '517', jerseyColor: 'White' },
    { id: '6095', name: 'Hydra', divisionId: '517', jerseyColor: 'Dark' },
    { id: '6096', name: 'Rusalka', divisionId: '517', jerseyColor: 'Dark' },
    { id: '6097', name: 'Dryad', divisionId: '517', jerseyColor: 'Neon Pink' }
  ],
  '518': [ // Sun - MMP
    // Add teams when needed
  ],
  '519': [ // Mon (Early Bird) - Mixed
    // Add teams when needed
  ],
  '520': [ // Mon (Night Owl) - Open
    // Add teams when needed
  ],
  '521': [ // Tues - Mixed
    // Add teams when needed
  ],
  '522': [ // Thurs - Mixed
    // Add teams when needed
  ],
  '523': [ // Mon/Wed - Mixed
    // Add teams when needed
  ],
  '524': [ // Tues/Thurs - Mixed
    // Add teams when needed
  ],
  '525': [ // Fall Sub Only
    // Add teams when needed
  ]
};

import { load } from 'cheerio';
import { getSeasonStatus } from '../_lib/seasonManager.js';

const MUFA_BASE_URL = 'https://www.mufa.org';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { divisionId, refresh } = req.query;
  
  if (!divisionId) {
    return res.status(400).json({ error: 'divisionId parameter is required' });
  }

  // Check if season is still valid
  const seasonStatus = getSeasonStatus();
  if (seasonStatus.isValid === false && !refresh) {
    console.warn(`Season mismatch detected for division ${divisionId}`);
    res.setHeader('X-Season-Warning', 'Static data may be outdated');
  }

  // Return static data unless refresh is requested
  if (!refresh && FALL_2025_TEAMS[divisionId] && FALL_2025_TEAMS[divisionId].length > 0) {
    console.log(`Returning static teams for division ${divisionId}`);
    
    if (seasonStatus.isValid === false) {
      return res.status(200).json({
        teams: FALL_2025_TEAMS[divisionId],
        seasonWarning: {
          message: 'Season may have changed. Team data might be outdated.',
          action: 'Use ?refresh=true to get latest data'
        }
      });
    }
    
    return res.status(200).json(FALL_2025_TEAMS[divisionId]);
  }

  // Only scrape if refresh=true or no static data exists
  console.log(`Scraping teams for division ${divisionId} (refresh=${refresh})`);

  try {
    const response = await fetch(`${MUFA_BASE_URL}/League/Division/HomeArticle.aspx?d=${divisionId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);
    
    const teams = [];
    
    // Try multiple selectors to find team links
    const selectors = [
      'a[href*="Team.aspx?t="]',
      'a[href*="t="]',
      '.team-link a',
      'table a[href*="t="]',
      'tr a[href*="t="]'
    ];

    for (const selector of selectors) {
      $(selector).each((i, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const name = $link.text().trim();
        
        if (href && name && name.length > 0) {
          const teamMatch = href.match(/[?&]t=(\d+)/);
          const divMatch = href.match(/[?&]d=(\d+)/);
          
          if (teamMatch && (!divMatch || divMatch[1] === divisionId)) {
            const teamId = teamMatch[1];
            
            // Avoid duplicates
            if (!teams.find(t => t.id === teamId)) {
              teams.push({
                id: teamId,
                name,
                divisionId,
                jerseyColor: 'Unknown' // Would need additional scraping to get colors
              });
            }
          }
        }
      });
      
      // Break if we found teams with this selector
      if (teams.length > 0) break;
    }

    if (teams.length === 0) {
      console.error(`No teams found for division ${divisionId}`);
      return res.status(404).json({ 
        error: `No teams found for division ${divisionId}`,
        details: 'No team links found - division may not exist or website structure may have changed'
      });
    }

    // If this was a refresh, log the teams for updating static data
    if (refresh) {
      console.log(`Teams for division ${divisionId}:`);
      console.log(JSON.stringify(teams, null, 2));
      console.log('Copy the above to update FALL_2025_TEAMS');
    }

    res.status(200).json(teams);
  } catch (error) {
    console.error(`Error scraping teams for division ${divisionId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch teams from MUFA website',
      details: error.message
    });
  }
}