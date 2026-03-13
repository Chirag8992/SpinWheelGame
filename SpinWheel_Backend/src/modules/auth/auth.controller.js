const authService = require('./auth.service');

/**
 * POST /api/auth/register
 * Body: { username, email, password, role? }
 */
async function register(req, res) {
  try {
    const { username, email, password, role } = req.body;

    // ── Validate required fields ───────────────────────────
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'username, email and password are required'
      });
    }

    // ── Validate username length ───────────────────────────
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 50 characters'
      });
    }

    // ── Validate email format ──────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // ── Validate password strength ─────────────────────────
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // ── Only allow role 'user' from public register ────────
    // Admins are created manually or via a secret key
    const safeRole = role === 'admin' ? 'user' : (role || 'user');

    const { user, token } = await authService.register(
      username, email, password, safeRole
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user, token }
    });

  } catch (err) {
    // Known business errors
    if (err.message === 'Username or email already taken') {
      return res.status(409).json({ success: false, message: err.message });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

/**
 * POST /api/auth/register-admin
 * Body: { username, email, password, adminSecret }
 * Protected by a secret key so only authorized people can create admins
 */
async function registerAdmin(req, res) {
  try {
    const { username, email, password, adminSecret } = req.body;

    // Validate admin secret
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: `Invalid admin secret ${adminSecret} and ${process.env.ADMIN_SECRET}`
      });
    }

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'username, email and password are required'
      });
    }

    const { user, token } = await authService.register(
      username, email, password, 'admin'
    );

    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      data: { user, token }
    });

  } catch (err) {
    if (err.message === 'Username or email already taken') {
      return res.status(409).json({ success: false, message: err.message });
    }
    console.error('Admin register error:', err.message);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'username and password are required'
      });
    }

    const { user, token } = await authService.login(username, password);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, token }
    });

  } catch (err) {
    if (err.message === 'Invalid username or password') {
      return res.status(401).json({ success: false, message: err.message });
    }
    if (err.message === 'Account is disabled. Contact support.') {
      return res.status(403).json({ success: false, message: err.message });
    }
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
}

/**
 * GET /api/auth/me
 * Returns logged-in user's profile
 */
async function getMe(req, res) {
  try {
    const user = await authService.getProfile(req.user.id);

    return res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('Get profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
}

module.exports = { register, registerAdmin, login, getMe };
