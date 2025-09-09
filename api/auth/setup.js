import { UserService } from '../_lib/auth/user.js';
import { PasswordService } from '../_lib/auth/password.js';
import { sql } from '../_lib/database/connection.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Run users table migration first
    await sql.unsafe(`
      -- Create users table for admin authentication
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          role VARCHAR(50) DEFAULT 'admin',
          is_active BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create index on email for fast lookups
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

      -- Create sessions table for login session management
      CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create index on session token for fast lookups
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
    `);

    // Check if any users exist
    const existingUsers = await sql.unsafe(`SELECT COUNT(*) as count FROM users`);
    const userCount = parseInt(existingUsers[0]?.count || 0);

    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Users already exist. Use the regular login endpoint.',
        userCount
      });
    }

    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required for initial setup'
      });
    }

    // Validate password strength
    const passwordValidation = PasswordService.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        requirements: passwordValidation.errors
      });
    }

    // Create the first admin user
    const user = await UserService.createUser(email, password, firstName, lastName, 'admin');

    return res.status(201).json({
      success: true,
      message: 'Initial admin user created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Setup failed'
    });
  }
}