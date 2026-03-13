const adminService = require('./admin.service');

/**
 * GET /api/admin/dashboard
 * Full stats overview
 */
async function getDashboard(req, res) {
  try {
    const stats = await adminService.getDashboardStats();
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard' });
  }
}

/**
 * GET /api/admin/config
 * Get current coin distribution config
 */
async function getConfig(req, res) {
  try {
    const config = await adminService.getConfig();
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No active config found. Please create one.'
      });
    }
    return res.status(200).json({ success: true, data: config });
  } catch (err) {
    console.error('Get config error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get config' });
  }
}

/**
 * PUT /api/admin/config
 * Update coin distribution percentages
 * Body: { winnerPercent, adminPercent, appPercent }
 */
async function updateConfig(req, res) {
  try {
    const { winnerPercent, adminPercent, appPercent } = req.body;

    if (winnerPercent === undefined || adminPercent === undefined || appPercent === undefined) {
      return res.status(400).json({
        success: false,
        message: 'winnerPercent, adminPercent and appPercent are all required'
      });
    }

    const config = await adminService.updateConfig(
      req.user.id,
      parseFloat(winnerPercent),
      parseFloat(adminPercent),
      parseFloat(appPercent)
    );

    return res.status(200).json({
      success: true,
      message: 'Config updated successfully',
      data:    config
    });

  } catch (err) {
    if (err.message.includes('sum to 100') || err.message.includes('must be')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Update config error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update config' });
  }
}

/**
 * GET /api/admin/settings
 * Get system settings
 */
async function getSettings(req, res) {
  try {
    const settings = await adminService.getSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (err) {
    console.error('Get settings error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get settings' });
  }
}

/**
 * PUT /api/admin/settings
 * Update system settings
 * Body: { auto_start_seconds, elimination_interval_seconds, min_participants }
 */
async function updateSettings(req, res) {
  try {
    const settings = await adminService.updateSettings(req.user.id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data:    settings
    });

  } catch (err) {
    if (err.message.includes('must be')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Update settings error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
}

/**
 * GET /api/admin/users
 * List all users with optional search
 * Query: ?page=1&limit=20&search=username
 */
async function getAllUsers(req, res) {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const result = await adminService.getAllUsers(page, limit, search);
    return res.status(200).json({ success: true, data: result });

  } catch (err) {
    console.error('Get users error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get users' });
  }
}

/**
 * PATCH /api/admin/users/:userId/toggle
 * Enable or disable a user account
 */
async function toggleUserStatus(req, res) {
  try {
    const targetUserId = parseInt(req.params.userId);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await adminService.toggleUserStatus(req.user.id, targetUserId);

    return res.status(200).json({
      success: true,
      message: `User ${user.username} has been ${user.is_active ? 'enabled' : 'disabled'}`,
      data:    user
    });

  } catch (err) {
    if (err.message.includes('Cannot disable') || err.message === 'User not found') {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Toggle user error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to toggle user status' });
  }
}

/**
 * GET /api/admin/analytics
 * Game analytics for last N days
 * Query: ?days=7
 */
async function getAnalytics(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;

    if (days < 1 || days > 365) {
      return res.status(400).json({ success: false, message: 'days must be between 1 and 365' });
    }

    const analytics = await adminService.getAnalytics(days);
    return res.status(200).json({ success: true, data: analytics });

  } catch (err) {
    console.error('Analytics error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get analytics' });
  }
}

module.exports = {
  getDashboard,
  getConfig,
  updateConfig,
  getSettings,
  updateSettings,
  getAllUsers,
  toggleUserStatus,
  getAnalytics
};
