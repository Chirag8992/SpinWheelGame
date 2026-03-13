const { getPool, sql } = require('../../config/db');

// ─────────────────────────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────────────────────────
async function getDashboardStats() {
  const pool = await getPool();

  // Run all stat queries in parallel for speed
  const [
    userStats,
    wheelStats,
    coinStats,
    recentWheels,
    activeWheel
  ] = await Promise.all([

    // User stats
    pool.request().query(`
      SELECT
        COUNT(*)                            AS total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins,
        SUM(CASE WHEN is_active = 1   THEN 1 ELSE 0 END) AS active_users,
        SUM(coin_balance)                   AS total_coins_in_circulation
      FROM users
    `),

    // Wheel stats
    pool.request().query(`
      SELECT
        COUNT(*)                                              AS total_wheels,
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS completed_wheels,
        SUM(CASE WHEN status = 'aborted'  THEN 1 ELSE 0 END) AS aborted_wheels,
        SUM(CASE WHEN status IN ('waiting','active') THEN 1 ELSE 0 END) AS active_wheels
      FROM spin_wheels
    `),

    // Coin flow stats
    pool.request().query(`
      SELECT
        SUM(CASE WHEN type = 'entry_fee_debit'    THEN amount ELSE 0 END) AS total_entry_fees_collected,
        SUM(CASE WHEN type = 'winner_pool_credit' THEN amount ELSE 0 END) AS total_paid_to_winners,
        SUM(CASE WHEN type = 'admin_pool_credit'  THEN amount ELSE 0 END) AS total_admin_earnings,
        SUM(CASE WHEN type = 'app_pool_credit'    THEN amount ELSE 0 END) AS total_app_earnings,
        SUM(CASE WHEN type = 'refund_credit'      THEN amount ELSE 0 END) AS total_refunds_issued,
        COUNT(*)                                                           AS total_transactions
      FROM transactions
    `),

    // Recent 5 wheels
    pool.request().query(`
      SELECT TOP 5
        sw.id, sw.status, sw.entry_fee,
        sw.winner_pool, sw.admin_pool,
        sw.started_at, sw.finished_at, sw.created_at,
        creator.username AS created_by,
        winner.username  AS winner
      FROM spin_wheels sw
      INNER JOIN users creator ON creator.id = sw.created_by
      LEFT  JOIN users winner  ON winner.id  = sw.winner_user_id
      ORDER BY sw.created_at DESC
    `),

    // Currently active wheel
    pool.request().query(`
      SELECT TOP 1
        sw.id, sw.status, sw.entry_fee,
        sw.winner_pool, sw.admin_pool, sw.app_pool,
        sw.auto_start_at, sw.started_at,
        COUNT(p.id) AS participant_count
      FROM spin_wheels sw
      LEFT JOIN spin_wheel_participants p
        ON p.spin_wheel_id = sw.id AND p.status = 'active'
      WHERE sw.status IN ('waiting', 'active')
      GROUP BY sw.id, sw.status, sw.entry_fee,
               sw.winner_pool, sw.admin_pool, sw.app_pool,
               sw.auto_start_at, sw.started_at
    `)
  ]);

  return {
    users:        userStats.recordset[0],
    wheels:       wheelStats.recordset[0],
    coins:        coinStats.recordset[0],
    recentWheels: recentWheels.recordset,
    activeWheel:  activeWheel.recordset[0] || null
  };
}

// ─────────────────────────────────────────────────────────────
// COIN DISTRIBUTION CONFIG
// ─────────────────────────────────────────────────────────────
async function getConfig() {
  const pool = await getPool();

  const result = await pool.request().query(`
    SELECT TOP 1
      id, winner_percent, admin_percent, app_percent,
      is_active, created_at
    FROM coin_distribution_config
    WHERE is_active = 1
    ORDER BY created_at DESC
  `);

  return result.recordset[0] || null;
}

