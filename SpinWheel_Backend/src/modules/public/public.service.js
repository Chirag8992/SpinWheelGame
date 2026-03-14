const { getPool, sql } = require('../../config/db');

async function getLeaderboard(limit = 10) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const pool = await getPool();

  const result = await pool.request()
    .input('limit', sql.Int, safeLimit)
    .query(`
      SELECT TOP (@limit)
        u.username,
        COUNT(*)              AS total_wins,
        ISNULL(SUM(t.amount), 0) AS total_won
      FROM transactions t
      INNER JOIN users u ON u.id = t.user_id
      WHERE t.type = 'winner_pool_credit'
      GROUP BY u.id, u.username
      ORDER BY total_won DESC, total_wins DESC
    `);

  return result.recordset;
}

module.exports = { getLeaderboard };
