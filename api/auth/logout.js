import { SessionService } from '../_lib/auth/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session token from cookie
    const cookies = req.headers.cookie || '';
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : null;

    if (sessionToken) {
      await SessionService.destroySession(sessionToken);
    }

    // Clear session cookie
    res.setHeader('Set-Cookie', [
      'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/',
    ]);

    return res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
}