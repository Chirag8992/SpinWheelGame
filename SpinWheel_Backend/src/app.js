require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');

const { getPool }  = require('./config/db');
const { getRedis } = require('./config/redis');
const eliminationJob = require('./jobs/elimination.job');

const app    = express();
const server = http.createServer(app);                // wrap express in http server for socket.io
const io     = new Server(server, {
  cors: { origin: '*' }                               // allow all origins in dev
});

// ── Global: make io accessible in all modules ────────────────
app.set('io', io);
eliminationJob.setIo(io);

// ── Middlewares ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SpinWheel API is running 🎡',
    timestamp: new Date().toISOString()
  });
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',  require('./modules/auth/auth.routes'));
app.use('/api/coins', require('./modules/coins/coins.routes'));
app.use('/api/wheel', require('./modules/wheel/wheel.routes'));
app.use('/api/admin', require('./modules/admin/admin.routes'));
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
    // Test DB connection on startup
    await getPool();

    // Test Redis connection on startup
    await getRedis();

    server.listen(PORT, () => {
      console.log(`\n🎡 SpinWheel API running on http://localhost:${PORT}`);
      console.log(`📡 Socket.io ready`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);  // crash fast if DB/Redis not available
  }
}

start();
