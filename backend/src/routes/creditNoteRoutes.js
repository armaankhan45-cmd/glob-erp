const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const creditNotes = await db('credit_notes')
      .where({ organization_id: req.user.organization_id })
      .orderBy('created_at', 'desc');
    res.json({ success: true, creditNotes });
  } catch (err) {
    console.error('List credit notes error:', err);
    res.status(500).json({ success: false, msg: 'Failed', creditNotes: [] });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    const [cn] = await db('credit_notes').insert(data).returning('id');
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'credit_notes', cn.id || cn, null, data, req.ip);
    res.status(201).json({ success: true, creditNote: { id: cn.id || cn } });
  } catch (err) {
    console.error('Create credit note error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const old = await db('credit_notes').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Not found' });
    await db('credit_notes').where({ id: req.params.id }).update(req.body);
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'credit_notes', req.params.id, old, req.body, req.ip);
    res.json({ success: true, msg: 'Updated' });
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const cn = await db('credit_notes').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!cn) return res.status(404).json({ success: false, msg: 'Not found' });
    await db('credit_notes').where({ id: req.params.id }).del();
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'credit_notes', req.params.id, cn, null, req.ip);
    res.json({ success: true, msg: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
