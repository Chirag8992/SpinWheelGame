const sql = require('mssql');

// ── DB Config ────────────────────────────────────────────────
const dbConfig = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt:              process.env.DB_ENCRYPT === 'true',  // true for Azure
    trustServerCertificate: true,                             // for local dev
    enableArithAbort:     true,
  },
  pool: {
    max:               10,   // max connections in pool
    min:               2,    // keep 2 alive always
    idleTimeoutMillis: 30000 // close idle connections after 30s
  }
};

// ── Singleton Pool ───────────────────────────────────────────
let pool = null;

/**
 * Returns the shared connection pool.
 * Creates it on first call, reuses after.
 */
async function getPool() {
  if (pool) return pool;

  try {
    pool = await sql.connect(dbConfig);
    console.log('✅ MSSQL connected successfully');

    // Log if connection drops
    pool.on('error', (err) => {
      console.error('❌ MSSQL pool error:', err.message);
      pool = null; // force reconnect on next call
    });

    return pool;
  } catch (err) {
    console.error('❌ MSSQL connection failed:', err.message);
    throw err;
  }
}

/**
 * Quick helper — run a query without manually getting the pool
 * Usage: const result = await query`SELECT * FROM users WHERE id = ${userId}`
 */
async function query(strings, ...values) {
  const db = await getPool();
  const request = db.request();

  // Build parameterized query from template literal
  let queryStr = '';
  strings.forEach((str, i) => {
    queryStr += str;
    if (i < values.length) {
      const paramName = `p${i}`;
      request.input(paramName, values[i]);
      queryStr += `@${paramName}`;
    }
  });

  return request.query(queryStr);
}

module.exports = { getPool, query, sql };
