const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, default: '', trim: true, maxlength: 20 },
    punches: { type: Number, default: 0, min: 0, max: 10 },
    redeemed: { type: Number, default: 0, min: 0 },
    lastVisit: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Card', cardSchema);
