require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const { Server: SocketIOServer } = require('socket.io');

const connectDB = require('./src/config/db');
const seedAdmin = require('./src/utils/seedAdmin');
const { generalLimiter } = require('./src/middleware/rateLimiters');

const authRoutes = require('./src/routes/auth');
const contentRoutes = require('./src/routes/content');
const reviewRoutes = require('./src/routes/reviews');
const cardRoutes = require('./src/routes/cards');

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key] || process.env[key].startsWith('REPLACE_WITH') || process.env[key].startsWith('YOUR_')) {
    console.error(`❌ Missing/placeholder required env var: ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : false, credentials: true },
});
app.set('io', io);

// ---------- Security middleware ----------
app.set('trust proxy', 1); // needed for correct client IPs behind a reverse proxy (Render/Railway/etc.), used by rate limiting

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"], // real HTTP header this time — actually blocks clickjacking
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '15kb' })); // small limit — this app never needs large payloads
app.use(cookieParser());
app.use(mongoSanitize()); // strips `$` / `.` keys from req.body/query/params to block NoSQL injection
app.use('/api/', generalLimiter);

// ---------- API routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cards', cardRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ---------- Frontend (static files) ----------
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- 404 for unmatched API routes ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---------- Central error handler ----------
// Never leaks stack traces to the client, even on unexpected errors.
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Something went wrong on our end. Please try again.' : err.message,
  });
});

// ---------- Socket.IO ----------
io.on('connection', () => {
  // Stateless pub/sub — no per-client data is kept, so nothing to clean up on disconnect.
});

// ---------- Start ----------
(async () => {
  try {
    await connectDB();
    await seedAdmin();
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`🚀 Aapni Chai server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();
