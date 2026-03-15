require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const { getPool }        = require('./config/db');
const { getRedis }       = require('./config/redis');
const eliminationJob     = require('./jobs/elimination.job');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin:  process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);
eliminationJob.setIo(io);

// ── Security headers ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ── CORS ─────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10kb' })); // prevent huge payloads

// ── Rate limiters ─────────────────────────────────────────────
// Auth endpoints: max 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      20,
  message:  { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// General API: max 200 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      200,
  message:  { success: false, message: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Apply auth rate limiter to auth routes
app.use('/api/auth/login',          authLimiter);
app.use('/api/auth/register',       authLimiter);
app.use('/api/auth/register-admin', authLimiter);

// Apply general limiter to all API routes
app.use('/api', apiLimiter);

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success:   true,
    message:   'SpinWheel API is running 🎡',
    timestamp: new Date().toISOString()
  });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',   require('./modules/auth/auth.routes'));
app.use('/api/coins',  require('./modules/coins/coins.routes'));
app.use('/api/wheel',  require('./modules/wheel/wheel.routes'));
app.use('/api/admin',  require('./modules/admin/admin.routes'));
app.use('/api/public', require('./modules/public/public.routes'));

// ── Socket.io ────────────────────────────────────────────────
require('./socket/socket.handler')(io);

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`
  });
});

// ── Startup ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await getPool();
    await getRedis();
    server.listen(PORT, () => {
      console.log(`\n🎡 SpinWheel API running on http://localhost:${PORT}`);
      console.log(`📡 Socket.io ready`);
      console.log(`🏥 Health: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();