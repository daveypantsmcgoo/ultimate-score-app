import { load } from 'cheerio';

const MUFA_BASE_URL = 'https://www.mufa.org';

// Current season configuration
export const CURRENT_SEASON = {
  name: 'Fall 2025',
  lastChecked: null,
  isValid: null
};

// Check if current season is still active by scraping MUFA homepage
export async function validateCurrentSeason() {
  try {
    console.log('Checking current season validity...');
    
    const response = await fetch(MUFA_BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);
    
    // Look for the current season in the "Active Leagues" dropdown
    const seasonHeader = $('.dropdown-menu .bg-primary').text().trim();
    
    console.log(`Found season on MUFA: "${seasonHeader}"`);
    console.log(`Expected season: "${CURRENT_SEASON.name}"`);
    
    CURRENT_SEASON.lastChecked = new Date().toISOString();
    CURRENT_SEASON.isValid = seasonHeader === CURRENT_SEASON.name;
    
    if (!CURRENT_SEASON.isValid) {
      console.warn(`🚨 SEASON MISMATCH: Expected "${CURRENT_SEASON.name}", found "${seasonHeader}"`);
      console.warn('Static data may be outdated. Consider updating season configuration.');
    } else {
      console.log('✅ Season is current');
    }
    
    return {
      isValid: CURRENT_SEASON.isValid,
      currentSeason: seasonHeader,
      expectedSeason: CURRENT_SEASON.name,
      lastChecked: CURRENT_SEASON.lastChecked
    };
    
  } catch (error) {
    console.error('Error validating season:', error);
    CURRENT_SEASON.lastChecked = new Date().toISOString();
    CURRENT_SEASON.isValid = null; // Unknown
    
    return {
      isValid: null,
      error: error.message,
      lastChecked: CURRENT_SEASON.lastChecked
    };
  }
}

// Check if we need to validate season (only check once per hour)
export function shouldCheckSeason() {
  if (!CURRENT_SEASON.lastChecked) return true;
  
  const lastCheck = new Date(CURRENT_SEASON.lastChecked);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  return lastCheck < oneHourAgo;
}

// Get season status without making a web request
export function getSeasonStatus() {
  return {
    name: CURRENT_SEASON.name,
    isValid: CURRENT_SEASON.isValid,
    lastChecked: CURRENT_SEASON.lastChecked,
    needsCheck: shouldCheckSeason()
  };
}