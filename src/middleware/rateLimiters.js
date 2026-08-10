const rateLimit = require('express-rate-limit');

// Login: strict, to slow down password-guessing attacks.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a few minutes.' },
});

// Review submission: prevents review-bombing / spam scripts.
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8, // 8 reviews per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reviews submitted from this device. Please try again later.' },
});

// Card lookup: prevents someone from brute-forcing card codes (e.g. AC-0000 .. AC-9999).
const cardLookupLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many card lookups. Please wait a few minutes and try again.' },
});

// General API: a broad safety net against abusive traffic.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, reviewLimiter, cardLookupLimiter, generalLimiter };
