/**
 * Middleware: ensure logged-in user has admin role.
 * Must be used AFTER auth middleware.
 *
 * Usage in routes:
 *   router.post('/create', auth, isAdmin, controller)
 */
function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.'
    });
  }

  next();
}

module.exports = isAdmin;
