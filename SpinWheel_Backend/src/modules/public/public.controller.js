const publicService = require('./public.service');

/**
 * GET /api/public/leaderboard?limit=10
 * Public leaderboard data
 */
async function getLeaderboard(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const topWinners = await publicService.getLeaderboard(limit);
    return res.status(200).json({
      success: true,
      data: { topWinners }
    });
  } catch (err) {
    console.error('Leaderboard error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load leaderboard',
      ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
  }
}

module.exports = { getLeaderboard };
