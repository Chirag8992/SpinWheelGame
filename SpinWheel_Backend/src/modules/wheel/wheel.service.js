const { getPool, sql } = require('../../config/db');
const { acquireLock, releaseLock } = require('../../config/redis');

const DEFAULT_SETTINGS = {
  auto_start_seconds: 180,
  elimination_interval_seconds: 7,
  min_participants: 3
};

async function getSystemSettings(pool) {
  try {
    const result = await pool.request().query(`
      SELECT TOP 1
        auto_start_seconds,
        elimination_interval_seconds,
        min_participants
      FROM system_settings
      ORDER BY id DESC
    `);
    const row = result.recordset[0];
    if (!row) return DEFAULT_SETTINGS;
    return {
      auto_start_seconds:           parseInt(row.auto_start_seconds, 10) || DEFAULT_SETTINGS.auto_start_seconds,
      elimination_interval_seconds: parseInt(row.elimination_interval_seconds, 10) || DEFAULT_SETTINGS.elimination_interval_seconds,
      min_participants:             parseInt(row.min_participants, 10) || DEFAULT_SETTINGS.min_participants
    };
  } catch (err) {
    if (err.message && err.message.includes('system_settings')) {
      return DEFAULT_SETTINGS;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Get the active coin distribution config from DB
 */
async function getActiveConfig(pool) {
  const result = await pool.request().query(`
    SELECT TOP 1 id, winner_percent, admin_percent, app_percent
    FROM coin_distribution_config
    WHERE is_active = 1
    ORDER BY created_at DESC
  `);
  if (!result.recordset[0]) throw new Error('No active coin distribution config found. Ask admin to set one up.');
  return result.recordset[0];
}

/**
 * Get active or waiting wheel (there can only be one)
 */
async function getActiveWheel(pool) {
  const result = await pool.request().query(`
    SELECT TOP 1
      sw.*,
      u.username AS created_by_username
    FROM spin_wheels sw
    INNER JOIN users u ON u.id = sw.created_by
    WHERE sw.status IN ('waiting', 'active')
  `);
  return result.recordset[0] || null;
}

// ─────────────────────────────────────────────────────────────
// 1. CREATE WHEEL  (admin only)
// ─────────────────────────────────────────────────────────────
async function createWheel(adminId, entryFee) {
  const pool = await getPool();
  const settings = await getSystemSettings(pool);
  // const settings = await getSystemSettings(pool);

  if (!entryFee || entryFee <= 0) throw new Error('Entry fee must be greater than 0');

  // ── Check no active wheel already exists ───────────────────
  const existing = await getActiveWheel(pool);
  if (existing) {
    throw new Error(`A wheel is already ${existing.status}. Only one active wheel allowed at a time.`);
  }

  // ── Get active config ──────────────────────────────────────
  const config = await getActiveConfig(pool);

  // ── auto_start_at = now + configured seconds ──────────────
  const autoStartAt = new Date(Date.now() + settings.auto_start_seconds * 1000);

  const result = await pool.request()
    .input('created_by',   sql.Int,          adminId)
    .input('entry_fee',    sql.Decimal(18,2), entryFee)
    .input('config_id',    sql.Int,          config.id)
    .input('auto_start_at',sql.DateTime2,    autoStartAt)
    .query(`
      INSERT INTO spin_wheels
        (created_by, entry_fee, status, config_id, auto_start_at)
      OUTPUT
        INSERTED.id, INSERTED.entry_fee, INSERTED.status,
        INSERTED.winner_pool, INSERTED.admin_pool, INSERTED.app_pool,
        INSERTED.auto_start_at, INSERTED.created_at
      VALUES
        (@created_by, @entry_fee, 'waiting', @config_id, @auto_start_at)
    `);

  return {
    wheel: result.recordset[0],
    config: {
      winnerPercent: config.winner_percent,
      adminPercent:  config.admin_percent,
      appPercent:    config.app_percent
    },
    settings
  };
}

// ─────────────────────────────────────────────────────────────
// 2. JOIN WHEEL
// ─────────────────────────────────────────────────────────────
async function joinWheel(userId, wheelId) {
  const pool = await getPool();

  // ── Distributed lock: prevent concurrent joins causing race conditions ──
  const lockKey = `lock:join:wheel:${wheelId}:user:${userId}`;
  const locked  = await acquireLock(lockKey, 5000);
  if (!locked) throw new Error('Request in progress, please try again');

  try {
    // ── 1. Verify wheel exists and is waiting ──────────────
    const wheelResult = await pool.request()
      .input('id', sql.Int, wheelId)
      .query(`
        SELECT sw.*, cdc.winner_percent, cdc.admin_percent, cdc.app_percent
        FROM spin_wheels sw
        INNER JOIN coin_distribution_config cdc ON cdc.id = sw.config_id
        WHERE sw.id = @id
      `);

    const wheel = wheelResult.recordset[0];
    if (!wheel)                    throw new Error('Wheel not found');
    if (wheel.status !== 'waiting') throw new Error(`Cannot join. Wheel is ${wheel.status}`);

    // ── 2. Check user not already in this wheel ────────────
    const alreadyJoined = await pool.request()
      .input('wheel_id', sql.Int, wheelId)
      .input('user_id',  sql.Int, userId)
      .query(`
        SELECT id FROM spin_wheel_participants
        WHERE spin_wheel_id = @wheel_id AND user_id = @user_id
      `);

    if (alreadyJoined.recordset.length > 0) {
      throw new Error('You have already joined this wheel');
    }

    // ── 3. Call atomic stored procedure ───────────────────
    await pool.request()
      .input('spin_wheel_id', sql.Int,          wheelId)
      .input('user_id',       sql.Int,          userId)
      .input('entry_fee',     sql.Decimal(18,2), parseFloat(wheel.entry_fee))
      .input('winner_pct',    sql.Decimal(5,2),  parseFloat(wheel.winner_percent))
      .input('admin_pct',     sql.Decimal(5,2),  parseFloat(wheel.admin_percent))
      .input('app_pct',       sql.Decimal(5,2),  parseFloat(wheel.app_percent))
      .execute('sp_join_spin_wheel');

    // ── 4. Get updated wheel state to return ──────────────
    const updatedWheel = await getWheelById(wheelId);
    const participants = await getParticipants(wheelId);

    return { wheel: updatedWheel, participants };

  } finally {
    await releaseLock(lockKey); // always release lock
  }
}

// ─────────────────────────────────────────────────────────────
// 3. START WHEEL  (admin manual start)
// ─────────────────────────────────────────────────────────────
async function startWheel(adminId, wheelId) {
  const pool = await getPool();
  const settings = await getSystemSettings(pool);

  // ── 1. Get wheel ───────────────────────────────────────────
  const wheelResult = await pool.request()
    .input('id', sql.Int, wheelId)
    .query(`SELECT * FROM spin_wheels WHERE id = @id`);

  const wheel = wheelResult.recordset[0];
  if (!wheel)                     throw new Error('Wheel not found');
  if (wheel.status !== 'waiting') throw new Error(`Cannot start. Wheel is already ${wheel.status}`);

  // ── 2. Check min participants ──────────────────────────────
  const countResult = await pool.request()
    .input('wheel_id', sql.Int, wheelId)
    .query(`
      SELECT COUNT(*) AS total
      FROM spin_wheel_participants
      WHERE spin_wheel_id = @wheel_id AND status = 'active'
    `);

  const participantCount = countResult.recordset[0].total;
  if (participantCount < settings.min_participants) {
    throw new Error(`Need at least ${settings.min_participants} participants to start. Currently have ${participantCount}.`);
  }

  // ── 3. Generate random elimination sequence ────────────────
  const participantsResult = await pool.request()
    .input('wheel_id', sql.Int, wheelId)
    .query(`
      SELECT user_id FROM spin_wheel_participants
      WHERE spin_wheel_id = @wheel_id AND status = 'active'
    `);

  const userIds = participantsResult.recordset.map(r => r.user_id);
  const eliminationSequence = shuffle(userIds);   // random order
  // Last one in sequence = winner (never eliminated)
  eliminationSequence.pop();

  // ── 4. Update wheel status to active ──────────────────────
  await pool.request()
    .input('id', sql.Int, wheelId)
    .query(`
      UPDATE spin_wheels
      SET status     = 'active',
          started_at = GETUTCDATE(),
          updated_at = GETUTCDATE()
      WHERE id = @id
    `);

  return {
    wheelId,
    participantCount,
    eliminationSequence, // returned so job can use it
    message: 'Wheel started successfully',
    eliminationIntervalSeconds: settings.elimination_interval_seconds,
    minParticipants: settings.min_participants
  };
}

// ─────────────────────────────────────────────────────────────
// 4. AUTO-START CHECK  (called by Bull job at auto_start_at)
// ─────────────────────────────────────────────────────────────
async function autoStartOrAbort(wheelId) {
  const pool = await getPool();

  const wheelResult = await pool.request()
    .input('id', sql.Int, wheelId)
    .query(`SELECT * FROM spin_wheels WHERE id = @id`);

  const wheel = wheelResult.recordset[0];
  if (!wheel || wheel.status !== 'waiting') return { action: 'skipped' };

  // Count active participants
  const countResult = await pool.request()
    .input('wheel_id', sql.Int, wheelId)
    .query(`
      SELECT COUNT(*) AS total FROM spin_wheel_participants
      WHERE spin_wheel_id = @wheel_id AND status = 'active'
    `);

  const count = countResult.recordset[0].total;

  if (count < settings.min_participants) {
    // ── Not enough players → abort and refund ─────────────
    await pool.request()
      .input('spin_wheel_id', sql.Int, wheelId)
      .execute('sp_abort_and_refund');

    return { action: 'aborted', participantCount: count, minParticipants: settings.min_participants };
  } else {
    // ── Enough players → start automatically ──────────────
    const result = await startWheel(null, wheelId);
    return { action: 'started', ...result };
  }
}

// ─────────────────────────────────────────────────────────────
// 5. ABORT WHEEL  (admin manual abort)
// ─────────────────────────────────────────────────────────────
async function abortWheel(adminId, wheelId) {
  const pool = await getPool();

  const wheelResult = await pool.request()
    .input('id', sql.Int, wheelId)
    .query(`SELECT status FROM spin_wheels WHERE id = @id`);

  const wheel = wheelResult.recordset[0];
  if (!wheel)                     throw new Error('Wheel not found');
  if (wheel.status !== 'waiting') throw new Error('Only waiting wheels can be aborted');

  await pool.request()
    .input('spin_wheel_id', sql.Int, wheelId)
    .execute('sp_abort_and_refund');

  return { wheelId, message: 'Wheel aborted and all participants refunded' };
}

// ─────────────────────────────────────────────────────────────
// 6. GET WHEEL INFO
// ─────────────────────────────────────────────────────────────
async function getWheelById(wheelId) {
  const pool = await getPool();

  const result = await pool.request()
    .input('id', sql.Int, wheelId)
    .query(`
      SELECT
        sw.id, sw.status, sw.entry_fee,
        sw.winner_pool, sw.admin_pool, sw.app_pool,
        sw.auto_start_at, sw.started_at, sw.finished_at,
        sw.created_at,
        u.username  AS created_by_username,
        w.username  AS winner_username,
        cdc.winner_percent, cdc.admin_percent, cdc.app_percent
      FROM spin_wheels sw
      INNER JOIN users u   ON u.id  = sw.created_by
      LEFT  JOIN users w   ON w.id  = sw.winner_user_id
      INNER JOIN coin_distribution_config cdc ON cdc.id = sw.config_id
      WHERE sw.id = @id
    `);

  return result.recordset[0] || null;
}

async function getActiveWheelWithParticipants() {
  const pool  = await getPool();
  const wheel = await getActiveWheel(pool);
  if (!wheel) return null;

  const participants = await getParticipants(wheel.id);
  const settings = await getSystemSettings(pool);
  return { wheel, participants, settings };
}

async function getParticipants(wheelId) {
  const pool = await getPool();

  const result = await pool.request()
    .input('wheel_id', sql.Int, wheelId)
    .query(`
      SELECT
        p.id, p.status, p.entry_fee_paid,
        p.elimination_order, p.eliminated_at, p.joined_at,
        u.username
      FROM spin_wheel_participants p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.spin_wheel_id = @wheel_id
      ORDER BY p.joined_at ASC
    `);

  return result.recordset;
}

async function getWheelHistory(page = 1, limit = 10) {
  const pool   = await getPool();
  const offset = (page - 1) * limit;

  const result = await pool.request()
    .input('limit',  sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT
        sw.id, sw.status, sw.entry_fee,
        sw.winner_pool, sw.admin_pool, sw.app_pool,
        sw.started_at, sw.finished_at, sw.created_at,
        u.username AS created_by_username,
        w.username AS winner_username
      FROM spin_wheels sw
      INNER JOIN users u  ON u.id = sw.created_by
      LEFT  JOIN users w  ON w.id = sw.winner_user_id
      ORDER BY sw.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const countResult = await pool.request()
    .query(`SELECT COUNT(*) AS total FROM spin_wheels`);

  return {
    wheels: result.recordset,
    pagination: {
      page, limit,
      total:      countResult.recordset[0].total,
      totalPages: Math.ceil(countResult.recordset[0].total / limit)
    }
  };
}

// ─────────────────────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = {
  createWheel,
  joinWheel,
  startWheel,
  autoStartOrAbort,
  abortWheel,
  getWheelById,
  getActiveWheelWithParticipants,
  getParticipants,
  getWheelHistory
};
