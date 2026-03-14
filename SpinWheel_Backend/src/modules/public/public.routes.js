const express = require('express');
const controller = require('./public.controller');

const router = express.Router();

// GET /api/public/leaderboard?limit=10
router.get('/leaderboard', controller.getLeaderboard);

module.exports = router;
