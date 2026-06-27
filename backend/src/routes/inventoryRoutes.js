const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const inventory = await db('inventory').where({ organization_id: req.user.organization_id }).orderBy('created_at', 'desc');
    res.json({ success: true, inventory });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed', inventory: [] }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    const [item] = await db('inventory').insert(data).returning('id');
    res.status(201).json({ success: true, inventory: { id: item.id || item } });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db('inventory').where({ id: req.params.id, organization_id: req.user.organization_id }).update(req.body);
    res.json({ success: true, msg: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db('inventory').where({ id: req.params.id, organization_id: req.user.organization_id }).del();
    res.json({ success: true, msg: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

module.exports = router;
