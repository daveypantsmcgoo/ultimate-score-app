import { DatabaseService } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  // Security check
  if (req.query.admin !== 'true') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const action = req.query.action || 'enable';
    
    if (action === 'enable') {
      await DatabaseService.setForceRefresh(true);
      return res.status(200).json({
        success: true,
        message: 'Force refresh enabled - next scrape will process all teams',
        action: 'enabled'
      });
    } else if (action === 'disable') {
      await DatabaseService.setForceRefresh(false);
      return res.status(200).json({
        success: true,
        message: 'Force refresh disabled - scraping will be selective',
        action: 'disabled'
      });
    } else if (action === 'status') {
      const isEnabled = await DatabaseService.shouldForceRefresh();
      return res.status(200).json({
        success: true,
        forceRefresh: isEnabled,
        message: isEnabled ? 'Force refresh is currently enabled' : 'Selective refresh is active'
      });
    } else {
      return res.status(400).json({
        error: 'Invalid action',
        validActions: ['enable', 'disable', 'status']
      });
    }
    
  } catch (error) {
    console.error('Error managing force refresh:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to manage force refresh',
      details: error.message
    });
  }
}