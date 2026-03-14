const Bull             = require('bull');
const { getPool, sql } = require('../config/db');
const { acquireLock, releaseLock } = require('../config/redis');

const redisOpts = {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379
  }
};

const autoStartQueue   = new Bull('auto-start-queue',  redisOpts);
const eliminationQueue = new Bull('elimination-queue', redisOpts);

let _io = null;
function setIo(io) { _io = io; }

let _winnersAmountCol = null;
async function getWinnersAmountColumn(pool) {
  if (_winnersAmountCol !== null) return _winnersAmountCol;

  const result = await pool.request().query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'winners'
  `);
  const cols = new Set(result.recordset.map(r => String(r.COLUMN_NAME).toLowerCase()));
  const candidates = [
    'winning_amount',
    'amount_won',
    'amount',
    'winning_coins',
    'prize_amount'
  ];
  _winnersAmountCol = candidates.find(c => cols.has(c)) || null;
  return _winnersAmountCol;
}

// ── Schedule auto-start ───────────────────────────────────────
async function scheduleAutoStart(wheelId, autoStartAt) {
  const delay = new Date(autoStartAt).getTime() - Date.now();
  if (delay <= 0) return;
  await autoStartQueue.add(
    { wheelId },
    { delay, jobId: `autostart:${wheelId}`, attempts: 1 }
  );
  console.log(`⏰ Auto-start scheduled for wheel #${wheelId} in ${Math.round(delay/1000)}s`);
}

// ── Cancel auto-start ─────────────────────────────────────────
async function cancelAutoStart(wheelId) {
  const job = await autoStartQueue.getJob(`autostart:${wheelId}`);
  if (job) { await job.remove(); console.log(`🚫 Auto-start cancelled for wheel #${wheelId}`); }
}

// ── Queue elimination jobs ────────────────────────────────────
async function startElimination(wheelId, eliminationSequence, intervalSeconds = 7) {
  const safeSeconds = Math.max(1, parseInt(intervalSeconds, 10) || 7);
  const INTERVAL_MS = safeSeconds * 1000;
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
        attempts: 3,
        backoff:  { type: 'fixed', delay: 1000 }
      }
    );
  }
  console.log(`⚡ Elimination sequence started for wheel #${wheelId} — ${eliminationSequence.length} jobs queued`);
}

// ── Auto-start processor ──────────────────────────────────────
autoStartQueue.process(async (job) => {
  const { wheelId } = job.data;
  console.log(`⏰ Auto-start firing for wheel #${wheelId}`);
  const wheelService = require('../modules/wheel/wheel.service');
  try {
    const result = await wheelService.autoStartOrAbort(wheelId);
    if (result.action === 'aborted') {
      const minParticipants = result.minParticipants || 3;
      console.log(`❌ Wheel #${wheelId} aborted — only ${result.participantCount} players`);
      if (_io) _io.to(`wheel_${wheelId}`).emit('game_aborted', {
        wheelId,
        message: `Not enough players (${result.participantCount}/${minParticipants}). Entry fees refunded.`
      });
    }
    if (result.action === 'started') {
      console.log(`✅ Wheel #${wheelId} auto-started with ${result.participantCount} players`);
      if (_io) _io.to(`wheel_${wheelId}`).emit('wheel_started', {
        wheelId,
        participantCount: result.participantCount,
        message: 'Wheel auto-started! Eliminations begin now.'
      });
      await startElimination(wheelId, result.eliminationSequence, result.eliminationIntervalSeconds);
    }
  } catch (err) {
    console.error(`Auto-start error for wheel #${wheelId}:`, err.message);
  }
});

