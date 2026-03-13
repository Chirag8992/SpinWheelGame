const Bull           = require('bull');
const { getPool, sql } = require('../config/db');
const { acquireLock, releaseLock } = require('../config/redis');

// ─────────────────────────────────────────────────────────────
// QUEUES
// Two separate Bull queues:
//   1. autoStartQueue  → fires once at auto_start_at time
//   2. eliminationQueue → fires every 7 seconds during game
// ─────────────────────────────────────────────────────────────
const redisOpts = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379
  }
};

const autoStartQueue   = new Bull('auto-start-queue',   redisOpts);
const eliminationQueue = new Bull('elimination-queue',  redisOpts);

// ── Will be set from app.js after io is ready ────────────────
let _io = null;
function setIo(io) { _io = io; }

// ─────────────────────────────────────────────────────────────
// SCHEDULE AUTO-START  (called when wheel is created)
// Fires once at auto_start_at time
// ─────────────────────────────────────────────────────────────
async function scheduleAutoStart(wheelId, autoStartAt) {
  const delay = new Date(autoStartAt).getTime() - Date.now();
  if (delay <= 0) return; // already past time

  await autoStartQueue.add(
    { wheelId },
    {
      delay,
      jobId:    `autostart:${wheelId}`,   // named so we can cancel it later
      attempts: 1
    }
  );

  console.log(`⏰ Auto-start scheduled for wheel #${wheelId} in ${Math.round(delay / 1000)}s`);
}

// ─────────────────────────────────────────────────────────────
// CANCEL AUTO-START  (called when admin manually starts/aborts)
// ─────────────────────────────────────────────────────────────
async function cancelAutoStart(wheelId) {
  const job = await autoStartQueue.getJob(`autostart:${wheelId}`);
  if (job) {
    await job.remove();
    console.log(`🚫 Auto-start cancelled for wheel #${wheelId}`);
  }
}

// ─────────────────────────────────────────────────────────────
// START ELIMINATION  (called when wheel starts)
// Adds elimination jobs every 7 seconds
// ─────────────────────────────────────────────────────────────
async function startElimination(wheelId, eliminationSequence) {
  const INTERVAL_MS = 7000; // 7 seconds per elimination

  // Schedule one job per elimination in sequence
  for (let i = 0; i < eliminationSequence.length; i++) {
    await eliminationQueue.add(
      {
        wheelId,
        userId:           eliminationSequence[i],
        eliminationOrder: i + 1,
        isLast:           i === eliminationSequence.length - 1
      },
      {
        delay:    (i + 1) * INTERVAL_MS,
        jobId:    `elim:${wheelId}:${i + 1}`,
        attempts: 3,          // retry up to 3 times on failure
        backoff:  { type: 'fixed', delay: 1000 }
      }
    );
  }

  console.log(`⚡ Elimination sequence started for wheel #${wheelId} — ${eliminationSequence.length} eliminations queued`);
}

