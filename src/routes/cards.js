const express = require('express');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const Card = require('../models/Card');
const { requireAdmin } = require('../middleware/auth');
const { cardLookupLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// 6 random uppercase-letter/digit characters ≈ 2.1 billion combinations —
// long enough that guessing a real code by brute force isn't practical,
// especially combined with the lookup rate limiter below.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
function generateCode() {
  let code = 'AC-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return code;
}
async function generateUniqueCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const exists = await Card.findOne({ code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique card code, please try again.');
}

// ---------- Admin: list all cards ----------
router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const cards = await Card.find().sort({ createdAt: -1 }).limit(2000);
    res.json(cards);
  })
);

// ---------- Admin: create a new card ----------
router.post(
  '/',
  requireAdmin,
  [
    body('name').trim().isLength({ min: 1, max: 60 }).escape(),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Please provide a valid name.' });

    const code = await generateUniqueCode();
    const card = await Card.create({ code, name: req.body.name, phone: req.body.phone || '' });
    req.app.get('io').emit('card:updated', card);
    res.status(201).json(card);
  })
);

// ---------- Public: look up ONE card by its exact code ----------
// Rate-limited + returns nothing on a partial/near match, so this cannot be
// used to enumerate/scrape the customer list — only someone who already has
// the exact code (given to them by staff) can see a card.
router.get(
  '/lookup/:code',
  cardLookupLimiter,
  [param('code').trim().isLength({ min: 3, max: 20 })],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid code.' });

    const code = req.params.code.trim().toUpperCase();
    const card = await Card.findOne({ code }).select('code name punches redeemed');
    if (!card) return res.status(404).json({ error: 'No card found with that code.' });
    res.json(card);
  })
);

// ---------- Admin: add a punch ----------
router.patch(
  '/:id/punch',
  requireAdmin,
  [param('id').isMongoId()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid card id.' });

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found.' });

    card.punches = Math.min(10, card.punches + 1);
    card.lastVisit = new Date();
    await card.save();
    req.app.get('io').emit('card:updated', card);
    res.json(card);
  })
);

// ---------- Admin: redeem (reset punches, increment redeemed count) ----------
router.patch(
  '/:id/redeem',
  requireAdmin,
  [param('id').isMongoId()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid card id.' });

    const card = await Card.findById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Card not found.' });
    if (card.punches < 10) return res.status(400).json({ error: 'Card is not ready to redeem yet.' });

    card.punches = 0;
    card.redeemed += 1;
    card.lastVisit = new Date();
    await card.save();
    req.app.get('io').emit('card:updated', card);
    res.json(card);
  })
);

// ---------- Admin: delete a card ----------
router.delete(
  '/:id',
  requireAdmin,
  [param('id').isMongoId()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid card id.' });

    const deleted = await Card.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Card not found.' });

    req.app.get('io').emit('card:deleted', { id: req.params.id });
    res.json({ ok: true });
  })
);

module.exports = router;
