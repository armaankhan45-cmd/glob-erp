const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');

// GET /api/audit?page=1&limit=50&action=&table=&user_id=&from=&to=&q=
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const { action, table, user_id, from, to, q } = req.query;
    const base = () => {
      const b = db('audit_log').where('audit_log.organization_id', req.user.organization_id);
      if (action) b.andWhere('audit_log.action', action);
      if (table) b.andWhere('audit_log.table_name', table);
      if (user_id) b.andWhere('audit_log.user_id', user_id);
      if (from) b.andWhere('audit_log.created_at', '>=', from);
      if (to) b.andWhere('audit_log.created_at', '<', db.raw(`(?::date + interval '1 day')`, [to]));
      if (q) b.andWhere(function () { this.whereRaw('audit_log.record_id::text ilike ?', [`%${q}%`]).orWhere('audit_log.table_name', 'ilike', `%${q}%`); });
      return b;
    };
    const [{ count }] = await base().count('* as count');
    const rows = await base()
      .leftJoin('users', 'audit_log.user_id', 'users.id')
      .select('audit_log.*', 'users.name as user_name', 'users.email as user_email')
      .orderBy('audit_log.created_at', 'desc').limit(limit).offset((page - 1) * limit);
    const facets = await db('audit_log').where({ organization_id: req.user.organization_id })
      .select(db.raw('array_agg(distinct action) as actions'), db.raw('array_agg(distinct table_name) as tables'));
    res.json({ success: true, rows, total: parseInt(count), page, limit, actions: facets[0]?.actions || [], tables: facets[0]?.tables || [] });
  } catch (err) { console.error('Audit error:', err); res.status(500).json({ success: false, msg: err.message }); }
});

module.exports = router;