// ─────────────────────────────────────────────────────────────
// AUTO-START QUEUE PROCESSOR
// ─────────────────────────────────────────────────────────────
autoStartQueue.process(async (job) => {
  const { wheelId } = job.data;
  console.log(`⏰ Auto-start firing for wheel #${wheelId}`);

  // Lazy load to avoid circular dependency
  const wheelService = require('../modules/wheel/wheel.service');

  try {
    const result = await wheelService.autoStartOrAbort(wheelId);

    if (result.action === 'aborted') {
      console.log(`❌ Wheel #${wheelId} aborted — only ${result.participantCount} players`);
      if (_io) {
        _io.to(`wheel_${wheelId}`).emit('game_aborted', {
          wheelId,
          message: `Not enough players (${result.participantCount}/3). Game aborted and entry fees refunded.`
        });
      }
    }

    if (result.action === 'started') {
      console.log(`✅ Wheel #${wheelId} auto-started with ${result.participantCount} players`);
      if (_io) {
        _io.to(`wheel_${wheelId}`).emit('wheel_started', {
          wheelId,
          participantCount: result.participantCount,
          message:          'Wheel auto-started! Eliminations begin now.'
        });
      }
      // Kick off eliminations
      await startElimination(wheelId, result.eliminationSequence);
    }

  } catch (err) {
    console.error(`Auto-start error for wheel #${wheelId}:`, err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// ELIMINATION QUEUE PROCESSOR
// ─────────────────────────────────────────────────────────────
eliminationQueue.process(async (job) => {
  const { wheelId, userId, eliminationOrder, isLast } = job.data;

  // ── Distributed lock: prevent duplicate eliminations ──────
  const lockKey = `lock:elim:${wheelId}:${eliminationOrder}`;
  const locked  = await acquireLock(lockKey, 10000);
  if (!locked) {
    console.warn(`⚠️  Elimination #${eliminationOrder} for wheel #${wheelId} already processing`);
    return;
  }

  try {
    const pool = await getPool();

    // ── Verify wheel is still active ──────────────────────
    const wheelResult = await pool.request()
      .input('id', sql.Int, wheelId)
      .query(`SELECT status FROM spin_wheels WHERE id = @id`);

    if (!wheelResult.recordset[0] || wheelResult.recordset[0].status !== 'active') {
      console.log(`Wheel #${wheelId} no longer active, skipping elimination`);
      return;
    }

    // ── Eliminate the player ───────────────────────────────
    await pool.request()
      .input('wheel_id',         sql.Int,      wheelId)
      .input('user_id',          sql.Int,      userId)
      .input('elimination_order',sql.Int,      eliminationOrder)
      .query(`
        UPDATE spin_wheel_participants
        SET status            = 'eliminated',
            eliminated_at     = GETUTCDATE(),
            elimination_order = @elimination_order
        WHERE spin_wheel_id = @wheel_id AND user_id = @user_id
      `);

    // ── Log the elimination ────────────────────────────────
    const remainingResult = await pool.request()
      .input('wheel_id', sql.Int, wheelId)
      .query(`
        SELECT COUNT(*) AS remaining
        FROM spin_wheel_participants
        WHERE spin_wheel_id = @wheel_id AND status = 'active'
      `);

    const remaining = remainingResult.recordset[0].remaining;

    await pool.request()
      .input('wheel_id',         sql.Int, wheelId)
      .input('user_id',          sql.Int, userId)
      .input('elimination_order',sql.Int, eliminationOrder)
      .input('remaining',        sql.Int, remaining)
      .query(`
        INSERT INTO elimination_log
          (spin_wheel_id, eliminated_user_id, elimination_order, remaining_players)
        VALUES
          (@wheel_id, @user_id, @elimination_order, @remaining)
      `);

    // ── Get username for socket event ──────────────────────
    const userResult = await pool.request()
      .input('id', sql.Int, userId)
      .query(`SELECT username FROM users WHERE id = @id`);

    const username = userResult.recordset[0]?.username || 'Unknown';

    console.log(`💀 Eliminated: ${username} from wheel #${wheelId} (${remaining} remaining)`);

    // ── Emit to all clients in the room ───────────────────
    if (_io) {
      _io.to(`wheel_${wheelId}`).emit('player_eliminated', {
        wheelId,
        eliminatedUserId:   userId,
        eliminatedUsername: username,
        eliminationOrder,
        remainingPlayers:   remaining
      });
    }

    // ── If this was the last elimination → find winner ─────
    if (isLast) {
      await declareWinner(wheelId);
    }

  } finally {
    await releaseLock(lockKey);
  }
});

// ─────────────────────────────────────────────────────────────
// DECLARE WINNER
// ─────────────────────────────────────────────────────────────
async function declareWinner(wheelId) {
  const pool = await getPool();

  // ── Find the last active participant ──────────────────────
  const winnerResult = await pool.request()
    .input('wheel_id', sql.Int, wheelId)
    .query(`
      SELECT p.user_id, u.username, sw.created_by, sw.winner_pool, sw.admin_pool
      FROM spin_wheel_participants p
      INNER JOIN users u        ON u.id  = p.user_id
      INNER JOIN spin_wheels sw ON sw.id = p.spin_wheel_id
      WHERE p.spin_wheel_id = @wheel_id AND p.status = 'active'
    `);

  const winner = winnerResult.recordset[0];
  if (!winner) {
    console.error(`No winner found for wheel #${wheelId}`);
    return;
  }

  // ── Atomic payout ─────────────────────────────────────────
  await pool.request()
    .input('spin_wheel_id',  sql.Int, wheelId)
    .input('winner_user_id', sql.Int, winner.user_id)
    .input('admin_user_id',  sql.Int, winner.created_by)
    .execute('sp_payout_winner');

  // ── Insert into winners table ──────────────────────────────
  await pool.request()
    .input('spin_wheel_id', sql.Int,          wheelId)
    .input('user_id',       sql.Int,          winner.user_id)
    .input('winning_amount',sql.Decimal(18,2), parseFloat(winner.winner_pool))
    .query(`
      INSERT INTO winners (spin_wheel_id, user_id, winning_amount)
      VALUES (@spin_wheel_id, @user_id, @winning_amount)
    `);

  console.log(`🏆 Winner: ${winner.username} won ${winner.winner_pool} coins from wheel #${wheelId}`);

  // ── Emit game over event ───────────────────────────────────
  if (_io) {
    _io.to(`wheel_${wheelId}`).emit('game_over', {
      wheelId,
      winnerUserId:   winner.user_id,
      winnerUsername: winner.username,
      amountWon:      parseFloat(winner.winner_pool),
      message:        `🏆 ${winner.username} wins ${winner.winner_pool} coins!`
    });
  }
}

// ─────────────────────────────────────────────────────────────
// ERROR HANDLERS for queues
// ─────────────────────────────────────────────────────────────
autoStartQueue.on('failed',   (job, err) => console.error(`Auto-start job failed:`, err.message));
eliminationQueue.on('failed', (job, err) => console.error(`Elimination job failed [wheel #${job.data.wheelId}]:`, err.message));

module.exports = {
  setIo,
  scheduleAutoStart,
  cancelAutoStart,
  startElimination
};