async function updateConfig(adminId, winnerPercent, adminPercent, appPercent) {
  const pool = await getPool();

  // Validate percents sum to 100
  const total = parseFloat(winnerPercent) + parseFloat(adminPercent) + parseFloat(appPercent);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100. Got ${total}`);
  }

  if (winnerPercent <= 0 || adminPercent < 0 || appPercent < 0) {
    throw new Error('winner_percent must be > 0, others must be >= 0');
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // Deactivate current config
    await transaction.request().query(`
      UPDATE coin_distribution_config SET is_active = 0 WHERE is_active = 1
    `);

    // Insert new active config
    const result = await transaction.request()
      .input('winner_percent', sql.Decimal(5,2), winnerPercent)
      .input('admin_percent',  sql.Decimal(5,2), adminPercent)
      .input('app_percent',    sql.Decimal(5,2), appPercent)
      .input('created_by',     sql.Int,          adminId)
      .query(`
        INSERT INTO coin_distribution_config
          (winner_percent, admin_percent, app_percent, is_active, created_by)
        OUTPUT INSERTED.*
        VALUES (@winner_percent, @admin_percent, @app_percent, 1, @created_by)
      `);

    await transaction.commit();
    return result.recordset[0];

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// SYSTEM SETTINGS
// ─────────────────────────────────────────────────────────────
async function getSettings() {
  const pool = await getPool();

  const result = await pool.request().query(`
    SELECT TOP 1 * FROM system_settings ORDER BY id DESC
  `);

  // Return defaults if no settings exist yet
  return result.recordset[0] || {
    auto_start_seconds:           180,
    elimination_interval_seconds: 7,
    min_participants:             3
  };
}

async function updateSettings(adminId, settings) {
  const pool = await getPool();

  const {
    auto_start_seconds           = 180,
    elimination_interval_seconds = 7,
    min_participants             = 3
  } = settings;

  // Validate
  if (auto_start_seconds < 30)            throw new Error('auto_start_seconds must be >= 30');
  if (elimination_interval_seconds < 3)   throw new Error('elimination_interval_seconds must be >= 3');
  if (min_participants < 2)               throw new Error('min_participants must be >= 2');

  // Check if settings row exists
  const existing = await pool.request().query(`SELECT TOP 1 id FROM system_settings`);

  if (existing.recordset.length > 0) {
    await pool.request()
      .input('auto_start_seconds',           sql.Int, auto_start_seconds)
      .input('elimination_interval_seconds', sql.Int, elimination_interval_seconds)
      .input('min_participants',             sql.Int, min_participants)
      .query(`
        UPDATE system_settings
        SET auto_start_seconds           = @auto_start_seconds,
            elimination_interval_seconds = @elimination_interval_seconds,
            min_participants             = @min_participants
      `);
  } else {
    await pool.request()
      .input('auto_start_seconds',           sql.Int, auto_start_seconds)
      .input('elimination_interval_seconds', sql.Int, elimination_interval_seconds)
      .input('min_participants',             sql.Int, min_participants)
      .query(`
        INSERT INTO system_settings
          (auto_start_seconds, elimination_interval_seconds, min_participants)
        VALUES
          (@auto_start_seconds, @elimination_interval_seconds, @min_participants)
      `);
  }

  return { auto_start_seconds, elimination_interval_seconds, min_participants };
}

// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────
async function getAllUsers(page = 1, limit = 20, search = '') {
  const pool   = await getPool();
  const offset = (page - 1) * limit;

  const result = await pool.request()
    .input('search', sql.NVarChar, `%${search}%`)
    .input('limit',  sql.Int,      limit)
    .input('offset', sql.Int,      offset)
    .query(`
      SELECT
        id, username, email, role,
        coin_balance, is_active, created_at
      FROM users
      WHERE username LIKE @search OR email LIKE @search
      ORDER BY created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const countResult = await pool.request()
    .input('search', sql.NVarChar, `%${search}%`)
    .query(`
      SELECT COUNT(*) AS total FROM users
      WHERE username LIKE @search OR email LIKE @search
    `);

  return {
    users: result.recordset,
    pagination: {
      page, limit,
      total:      countResult.recordset[0].total,
      totalPages: Math.ceil(countResult.recordset[0].total / limit)
    }
  };
}

async function toggleUserStatus(adminId, targetUserId) {
  const pool = await getPool();

  // Can't disable yourself
  if (adminId === targetUserId) throw new Error('Cannot disable your own account');

  const result = await pool.request()
    .input('id', sql.Int, targetUserId)
    .query(`
      UPDATE users
      SET is_active  = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
          updated_at = GETUTCDATE()
      OUTPUT INSERTED.id, INSERTED.username, INSERTED.is_active
      WHERE id = @id
    `);

  const user = result.recordset[0];
  if (!user) throw new Error('User not found');

  return user;
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────
async function getAnalytics(days = 7) {
  const pool = await getPool();

  const [dailyWheels, topWinners, recentTransactions] = await Promise.all([

    // Wheels per day (last N days)
    pool.request()
      .input('days', sql.Int, days)
      .query(`
        SELECT
          CAST(created_at AS DATE)                              AS date,
          COUNT(*)                                              AS total_wheels,
          SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'aborted'  THEN 1 ELSE 0 END) AS aborted,
          SUM(winner_pool + admin_pool + app_pool)              AS total_coins_wagered
        FROM spin_wheels
        WHERE created_at >= DATEADD(DAY, -@days, GETUTCDATE())
        GROUP BY CAST(created_at AS DATE)
        ORDER BY date DESC
      `),

    // Top 10 winners all time
    pool.request().query(`
      SELECT TOP 10
        u.username,
        COUNT(w.id)    AS total_wins,
        SUM(w.winning_amount) AS total_won
      FROM winners w
      INNER JOIN users u ON u.id = w.user_id
      GROUP BY u.id, u.username
      ORDER BY total_won DESC
    `),

    // Last 20 transactions across all users
    pool.request().query(`
      SELECT TOP 20
        t.id, t.type, t.amount,
        t.balance_before, t.balance_after,
        t.description, t.created_at,
        u.username,
        t.spin_wheel_id
      FROM transactions t
      INNER JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC
    `)
  ]);

  return {
    dailyWheels:         dailyWheels.recordset,
    topWinners:          topWinners.recordset,
    recentTransactions:  recentTransactions.recordset
  };
}

module.exports = {
  getDashboardStats,
  getConfig,
  updateConfig,
  getSettings,
  updateSettings,
  getAllUsers,
  toggleUserStatus,
  getAnalytics
};
