import bcrypt from 'bcryptjs';

// Password requirements
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true, 
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128
};

// Special characters allowed
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export class PasswordService {
  
  // Validate password strength
  static validatePassword(password) {
    const errors = [];
    
    if (!password || password.length < PASSWORD_REQUIREMENTS.minLength) {
      errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
    }
    
    if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
      errors.push(`Password must be no more than ${PASSWORD_REQUIREMENTS.maxLength} characters long`);
    }
    
    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
      const hasSpecialChar = SPECIAL_CHARS.split('').some(char => password.includes(char));
      if (!hasSpecialChar) {
        errors.push(`Password must contain at least one special character: ${SPECIAL_CHARS}`);
      }
    }
    
    // Check for common weak patterns
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password cannot contain more than 2 consecutive identical characters');
    }
    
    if (/123|abc|qwe|password|admin|login/i.test(password)) {
      errors.push('Password cannot contain common patterns or words');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  // Hash password securely
  static async hashPassword(password) {
    const validation = this.validatePassword(password);
    if (!validation.isValid) {
      throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
    }
    
    const saltRounds = 12; // High security
    return await bcrypt.hash(password, saltRounds);
  }
  
  // Verify password against hash
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }
  
  // Generate secure random password (for initial setup)
  static generateSecurePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + specials;
    let password = '';
    
    // Ensure at least one of each required type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    // Fill remaining length with random characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}