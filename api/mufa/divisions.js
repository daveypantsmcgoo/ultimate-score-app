import { validateCurrentSeason, shouldCheckSeason, getSeasonStatus } from '../_lib/seasonManager.js';

// Static divisions for Fall 2025 season
// Update this list at the start of each season
const FALL_2025_DIVISIONS = [
  { id: '517', name: 'Sun - FMP', season: 'Fall 2025' },
  { id: '518', name: 'Sun - MMP', season: 'Fall 2025' },
  { id: '519', name: 'Mon (Early Bird) - Mixed', season: 'Fall 2025' },
  { id: '520', name: 'Mon (Night Owl) - Open', season: 'Fall 2025' },
  { id: '521', name: 'Tues - Mixed', season: 'Fall 2025' },
  { id: '522', name: 'Thurs - Mixed', season: 'Fall 2025' },
  { id: '523', name: 'Mon/Wed - Mixed', season: 'Fall 2025' },
  { id: '524', name: 'Tues/Thurs - Mixed', season: 'Fall 2025' },
  { id: '525', name: 'Fall Sub Only', season: 'Fall 2025' }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { checkSeason } = req.query;

  // Check season validity if requested or if it's been a while
  if (checkSeason || shouldCheckSeason()) {
    try {
      const seasonStatus = await validateCurrentSeason();
      
      // Add season info to response headers for debugging
      res.setHeader('X-Season-Valid', seasonStatus.isValid);
      res.setHeader('X-Season-Current', seasonStatus.currentSeason || 'unknown');
      res.setHeader('X-Season-Expected', seasonStatus.expectedSeason);
      res.setHeader('X-Season-Last-Checked', seasonStatus.lastChecked);
      
      if (seasonStatus.isValid === false) {
        // Season has changed - return warning with static data
        return res.status(200).json({
          divisions: FALL_2025_DIVISIONS,
          seasonWarning: {
            message: 'Season may have changed. Static data might be outdated.',
            currentSeason: seasonStatus.currentSeason,
            expectedSeason: seasonStatus.expectedSeason,
            action: 'Update season configuration and refresh team data'
          }
        });
      }
    } catch (error) {
      console.error('Season check failed, returning static data:', error);
      res.setHeader('X-Season-Check-Error', error.message);
    }
  }

  // Return static divisions (fast response)
  res.status(200).json(FALL_2025_DIVISIONS);
}