import { sql } from '../database/connection.js';
import { PasswordService } from './password.js';
import { SessionService } from './session.js';

export class UserService {
  
  // Create new user
  static async createUser(email, password, firstName = null, lastName = null, role = 'admin') {
    // Validate email
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Valid email address is required');
    }
    
    // Check if user already exists
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const passwordHash = await PasswordService.hashPassword(password);
    
    // Create user
    const result = await sql.unsafe(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ('${email.toLowerCase()}', '${passwordHash}', ${firstName ? `'${firstName}'` : 'NULL'}, ${lastName ? `'${lastName}'` : 'NULL'}, '${role}')
      RETURNING id, email, first_name, last_name, role, created_at
    `);
    
    if (!result || result.length === 0) {
      throw new Error('Failed to create user');
    }
    
    const user = result[0];
    console.log(`✅ Created user: ${user.email} (ID: ${user.id})`);
    
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      createdAt: user.created_at
    };
  }
  
  // Find user by email
  static async findUserByEmail(email) {
    if (!email) return null;
    
    const result = await sql.unsafe(`
      SELECT id, email, password_hash, first_name, last_name, role, is_active, last_login, created_at
      FROM users
      WHERE email = '${email.toLowerCase()}' AND is_active = TRUE
    `);
    
    return result && result.length > 0 ? result[0] : null;
  }
  
  // Authenticate user
  static async authenticateUser(email, password, ipAddress = null, userAgent = null) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    // Find user
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Verify password
    const isValidPassword = await PasswordService.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }
    
    // Create session
    const session = await SessionService.createSession(user.id, ipAddress, userAgent);
    
    console.log(`🔐 User authenticated: ${user.email}`);
    
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        lastLogin: user.last_login
      },
      session: session
    };
  }
  
  // Update user password
  static async updatePassword(userId, currentPassword, newPassword) {
    // Get user
    const result = await sql.unsafe(`
      SELECT password_hash FROM users WHERE id = ${userId} AND is_active = TRUE
    `);
    
    if (!result || result.length === 0) {
      throw new Error('User not found');
    }
    
    const user = result[0];
    
    // Verify current password
    const isValidPassword = await PasswordService.verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const newPasswordHash = await PasswordService.hashPassword(newPassword);
    
    // Update password
    await sql.unsafe(`
      UPDATE users 
      SET password_hash = '${newPasswordHash}', updated_at = NOW()
      WHERE id = ${userId}
    `);
    
    // Destroy all existing sessions (force re-login)
    await SessionService.destroyAllUserSessions(userId);
    
    console.log(`🔑 Password updated for user ID: ${userId}`);
    return true;
  }
  
  // Validate email format
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Get user profile
  static async getUserProfile(userId) {
    const result = await sql.unsafe(`
      SELECT id, email, first_name, last_name, role, last_login, created_at
      FROM users
      WHERE id = ${userId} AND is_active = TRUE
    `);
    
    if (!result || result.length === 0) {
      return null;
    }
    
    const user = result[0];
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      lastLogin: user.last_login,
      createdAt: user.created_at
    };
  }
  
  // List all users (admin only)
  static async listUsers() {
    const result = await sql.unsafe(`
      SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    return result || [];
  }
}