const { getPool, sql } = require('../../config/db');

/**
 * Get coin balance for a user
 * @param {number} userId
 */
async function getBalance(userId) {
  const pool = await getPool();

  const result = await pool.request()
    .input('id', sql.Int, userId)
    .query(`
      SELECT id, username, coin_balance
      FROM users
      WHERE id = @id AND is_active = 1
    `);

  const user = result.recordset[0];
  if (!user) throw new Error('User not found');

  return user;
}

/**
 * Admin credits coins to any user
 * Records transaction in DB
 *
 * @param {number} adminId      - who is doing the crediting
 * @param {number} targetUserId - who receives the coins
 * @param {number} amount       - how many coins
 * @param {string} description  - reason
 */
async function adminCredit(adminId, targetUserId, amount, description = 'Admin credit') {
  const pool = await getPool();

  // ── Validate amount ────────────────────────────────────────
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  // ── Check target user exists ───────────────────────────────
  const userResult = await pool.request()
    .input('id', sql.Int, targetUserId)
    .query(`SELECT id, username, coin_balance FROM users WHERE id = @id AND is_active = 1`);

  const targetUser = userResult.recordset[0];
  if (!targetUser) throw new Error('Target user not found');

  const balanceBefore = parseFloat(targetUser.coin_balance);
  const balanceAfter  = balanceBefore + parseFloat(amount);

  // ── Begin transaction ──────────────────────────────────────
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Credit user balance
    await transaction.request()
      .input('amount', sql.Decimal(18, 2), amount)
      .input('id',     sql.Int,            targetUserId)
      .query(`
        UPDATE users
        SET coin_balance = coin_balance + @amount,
            updated_at   = GETUTCDATE()
        WHERE id = @id
      `);

    // 2. Record transaction
    await transaction.request()
      .input('user_id',        sql.Int,          targetUserId)
      .input('type',           sql.NVarChar,     'manual_credit')
      .input('amount',         sql.Decimal(18,2), amount)
      .input('balance_before', sql.Decimal(18,2), balanceBefore)
      .input('balance_after',  sql.Decimal(18,2), balanceAfter)
      .input('description',    sql.NVarChar,     `${description} (by admin #${adminId})`)
      .query(`
        INSERT INTO transactions
          (user_id, type, amount, balance_before, balance_after, description)
        VALUES
          (@user_id, @type, @amount, @balance_before, @balance_after, @description)
      `);

    await transaction.commit();

    return {
      userId:        targetUserId,
      username:      targetUser.username,
      amountCredited: amount,
      balanceBefore,
      balanceAfter
    };

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Admin debits coins from a user
 *
 * @param {number} adminId
 * @param {number} targetUserId
 * @param {number} amount
 * @param {string} description
 */
async function adminDebit(adminId, targetUserId, amount, description = 'Admin debit') {
  const pool = await getPool();

  if (amount <= 0) throw new Error('Amount must be greater than 0');

  // ── Get target user with lock ──────────────────────────────
  const userResult = await pool.request()
    .input('id', sql.Int, targetUserId)
    .query(`SELECT id, username, coin_balance FROM users WHERE id = @id AND is_active = 1`);

  const targetUser = userResult.recordset[0];
  if (!targetUser) throw new Error('Target user not found');

  const balanceBefore = parseFloat(targetUser.coin_balance);

  // ── Check sufficient balance ───────────────────────────────
  if (balanceBefore < amount) {
    throw new Error(`Insufficient balance. User has ${balanceBefore} coins, tried to debit ${amount}`);
  }

  const balanceAfter = balanceBefore - parseFloat(amount);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await transaction.request()
      .input('amount', sql.Decimal(18,2), amount)
      .input('id',     sql.Int,           targetUserId)
      .query(`
        UPDATE users
        SET coin_balance = coin_balance - @amount,
            updated_at   = GETUTCDATE()
        WHERE id = @id
      `);

    await transaction.request()
      .input('user_id',        sql.Int,           targetUserId)
      .input('type',           sql.NVarChar,      'manual_debit')
      .input('amount',         sql.Decimal(18,2), amount)
      .input('balance_before', sql.Decimal(18,2), balanceBefore)
      .input('balance_after',  sql.Decimal(18,2), balanceAfter)
      .input('description',    sql.NVarChar,      `${description} (by admin #${adminId})`)
      .query(`
        INSERT INTO transactions
          (user_id, type, amount, balance_before, balance_after, description)
        VALUES
          (@user_id, @type, @amount, @balance_before, @balance_after, @description)
      `);

    await transaction.commit();

    return {
      userId:       targetUserId,
      username:     targetUser.username,
      amountDebited: amount,
      balanceBefore,
      balanceAfter
    };

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get transaction history for a user
 * @param {number} userId
 * @param {number} page
 * @param {number} limit
 */
async function getTransactionHistory(userId, page = 1, limit = 20) {
  const pool   = await getPool();
  const offset = (page - 1) * limit;

  const result = await pool.request()
    .input('user_id', sql.Int, userId)
    .input('limit',   sql.Int, limit)
    .input('offset',  sql.Int, offset)
    .query(`
      SELECT
        t.id,
        t.type,
        t.amount,
        t.balance_before,
        t.balance_after,
        t.description,
        t.spin_wheel_id,
        t.created_at
      FROM transactions t
      WHERE t.user_id = @user_id
      ORDER BY t.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

  // Total count for pagination
  const countResult = await pool.request()
    .input('user_id', sql.Int, userId)
    .query(`SELECT COUNT(*) AS total FROM transactions WHERE user_id = @user_id`);

  const total = countResult.recordset[0].total;

  return {
    transactions: result.recordset,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Validate user has enough coins
 * Reusable helper used by wheel module
 *
 * @param {number} userId
 * @param {number} requiredAmount
 * @returns {number} current balance
 */
async function validateBalance(userId, requiredAmount) {
  const pool = await getPool();

  const result = await pool.request()
    .input('id', sql.Int, userId)
    .query(`SELECT coin_balance FROM users WHERE id = @id AND is_active = 1`);

  const user = result.recordset[0];
  if (!user) throw new Error('User not found');

  const balance = parseFloat(user.coin_balance);
  if (balance < requiredAmount) {
    throw new Error(`Insufficient coins. You have ${balance}, need ${requiredAmount}`);
  }

  return balance;
}

module.exports = {
  getBalance,
  adminCredit,
  adminDebit,
  getTransactionHistory,
  validateBalance
};
