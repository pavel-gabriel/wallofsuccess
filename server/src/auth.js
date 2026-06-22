import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_TTL = process.env.JWT_TTL || '12h';
const REQUEST_API_KEY = process.env.REQUEST_API_KEY || '';

export function signToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: JWT_TTL });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// Express middleware: require a valid admin JWT.
export function requireAdmin(req, res, next) {
  const payload = verifyToken(bearer(req));
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.admin = payload;
  next();
}

// Authorize the request-testimonial endpoint: a logged-in admin JWT OR a shared
// API key (for external apps). Mirrors the old Edge Function's two paths.
export function adminOrApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (REQUEST_API_KEY && apiKey && apiKey === REQUEST_API_KEY) return next();
  const payload = verifyToken(bearer(req));
  if (payload) {
    req.admin = payload;
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}
