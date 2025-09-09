import { UserService } from '../_lib/auth/user.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Get client info
    const ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Authenticate user
    const authResult = await UserService.authenticateUser(email, password, ipAddress, userAgent);

    // Set session cookie
    res.setHeader('Set-Cookie', [
      `session=${authResult.session.token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${24 * 60 * 60}; Path=/`,
    ]);

    return res.status(200).json({
      success: true,
      user: authResult.user,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed'
    });
  }
}