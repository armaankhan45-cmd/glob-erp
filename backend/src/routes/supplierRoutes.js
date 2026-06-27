const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const suppliers = await db('suppliers').where({ organization_id: req.user.organization_id }).orderBy('created_at', 'desc');
    res.json({ success: true, suppliers });
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed', suppliers: [] });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    const [supplier] = await db('suppliers').insert(data).returning('id');
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'suppliers', supplier.id || supplier, null, data, req.ip);
    res.status(201).json({ success: true, supplier: { id: supplier.id || supplier } });
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db('suppliers').where({ id: req.params.id, organization_id: req.user.organization_id }).update(req.body);
    res.json({ success: true, msg: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db('suppliers').where({ id: req.params.id, organization_id: req.user.organization_id }).del();
    res.json({ success: true, msg: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

module.exports = router;
