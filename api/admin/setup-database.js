import { DatabaseService } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple security - require a setup token
  const { setupToken } = req.body;
  if (setupToken !== 'setup-mufa-db-2025') {
    return res.status(401).json({ error: 'Invalid setup token' });
  }

  try {
    console.log('Starting database setup...');
    
    // Test connection first
    const connectionOk = await DatabaseService.testConnection();
    if (!connectionOk) {
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: 'Check your POSTGRES_URL environment variable'
      });
    }

    // Check if database is already initialized
    const initialized = await DatabaseService.initializeDatabase();
    
    if (initialized) {
      // Get current status
      const currentSeason = await DatabaseService.getCurrentSeason();
      const divisions = await DatabaseService.getDivisions();
      
      return res.status(200).json({
        status: 'already_initialized',
        message: 'Database is already set up',
        currentSeason,
        divisionsCount: divisions.length,
        nextSteps: [
          'Run data scraping to populate teams and games',
          'Set up cron jobs for regular updates'
        ]
      });
    } else {
      return res.status(200).json({
        status: 'needs_schema',
        message: 'Database connected but schema not found',
        instructions: [
          '1. Go to your Vercel dashboard',
          '2. Navigate to Storage > Databases',
          '3. Create a new Postgres database',
          '4. Copy the schema.sql contents and run in the database console',
          '5. Retry this setup endpoint'
        ]
      });
    }

  } catch (error) {
    console.error('Database setup error:', error);
    return res.status(500).json({
      error: 'Database setup failed',
      details: error.message
    });
  }
}