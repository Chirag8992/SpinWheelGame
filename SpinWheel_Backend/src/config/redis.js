const { createClient } = require('redis');

let client = null;

/**
 * Returns the shared Redis client.
 * Creates and connects on first call, reuses after.
 */
async function getRedis() {
  if (client && client.isOpen) return client;

  client = createClient({
    socket: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
    // password: process.env.REDIS_PASSWORD, // uncomment if needed
  });

  client.on('error',  (err) => console.error('❌ Redis error:',     err.message));
  client.on('connect',()    => console.log('✅ Redis connected successfully'));

  await client.connect();
  return client;
}

/**
 * Acquire a distributed lock.
 * Prevents two servers from running the same operation simultaneously.
 *
 * @param {string} key   - lock name e.g. 'lock:wheel:42'
 * @param {number} ttlMs - auto-expire after this many ms (safety net)
 * @returns {boolean}      true if lock acquired, false if already locked
 */
async function acquireLock(key, ttlMs = 10000) {
  const redis = await getRedis();
  // NX = only set if NOT exists | PX = expiry in milliseconds
  const result = await redis.set(key, '1', { NX: true, PX: ttlMs });
  return result === 'OK';
}

/**
 * Release a distributed lock.
 */
async function releaseLock(key) {
  const redis = await getRedis();
  await redis.del(key);
}

module.exports = { getRedis, acquireLock, releaseLock };
