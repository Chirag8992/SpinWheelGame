const router     = require('express').Router();
const controller = require('./admin.controller');
const auth       = require('../../middleware/auth');
const isAdmin    = require('../../middleware/isAdmin');

// All admin routes require auth + admin role
router.use(auth, isAdmin);

// ── Dashboard ─────────────────────────────────────────────────
// GET  /api/admin/dashboard
router.get('/dashboard',              controller.getDashboard);

// ── Coin Config ───────────────────────────────────────────────
// GET  /api/admin/config
router.get('/config',                 controller.getConfig);
// PUT  /api/admin/config
router.put('/config',                 controller.updateConfig);

// ── System Settings ───────────────────────────────────────────
// GET  /api/admin/settings
router.get('/settings',               controller.getSettings);
// PUT  /api/admin/settings
router.put('/settings',               controller.updateSettings);

// ── User Management ───────────────────────────────────────────
// GET  /api/admin/users?page=1&limit=20&search=
router.get('/users',                  controller.getAllUsers);
// PATCH /api/admin/users/:userId/toggle
router.patch('/users/:userId/toggle', controller.toggleUserStatus);

// ── Analytics ─────────────────────────────────────────────────
// GET  /api/admin/analytics?days=7
router.get('/analytics',              controller.getAnalytics);

module.exports = router;
