// Creates the first admin account from ADMIN_EMAIL / ADMIN_PASSWORD in .env,
// but ONLY if no admin account exists yet. Safe to run every time the server
// starts — it's a no-op after the first admin is created.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

async function seedAdmin() {
  const existing = await Admin.countDocuments();
  if (existing > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      '⚠️  No admin account exists yet, and ADMIN_EMAIL / ADMIN_PASSWORD are not set in .env — ' +
        'the admin panel will have nobody who can log in until you set them and restart, or create one directly in MongoDB.'
    );
    return;
  }
  if (password.length < 8) {
    console.warn('⚠️  ADMIN_PASSWORD is shorter than 8 characters — please use a longer, stronger password.');
  }

  const passwordHash = await Admin.hashPassword(password);
  await Admin.create({ email: email.toLowerCase(), passwordHash });
  console.log(`✅ Admin account created for ${email}. You can log in now.`);
  console.log('   You can remove ADMIN_EMAIL / ADMIN_PASSWORD from .env after this — they are only used once.');
}

// Allow running standalone via `npm run seed:admin`
if (require.main === module) {
  connectDB()
    .then(seedAdmin)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('Seed failed:', err.message);
      process.exit(1);
    });
}

module.exports = seedAdmin;