// ── Elimination processor ─────────────────────────────────────
eliminationQueue.process(async (job) => {
  const { wheelId, userId, eliminationOrder, isLast } = job.data;

  const lockKey = `lock:elim:${wheelId}:${eliminationOrder}`;
  const locked  = await acquireLock(lockKey, 10000);
  if (!locked) {
    console.warn(`⚠️  Elimination #${eliminationOrder} for wheel #${wheelId} already processing`);
    return;
  }

  try {
    const pool = await getPool();

    // Verify wheel still active
    const wheelResult = await pool.request()
      .input('id', sql.Int, wheelId)
      .query(`SELECT status FROM spin_wheels WHERE id = @id`);

    if (!wheelResult.recordset[0] || wheelResult.recordset[0].status !== 'active') {
      console.log(`Wheel #${wheelId} no longer active, skipping elimination #${eliminationOrder}`);
      return;
    }

    // Eliminate the player
    await pool.request()
      .input('wheel_id',          sql.Int, wheelId)
      .input('user_id',           sql.Int, userId)
      .input('elimination_order', sql.Int, eliminationOrder)
      .query(`
        UPDATE spin_wheel_participants
        SET status            = 'eliminated',
            eliminated_at     = GETUTCDATE(),
            elimination_order = @elimination_order
        WHERE spin_wheel_id = @wheel_id AND user_id = @user_id
      `);

    // Count remaining
    const remainingResult = await pool.request()
      .input('wheel_id', sql.Int, wheelId)
      .query(`
        SELECT COUNT(*) AS remaining
        FROM spin_wheel_participants
        WHERE spin_wheel_id = @wheel_id AND status = 'active'
      `);
    const remaining = remainingResult.recordset[0].remaining;

    // Log elimination
    await pool.request()
      .input('wheel_id',          sql.Int, wheelId)
      .input('user_id',           sql.Int, userId)
      .input('elimination_order', sql.Int, eliminationOrder)
      .input('remaining',         sql.Int, remaining)
      .query(`
        INSERT INTO elimination_log (spin_wheel_id, eliminated_user_id, elimination_order, remaining_players)
        VALUES (@wheel_id, @user_id, @elimination_order, @remaining)
      `);

    // Get username
    const userResult = await pool.request()
      .input('id', sql.Int, userId)
      .query(`SELECT username FROM users WHERE id = @id`);
    const username = userResult.recordset[0]?.username || 'Unknown';

    console.log(`💀 Eliminated: ${username} from wheel #${wheelId} (${remaining} remaining)`);

    // Emit player_eliminated
    if (_io) {
      _io.to(`wheel_${wheelId}`).emit('player_eliminated', {
        wheelId,
        eliminatedUserId:   userId,
        eliminatedUsername: username,
        eliminationOrder,
        remainingPlayers:   remaining
      });
    }

    // ── Last elimination → declare winner ─────────────────
    if (isLast) {
      console.log(`🏆 Last elimination done for wheel #${wheelId}, declaring winner...`);
      try {
        await declareWinner(wheelId);
      } catch (winnerErr) {
        // Log the REAL error so you can see it in backend console
        console.error(`❌ declareWinner FAILED for wheel #${wheelId}:`, winnerErr.message, winnerErr.stack);

        // Still emit game_over so frontend is not stuck forever
        if (_io) {
          // Try to at least find who the remaining player is
          try {
            const pool2 = await getPool();
            const fallback = await pool2.request()
              .input('wheel_id', sql.Int, wheelId)
              .query(`
                SELECT u.username
                FROM spin_wheel_participants p
                INNER JOIN users u ON u.id = p.user_id
                WHERE p.spin_wheel_id = @wheel_id AND p.status = 'active'
              `);
            const fallbackWinner = fallback.recordset[0]?.username || 'Unknown';
            _io.to(`wheel_${wheelId}`).emit('game_over', {
              wheelId,
              winnerUserId:   null,
              winnerUsername: fallbackWinner,
              amountWon:      0,
              message:        `${fallbackWinner} wins! (payout error — contact admin)`
            });
          } catch (e2) {
            _io.to(`wheel_${wheelId}`).emit('game_over', {
              wheelId, winnerUserId: null, winnerUsername: 'Unknown', amountWon: 0,
              message: 'Game over (error — contact admin)'
            });
          }
        }
      }
    }

  } catch (err) {
    console.error(`❌ Elimination job error wheel #${wheelId} order #${eliminationOrder}:`, err.message);
    throw err; // rethrow so Bull retries
  } finally {
    await releaseLock(lockKey);
  }
});

// ── Declare winner ────────────────────────────────────────────
async function declareWinner(wheelId) {
  const pool = await getPool();

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
  if (!winner) throw new Error(`No active participant found to be winner in wheel #${wheelId}`);

  console.log(`🏆 Winner found: ${winner.username} for wheel #${wheelId}, paying out ${winner.winner_pool} coins`);

  // Atomic payout stored procedure
  await pool.request()
    .input('spin_wheel_id',  sql.Int, wheelId)
    .input('winner_user_id', sql.Int, winner.user_id)
    .input('admin_user_id',  sql.Int, winner.created_by)
    .execute('sp_payout_winner');

  // Insert into winners table (supports multiple legacy column names)
  const amountCol = await getWinnersAmountColumn(pool);
  if (amountCol) {
    const insertSql = `
      INSERT INTO winners (spin_wheel_id, user_id, ${amountCol})
      VALUES (@spin_wheel_id, @user_id, @winning_amount)
    `;
    await pool.request()
      .input('spin_wheel_id',  sql.Int,           wheelId)
      .input('user_id',        sql.Int,           winner.user_id)
      .input('winning_amount', sql.Decimal(18,2), parseFloat(winner.winner_pool))
      .query(insertSql);
  } else {
    console.warn('Winners table has no known amount column; skipping winners insert');
  }

  console.log(`✅ Payout complete: ${winner.username} received ${winner.winner_pool} coins`);

  // Emit game_over to all clients
  if (_io) {
    _io.to(`wheel_${wheelId}`).emit('game_over', {
      wheelId,
      winnerUserId:   winner.user_id,
      winnerUsername: winner.username,
      amountWon:      parseFloat(winner.winner_pool),
      message:        `🏆 ${winner.username} wins ${winner.winner_pool} coins!`
    });
    console.log(`📡 game_over emitted to room wheel_${wheelId}`);
  } else {
    console.error(`❌ _io is null — game_over NOT emitted for wheel #${wheelId}!`);
  }
}

autoStartQueue.on('failed',   (job, err) => console.error(`Auto-start job failed:`, err.message));
eliminationQueue.on('failed', (job, err) => console.error(`Elimination job failed [wheel #${job.data.wheelId}]:`, err.message));

module.exports = { setIo, scheduleAutoStart, cancelAutoStart, startElimination };
