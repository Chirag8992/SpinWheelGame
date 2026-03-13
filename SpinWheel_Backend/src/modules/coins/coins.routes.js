const router     = require('express').Router();
const controller = require('./coins.controller');
const auth       = require('../../middleware/auth');
const isAdmin    = require('../../middleware/isAdmin');

// ── All coin routes require login ────────────────────────────

// GET  /api/coins/balance             → my balance
router.get('/balance',                  auth,          controller.getMyBalance);

// GET  /api/coins/balance/:userId     → any user's balance (admin only)
router.get('/balance/:userId',          auth, isAdmin, controller.getUserBalance);

// POST /api/coins/credit              → admin credits coins to user
router.post('/credit',                  auth, isAdmin, controller.creditCoins);

// POST /api/coins/debit               → admin debits coins from user
router.post('/debit',                   auth, isAdmin, controller.debitCoins);

// GET  /api/coins/transactions        → my transaction history
router.get('/transactions',             auth,          controller.getMyTransactions);

// GET  /api/coins/transactions/:userId → any user's transactions (admin only)
router.get('/transactions/:userId',     auth, isAdmin, controller.getUserTransactions);

module.exports = router;
