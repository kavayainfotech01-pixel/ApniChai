const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'aapnichai_session';

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript in the browser cannot read this — blocks XSS token theft
    secure: process.env.COOKIE_SECURE === 'true', // only sent over HTTPS in production
    sameSite: 'strict', // blocks the cookie being sent from other sites (CSRF protection)
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

// Blocks the request unless a valid admin session cookie is present.
function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // { id, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

// Doesn't block the request, but tells the route whether the caller is an
// authenticated admin (used e.g. to decide whether to include a "delete" affordance).
function attachAdminIfPresent(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token) {
    try {
      req.admin = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // ignore invalid/expired token — just treat as not logged in
    }
  }
  next();
}

module.exports = { COOKIE_NAME, signToken, setSessionCookie, clearSessionCookie, requireAdmin, attachAdminIfPresent };
