const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true, maxlength: 80 },
    hi: { type: String, required: true, trim: true, maxlength: 80 },
    den: { type: String, default: '', trim: true, maxlength: 300 },
    dhi: { type: String, default: '', trim: true, maxlength: 300 },
    price: { type: Number, required: true, min: 0, max: 100000 },
    tagEn: { type: String, default: '', trim: true, maxlength: 40 },
    tagHi: { type: String, default: '', trim: true, maxlength: 40 },
    hot: { type: Boolean, default: false },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    day: { type: String, default: '', maxlength: 4 },
    month: { type: String, default: '', maxlength: 10 },
    titleEn: { type: String, default: '', trim: true, maxlength: 80 },
    titleHi: { type: String, default: '', trim: true, maxlength: 80 },
    descEn: { type: String, default: '', trim: true, maxlength: 300 },
    descHi: { type: String, default: '', trim: true, maxlength: 300 },
    time: { type: String, default: '', trim: true, maxlength: 60 },
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    icon: { type: String, default: '🎉', maxlength: 8 },
    titleEn: { type: String, default: '', trim: true, maxlength: 80 },
    titleHi: { type: String, default: '', trim: true, maxlength: 80 },
    descEn: { type: String, default: '', trim: true, maxlength: 300 },
    descHi: { type: String, default: '', trim: true, maxlength: 300 },
    tagEn: { type: String, default: '', trim: true, maxlength: 40 },
    tagHi: { type: String, default: '', trim: true, maxlength: 40 },
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'site', unique: true }, // ensures only one document ever exists
    menu: {
      chai: { type: [menuItemSchema], default: [] },
      fastfood: { type: [menuItemSchema], default: [] },
      snacks: { type: [menuItemSchema], default: [] },
    },
    loyalty: {
      filled: { type: Number, default: 0, min: 0, max: 10 },
      textEn: { type: String, default: '', maxlength: 400 },
      textHi: { type: String, default: '', maxlength: 400 },
    },
    events: { type: [eventSchema], default: [] },
    offers: { type: [offerSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Content', contentSchema);
