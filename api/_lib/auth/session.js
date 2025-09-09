import crypto from 'crypto';
import { sql } from '../database/connection.js';

export class SessionService {
  
  // Generate secure session token
  static generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Create new session
  static async createSession(userId, ipAddress = null, userAgent = null) {
    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await sql.unsafe(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent)
      VALUES (${userId}, '${sessionToken}', '${expiresAt.toISOString()}', ${ipAddress ? `'${ipAddress}'` : 'NULL'}, ${userAgent ? `'${userAgent.replace(/'/g, "''")}'` : 'NULL'})
    `);
    
    return {
      token: sessionToken,
      expiresAt
    };
  }
  
  // Validate session token
  static async validateSession(sessionToken) {
    if (!sessionToken) return null;
    
    const result = await sql.unsafe(`
      SELECT s.*, u.email, u.first_name, u.last_name, u.role, u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token = '${sessionToken}'
        AND s.expires_at > NOW()
        AND u.is_active = TRUE
    `);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const session = result[0];
    
    // Update last login time
    await sql.unsafe(`
      UPDATE users 
      SET last_login = NOW() 
      WHERE id = ${session.user_id}
    `);
    
    return {
      userId: session.user_id,
      email: session.email,
      firstName: session.first_name,
      lastName: session.last_name,
      role: session.role,
      sessionId: session.id
    };
  }
  
  // Destroy session
  static async destroySession(sessionToken) {
    if (!sessionToken) return false;
    
    const result = await sql.unsafe(`
      DELETE FROM user_sessions 
      WHERE session_token = '${sessionToken}'
    `);
    
    return result && result.count > 0;
  }
  
  // Clean up expired sessions
  static async cleanupExpiredSessions() {
    const result = await sql.unsafe(`
      DELETE FROM user_sessions 
      WHERE expires_at < NOW()
    `);
    
    console.log(`🧹 Cleaned up ${result?.count || 0} expired sessions`);
    return result?.count || 0;
  }
  
  // Get user's active sessions
  static async getUserSessions(userId) {
    const result = await sql.unsafe(`
      SELECT id, ip_address, user_agent, created_at, expires_at
      FROM user_sessions
      WHERE user_id = ${userId} AND expires_at > NOW()
      ORDER BY created_at DESC
    `);
    
    return result || [];
  }
  
  // Destroy all user sessions (for logout all devices)
  static async destroyAllUserSessions(userId) {
    const result = await sql.unsafe(`
      DELETE FROM user_sessions 
      WHERE user_id = ${userId}
    `);
    
    return result?.count || 0;
  }
}