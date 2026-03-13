const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { getPool, sql } = require('../../config/db');

/**
 * Register a new user
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @param {string} role - 'user' | 'admin'
 */
async function register(username, email, password, role = 'user') {
  const pool = await getPool();

  // ── 1. Check username / email already exists ───────────────
  const existing = await pool.request()
    .input('username', sql.NVarChar, username)
    .input('email',    sql.NVarChar, email)
    .query(`
      SELECT id FROM users
      WHERE username = @username OR email = @email
    `);

  if (existing.recordset.length > 0) {
    throw new Error('Username or email already taken');
  }

  // ── 2. Hash password ───────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, 12);

  // ── 3. Welcome bonus amount (configurable via .env) ────────
  const WELCOME_COINS = parseFloat(process.env.WELCOME_COINS || '1000');

  // ── 4. Insert user + credit welcome coins atomically ───────
  const transaction = pool.transaction();
  await transaction.begin();

  try {
    // Insert the user
    const userResult = await transaction.request()
      .input('username',      sql.NVarChar,  username)
      .input('email',         sql.NVarChar,  email)
      .input('password_hash', sql.NVarChar,  passwordHash)
      .input('role',          sql.NVarChar,  role)
      .query(`
        INSERT INTO users (username, email, password_hash, role)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.email,
               INSERTED.role, INSERTED.coin_balance, INSERTED.created_at
        VALUES (@username, @email, @password_hash, @role)
      `);

    const user = userResult.recordset[0];

    // Credit welcome coins directly on the balance
    await transaction.request()
      .input('userId',       sql.Int,     user.id)
      .input('welcomeCoins', sql.Decimal(18, 2), WELCOME_COINS)
      .query(`
        UPDATE users
        SET coin_balance = coin_balance + @welcomeCoins
        WHERE id = @userId
      `);

    // Record the welcome bonus in transactions table for audit trail
    await transaction.request()
      .input('userId',      sql.Int,          user.id)
      .input('type',        sql.NVarChar,     'manual_credit')
      .input('amount',      sql.Decimal(18,2), WELCOME_COINS)
      .input('balBefore',   sql.Decimal(18,2), 0)
      .input('balAfter',    sql.Decimal(18,2), WELCOME_COINS)
      .input('description', sql.NVarChar,     'Welcome bonus coins')
      .query(`
        INSERT INTO transactions
          (user_id, type, amount, balance_before, balance_after, description)
        VALUES
          (@userId, @type, @amount, @balBefore, @balAfter, @description)
      `);

    await transaction.commit();

    // Return user with updated balance
    user.coin_balance = WELCOME_COINS;

    // ── 5. Generate JWT ──────────────────────────────────────
    const token = generateToken(user);

    return { user, token };

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Login existing user
 * @param {string} username
 * @param {string} password
 */
async function login(username, password) {
  const pool = await getPool();

  // ── 1. Find user ───────────────────────────────────────────
  const result = await pool.request()
    .input('username', sql.NVarChar, username)
    .query(`
      SELECT id, username, email, password_hash, role,
             coin_balance, is_active
      FROM users
      WHERE username = @username
    `);

  const user = result.recordset[0];

  if (!user) {
    throw new Error('Invalid username or password');
  }

  // ── 2. Check account active ────────────────────────────────
  if (!user.is_active) {
    throw new Error('Account is disabled. Contact support.');
  }

  // ── 3. Verify password ─────────────────────────────────────
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid username or password');
  }

  // ── 4. Generate JWT ────────────────────────────────────────
  const token = generateToken(user);

  // Remove sensitive field before returning
  delete user.password_hash;

  return { user, token };
}

/**
 * Get user profile by ID
 * @param {number} userId
 */
async function getProfile(userId) {
  const pool = await getPool();

  const result = await pool.request()
    .input('id', sql.Int, userId)
    .query(`
      SELECT id, username, email, role, coin_balance, created_at
      FROM users
      WHERE id = @id AND is_active = 1
    `);

  const user = result.recordset[0];
  if (!user) throw new Error('User not found');

  return user;
}

// ── Helper ────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { register, login, getProfile };