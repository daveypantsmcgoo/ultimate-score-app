import { SessionService } from './session.js';

// Middleware to require authentication
export function requireAuth(handler) {
  return async function authWrapper(req, res) {
    try {
      // Get session token from cookie or Authorization header
      let sessionToken = null;
      
      // Try cookie first
      const cookies = req.headers.cookie || '';
      const sessionMatch = cookies.match(/session=([^;]+)/);
      if (sessionMatch) {
        sessionToken = sessionMatch[1];
      }
      
      // Fallback to Authorization header
      if (!sessionToken && req.headers.authorization) {
        const authMatch = req.headers.authorization.match(/Bearer (.+)/);
        if (authMatch) {
          sessionToken = authMatch[1];
        }
      }

      if (!sessionToken) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NO_SESSION'
        });
      }

      // Validate session
      const user = await SessionService.validateSession(sessionToken);
      if (!user) {
        return res.status(401).json({
          error: 'Invalid or expired session',
          code: 'INVALID_SESSION'
        });
      }

      // Add user to request object
      req.user = user;

      // Call the original handler
      return await handler(req, res);

    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  };
}

// Middleware to require specific role
export function requireRole(role) {
  return function roleMiddleware(handler) {
    return requireAuth(async function roleWrapper(req, res) {
      if (req.user.role !== role) {
        return res.status(403).json({
          error: `${role} role required`,
          code: 'INSUFFICIENT_ROLE'
        });
      }

      return await handler(req, res);
    });
  };
}

// Admin-only middleware
export const requireAdmin = requireRole('admin');