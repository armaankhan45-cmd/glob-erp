const jwt = require('jsonwebtoken');
const config = require('../config/env');

function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, msg: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, msg: 'Token expired' });
    }
    return res.status(401).json({ success: false, msg: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, msg: 'Admin access required' });
  }
  next();
}

module.exports = { auth, adminOnly };
