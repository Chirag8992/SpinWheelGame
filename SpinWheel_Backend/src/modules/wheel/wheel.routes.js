const router     = require('express').Router();
const controller = require('./wheel.controller');
const auth       = require('../../middleware/auth');
const isAdmin    = require('../../middleware/isAdmin');

// ── Public info ──────────────────────────────────────────────
// GET  /api/wheel/active          → current wheel + participants
router.get('/active',              auth,          controller.getActiveWheel);

// GET  /api/wheel/history         → past wheels paginated
router.get('/history',             auth,          controller.getWheelHistory);

// GET  /api/wheel/:wheelId        → specific wheel details
router.get('/:wheelId',            auth,          controller.getWheelById);

// ── User actions ─────────────────────────────────────────────
// POST /api/wheel/join            → pay entry fee and join
router.post('/join',               auth,          controller.joinWheel);

// ── Admin actions ────────────────────────────────────────────
// POST /api/wheel/create          → create new wheel
router.post('/create',             auth, isAdmin, controller.createWheel);

// POST /api/wheel/start           → manually start wheel
router.post('/start',              auth, isAdmin, controller.startWheel);

// POST /api/wheel/abort           → abort and refund all
router.post('/abort',              auth, isAdmin, controller.abortWheel);

module.exports = router;
