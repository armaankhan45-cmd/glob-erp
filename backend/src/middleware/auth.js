const jwt = require('jsonwebtoken');
const config = require('../config/env');
const getDb = require('../config/db');

// 30s cache so deleting/demoting a user takes effect fast without a DB hit on every request
const liveUsers = new Map();
function invalidateUser(id) { if (id === undefined) liveUsers.clear(); else liveUsers.delete(Number(id)); }
async function lookupUser(id) {
  const hit = liveUsers.get(id);
  if (hit && Date.now() - hit.at < 30000) return hit.row;
  const row = await getDb()('users').where({ id }).select('id', 'role', 'organization_id').first();
  liveUsers.set(id, { row: row || null, at: Date.now() });
  return row || null;
}


async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, msg: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    if (decoded.id !== undefined) {
      let live = null;
      try { live = await lookupUser(Number(decoded.id)); } catch (_) { live = undefined; } // DB hiccup: fall back to token
      if (live === null) return res.status(401).json({ success: false, msg: 'Account no longer exists' });
      if (live) { req.user.role = live.role || req.user.role; req.user.organization_id = live.organization_id || req.user.organization_id; }
    }
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

// FIX: This middleware was imported by purchaseRoutes.js but never defined/exported.
// That made it `undefined`, which crashed Express's route registration for the
// ENTIRE purchases router at startup (Route.post() requires a callback but got undefined).
// server.js's safe() wrapper caught that crash and silently replaced all
// /api/purchases/* routes (GET included) with a 500-error fallback — which is why
// the Purchases page always looked empty, even with real data in the DB.
//
// Blocks 'viewer' role (read-only) from creating/editing/deleting records.
function canWrite(req, res, next) {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ success: false, msg: 'Viewers have read-only access' });
  }
  next();
}

module.exports = { auth, adminOnly, canWrite, invalidateUser };
