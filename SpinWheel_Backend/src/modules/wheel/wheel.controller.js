const wheelService   = require('./wheel.service');
const eliminationJob = require('../../jobs/elimination.job');

/**
 * POST /api/wheel/create
 * Admin creates a new spin wheel
 * Body: { entryFee }
 */
async function createWheel(req, res) {
  try {
    const { entryFee } = req.body;

    if (!entryFee) {
      return res.status(400).json({ success: false, message: 'entryFee is required' });
    }

    const parsedFee = parseFloat(entryFee);
    if (isNaN(parsedFee) || parsedFee <= 0) {
      return res.status(400).json({ success: false, message: 'entryFee must be a positive number' });
    }

    const result = await wheelService.createWheel(req.user.id, parsedFee);

    // ── Schedule auto-start/abort job ─────────────────────
    await eliminationJob.scheduleAutoStart(result.wheel.id, result.wheel.auto_start_at);

    // ── Notify all connected clients ───────────────────────
    const io = req.app.get('io');
    io.emit('wheel_created', {
      wheelId:      result.wheel.id,
      entryFee:     parsedFee,
      autoStartAt:  result.wheel.auto_start_at,
      config:       result.config,
      createdBy:    req.user.username,
      settings:     result.settings
    });

    return res.status(201).json({
      success: true,
      message: 'Spin wheel created successfully',
      data:    result
    });

  } catch (err) {
    if (err.message.includes('already') || err.message.includes('config')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Create wheel error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create wheel' });
  }
}

/**
 * POST /api/wheel/join
 * User joins the active waiting wheel
 * Body: { wheelId }
 */
async function joinWheel(req, res) {
  try {
    const { wheelId } = req.body;

    if (!wheelId) {
      return res.status(400).json({ success: false, message: 'wheelId is required' });
    }

    const result = await wheelService.joinWheel(req.user.id, parseInt(wheelId));

    // ── Notify room of new participant ─────────────────────
    const io = req.app.get('io');
    io.to(`wheel_${wheelId}`).emit('player_joined', {
      wheelId,
      username:     req.user.username,
      winnerPool:   result.wheel.winner_pool,
      adminPool:    result.wheel.admin_pool,
      totalPlayers: result.participants.length
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully joined the wheel',
      data:    result
    });

  } catch (err) {
    const clientErrors = [
      'Wheel not found',
      'Cannot join',
      'already joined',
      'Insufficient coins',
      'Request in progress'
    ];
    if (clientErrors.some(e => err.message.includes(e))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Join wheel error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to join wheel' });
  }
}

/**
 * POST /api/wheel/start
 * Admin manually starts the wheel
 * Body: { wheelId }
 */
async function startWheel(req, res) {
  try {
    const { wheelId } = req.body;

    if (!wheelId) {
      return res.status(400).json({ success: false, message: 'wheelId is required' });
    }

    const result = await wheelService.startWheel(req.user.id, parseInt(wheelId));

    // ── Start elimination job ──────────────────────────────
    await eliminationJob.startElimination(
      parseInt(wheelId),
      result.eliminationSequence,
      result.eliminationIntervalSeconds
    );

    // ── Notify all players in the room ────────────────────
    const io = req.app.get('io');
    io.to(`wheel_${wheelId}`).emit('wheel_started', {
      wheelId,
      participantCount: result.participantCount,
      message:          'The wheel is spinning! Eliminations begin now.'
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        wheelId,
        participantCount: result.participantCount
      }
    });

  } catch (err) {
    const clientErrors = ['Wheel not found', 'Cannot start', 'Need at least'];
    if (clientErrors.some(e => err.message.includes(e))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Start wheel error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to start wheel' });
  }
}

/**
 * POST /api/wheel/abort
 * Admin manually aborts a waiting wheel
 * Body: { wheelId }
 */
async function abortWheel(req, res) {
  try {
    const { wheelId } = req.body;

    if (!wheelId) {
      return res.status(400).json({ success: false, message: 'wheelId is required' });
    }

    const result = await wheelService.abortWheel(req.user.id, parseInt(wheelId));

    // ── Cancel auto-start job ──────────────────────────────
    await eliminationJob.cancelAutoStart(parseInt(wheelId));

    // ── Notify everyone ────────────────────────────────────
    const io = req.app.get('io');
    io.to(`wheel_${wheelId}`).emit('game_aborted', {
      wheelId,
      message: 'Game aborted by admin. Entry fees have been refunded.'
    });

    return res.status(200).json({
      success: true,
      message: result.message
    });

  } catch (err) {
    const clientErrors = ['Wheel not found', 'Only waiting'];
    if (clientErrors.some(e => err.message.includes(e))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Abort wheel error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to abort wheel' });
  }
}

/**
 * GET /api/wheel/active
 * Get current active or waiting wheel with participants
 */
async function getActiveWheel(req, res) {
  try {
    const result = await wheelService.getActiveWheelWithParticipants();

    if (!result) {
      return res.status(200).json({
        success: true,
        message: 'No active wheel at the moment',
        data:    null
      });
    }

    return res.status(200).json({
      success: true,
      data:    result
    });

  } catch (err) {
    console.error('Get active wheel error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get active wheel' });
  }
}

/**
 * GET /api/wheel/:wheelId
 * Get a specific wheel by ID
 */
async function getWheelById(req, res) {
  try {
    const wheelId = parseInt(req.params.wheelId);
    if (isNaN(wheelId)) {
      return res.status(400).json({ success: false, message: 'Invalid wheel ID' });
    }

    const wheel        = await wheelService.getWheelById(wheelId);
    const participants = await wheelService.getParticipants(wheelId);

    if (!wheel) {
      return res.status(404).json({ success: false, message: 'Wheel not found' });
    }

    return res.status(200).json({
      success: true,
      data:    { wheel, participants }
    });

  } catch (err) {
    console.error('Get wheel error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get wheel' });
  }
}

/**
 * GET /api/wheel/history
 * Get past wheels (paginated)
 * Query: ?page=1&limit=10
 */
async function getWheelHistory(req, res) {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await wheelService.getWheelHistory(page, limit);

    return res.status(200).json({
      success: true,
      data:    result
    });

  } catch (err) {
    console.error('Get wheel history error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get wheel history' });
  }
}

module.exports = {
  createWheel,
  joinWheel,
  startWheel,
  abortWheel,
  getActiveWheel,
  getWheelById,
  getWheelHistory
};
