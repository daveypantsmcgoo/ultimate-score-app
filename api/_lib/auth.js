// Simple API key authentication for public endpoints
export function authenticateRequest(req) {
  // Allow cron jobs with proper authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.includes('Bearer cron-')) {
    return true;
  }
  
  // Allow admin requests
  if (req.query.admin === 'true') {
    return true;
  }
  
  // Allow requests with valid API key
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validKeys = [
    'mufa-public-2025', // Public key for app
    process.env.MUFA_API_KEY // Private key from env
  ];
  
  if (apiKey && validKeys.includes(apiKey)) {
    return true;
  }
  
  return false;
}

export function requireAuth(handler) {
  return async (req, res) => {
    if (!authenticateRequest(req)) {
      return res.status(401).json({ 
        error: 'API key required',
        hint: 'Add ?apiKey=mufa-public-2025 or X-API-Key header'
      });
    }
    
    return handler(req, res);
  };
}