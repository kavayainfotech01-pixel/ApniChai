const express = require('express');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const { signToken, setSessionCookie, clearSessionCookie, requireAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const LOCK_THRESHOLD = 8; // failed attempts before temporary lockout
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 1, max: 200 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Please enter a valid email and password.' });
    }

    const { email, password } = req.body;
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    // Same generic error whether the email doesn't exist or the password is
    // wrong — this stops an attacker from using the login form to discover
    // which admin emails are valid.
    const genericError = () => res.status(401).json({ error: 'Incorrect email or password.' });

    if (!admin) return genericError();

    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((admin.lockedUntil - new Date()) / 60000);
      return res.status(423).json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).` });
    }

    const valid = await admin.verifyPassword(password);
    if (!valid) {
      admin.failedLoginAttempts += 1;
      if (admin.failedLoginAttempts >= LOCK_THRESHOLD) {
        admin.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        admin.failedLoginAttempts = 0;
      }
      await admin.save();
      return genericError();
    }

    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    await admin.save();

    const token = signToken({ id: admin._id.toString(), email: admin.email });
    setSessionCookie(res, token);
    res.json({ ok: true, email: admin.email });
  })
);

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ email: req.admin.email });
});

module.exports = router;
