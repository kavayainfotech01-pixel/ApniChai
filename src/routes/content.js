const express = require('express');
const { body, validationResult } = require('express-validator');
const Content = require('../models/Content');
const { requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

async function getOrCreateContent() {
  let doc = await Content.findOne({ singleton: 'site' });
  if (!doc) {
    doc = await Content.create({ singleton: 'site' });
  }
  return doc;
}

// Public: anyone can read the current menu/loyalty/events/offers.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const doc = await getOrCreateContent();
    res.json(doc);
  })
);

// Admin only: replace the whole content document.
router.put(
  '/',
  requireAdmin,
  [
    body('menu').isObject(),
    body('menu.chai').isArray({ max: 100 }),
    body('menu.fastfood').isArray({ max: 100 }),
    body('menu.snacks').isArray({ max: 100 }),
    body('loyalty').isObject(),
    body('events').isArray({ max: 100 }),
    body('offers').isArray({ max: 100 }),
  ],
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid content payload.', details: errors.array() });
    }

    const { menu, loyalty, events, offers } = req.body;
    try {
      const doc = await Content.findOneAndUpdate(
        { singleton: 'site' },
        { $set: { menu, loyalty, events, offers } },
        { new: true, upsert: true, runValidators: true }
      );
      req.app.get('io').emit('content:updated', doc);
      res.json(doc);
    } catch (err) {
      // Mongoose validation errors (e.g. price out of range, text too long)
      // come back as ValidationError — surface a clean 400 instead of a 500.
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'Content failed validation.', details: err.message });
      }
      next(err);
    }
  })
);

module.exports = router;
