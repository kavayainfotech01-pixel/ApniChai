const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Review = require('../models/Review');
const { requireAdmin } = require('../middleware/auth');
const { reviewLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public: latest reviews (capped, newest first).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(300);
    res.json(reviews);
  })
);

// Public: anyone can leave a review, but validated + rate-limited to curb spam.
router.post(
  '/',
  reviewLimiter,
  [
    body('name').trim().isLength({ min: 1, max: 60 }).escape(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').trim().isLength({ min: 1, max: 500 }).escape(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Please provide a name, a 1–5 rating, and a comment.' });
    }
    const { name, rating, comment } = req.body;
    const review = await Review.create({ name, rating, comment });
    req.app.get('io').emit('review:created', review);
    res.status(201).json(review);
  })
);

// Admin only: moderate/delete a review.
router.delete(
  '/:id',
  requireAdmin,
  [param('id').isMongoId()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid review id.' });

    const deleted = await Review.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Review not found.' });

    req.app.get('io').emit('review:deleted', { id: req.params.id });
    res.json({ ok: true });
  })
);

module.exports = router;
