import postgres from 'postgres';

// Database connection using Neon's DATABASE_URL
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = postgres(connectionString, {
  max: 1, // Limit connections for serverless
});

// Helper functions for common database operations
export class DatabaseService {
  
  // Test database connection
  static async testConnection() {
    try {
      const result = await sql`SELECT NOW() as current_time`;
      console.log('Database connected:', result.rows[0].current_time);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  // Initialize database (run schema)
  static async initializeDatabase() {
    try {
      console.log('Initializing database schema...');
      
      // Check if seasons table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'seasons'
        );
      `;
      
      if (tableExists.rows[0].exists) {
        console.log('Database already initialized');
        return true;
      }

      // If not exists, we need to run the schema
      // Note: In production, you'd run the schema.sql file separately
      console.log('Database needs initialization - run schema.sql manually');
      return false;
      
    } catch (error) {
      console.error('Database initialization failed:', error);
      return false;
    }
  }

  // Get current season
  static async getCurrentSeason() {
    try {
      const result = await sql`
        SELECT * FROM seasons 
        WHERE is_current = TRUE 
        LIMIT 1
      `;
      console.log('🏛️ Current season query result:', result?.length || 0, 'seasons found');
      // Handle postgres package result format (no .rows property)
      return result?.[0] || null;
    } catch (error) {
      console.error('Error getting current season:', error);
      return null;
    }
  }

  // Get divisions for current season
  static async getDivisions(seasonId = null) {
    try {
      let result;
      if (seasonId) {
        result = await sql`
          SELECT * FROM divisions 
          WHERE season_id = ${seasonId} AND is_active = TRUE
          ORDER BY name
        `;
      } else {
        result = await sql`
          SELECT d.* FROM divisions d
          JOIN seasons s ON d.season_id = s.id
          WHERE s.is_current = TRUE AND d.is_active = TRUE
          ORDER BY d.name
        `;
      }
      return result || [];
    } catch (error) {
      console.error('Error getting divisions:', error);
      return [];
    }
  }

  // Get teams for a division
  static async getTeams(divisionId) {
    try {
      const result = await sql`
        SELECT * FROM teams 
        WHERE division_id = ${divisionId} AND is_active = TRUE
        ORDER BY name
      `;
      return result.rows;
    } catch (error) {
      console.error('Error getting teams:', error);
      return [];
    }
  }

  // Get games for a team
  static async getTeamSchedule(teamId, divisionId) {
    try {
      const result = await sql`
        SELECT 
          g.*,
          ta.name as team_a_name,
          tb.name as team_b_name,
          f.name as field_name,
          f.map_url as field_map_url,
          f.diagram_url as field_diagram_url
        FROM games g
        LEFT JOIN teams ta ON g.team_a_id = ta.id
        LEFT JOIN teams tb ON g.team_b_id = tb.id
        LEFT JOIN fields f ON g.field_id = f.id
        WHERE (g.team_a_id = ${teamId} OR g.team_b_id = ${teamId})
          AND g.division_id = ${divisionId}
        ORDER BY g.game_datetime ASC
      `;
      return result.rows;
    } catch (error) {
      console.error('Error getting team schedule:', error);
      return [];
    }
  }

  // Get all fields
  static async getFields() {
    try {
      const result = await sql`
        SELECT * FROM fields 
        ORDER BY name
      `;
      return result.rows;
    } catch (error) {
      console.error('Error getting fields:', error);
      return [];
    }
  }

  // Log data refresh
  static async logRefresh(dataType, divisionId, success, recordsUpdated = 0, errorMessage = null, durationMs = 0) {
    try {
      await sql`
        INSERT INTO data_refresh_log 
        (data_type, division_id, success, records_updated, error_message, duration_ms, refresh_completed_at)
        VALUES (${dataType}, ${divisionId}, ${success}, ${recordsUpdated}, ${errorMessage}, ${durationMs}, NOW())
      `;
    } catch (error) {
      console.error('Error logging refresh:', error);
    }
  }

  // Get latest refresh status
  static async getLatestRefresh(dataType, divisionId = null) {
    try {
      let result;
      if (divisionId) {
        result = await sql`
          SELECT * FROM data_refresh_log 
          WHERE data_type = ${dataType} AND division_id = ${divisionId}
          ORDER BY refresh_started_at DESC 
          LIMIT 1
        `;
      } else {
        result = await sql`
          SELECT * FROM data_refresh_log 
          WHERE data_type = ${dataType}
          ORDER BY refresh_started_at DESC 
          LIMIT 1
        `;
      }
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting latest refresh:', error);
      return null;
    }
  }
}