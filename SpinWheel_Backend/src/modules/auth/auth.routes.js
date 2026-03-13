const router     = require('express').Router();
const controller = require('./auth.controller');
const auth       = require('../../middleware/auth');

// ── Public routes (no token needed) ─────────────────────────
// POST /api/auth/register
router.post('/register',       controller.register);

// POST /api/auth/register-admin  (requires ADMIN_SECRET in body)
router.post('/register-admin', controller.registerAdmin);

// POST /api/auth/login
router.post('/login',          controller.login);

// ── Protected routes (token required) ───────────────────────
// GET /api/auth/me
router.get('/me', auth, controller.getMe);

module.exports = router;
    