const coinsService = require('./coins.service');

/**
 * GET /api/coins/balance
 * Get my own coin balance
 */
async function getMyBalance(req, res) {
  try {
    const user = await coinsService.getBalance(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        userId:      user.id,
        username:    user.username,
        coinBalance: parseFloat(user.coin_balance)
      }
    });

  } catch (err) {
    console.error('Get balance error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get balance' });
  }
}

/**
 * GET /api/coins/balance/:userId
 * Admin gets any user's balance
 */
async function getUserBalance(req, res) {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const user = await coinsService.getBalance(userId);

    return res.status(200).json({
      success: true,
      data: {
        userId:      user.id,
        username:    user.username,
        coinBalance: parseFloat(user.coin_balance)
      }
    });

  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('Get user balance error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get balance' });
  }
}

/**
 * POST /api/coins/credit
 * Admin credits coins to a user
 * Body: { userId, amount, description? }
 */
async function creditCoins(req, res) {
  try {
    const { userId, amount, description } = req.body;

    // ── Validate ───────────────────────────────────────────
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Max credit per operation (safety limit)
    if (parsedAmount > 1000000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum credit per operation is 1,000,000 coins'
      });
    }

    const result = await coinsService.adminCredit(
      req.user.id,
      parseInt(userId),
      parsedAmount,
      description
    );

    return res.status(200).json({
      success: true,
      message: `Successfully credited ${parsedAmount} coins to ${result.username}`,
      data: result
    });

  } catch (err) {
    if (err.message === 'Target user not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message === 'Amount must be greater than 0') {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Credit coins error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to credit coins' });
  }
}

/**
 * POST /api/coins/debit
 * Admin debits coins from a user
 * Body: { userId, amount, description? }
 */
async function debitCoins(req, res) {
  try {
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const result = await coinsService.adminDebit(
      req.user.id,
      parseInt(userId),
      parsedAmount,
      description
    );

    return res.status(200).json({
      success: true,
      message: `Successfully debited ${parsedAmount} coins from ${result.username}`,
      data: result
    });

  } catch (err) {
    if (err.message === 'Target user not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (err.message.startsWith('Insufficient balance')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Debit coins error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to debit coins' });
  }
}

/**
 * GET /api/coins/transactions
 * Get my transaction history (paginated)
 * Query: ?page=1&limit=20
 */
async function getMyTransactions(req, res) {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'page must be >= 1 and limit must be between 1 and 100'
      });
    }

    const result = await coinsService.getTransactionHistory(req.user.id, page, limit);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('Get transactions error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get transactions' });
  }
}

/**
 * GET /api/coins/transactions/:userId
 * Admin gets any user's transaction history
 */
async function getUserTransactions(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const result = await coinsService.getTransactionHistory(userId, page, limit);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('Get user transactions error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get transactions' });
  }
}

module.exports = {
  getMyBalance,
  getUserBalance,
  creditCoins,
  debitCoins,
  getMyTransactions,
  getUserTransactions
};
