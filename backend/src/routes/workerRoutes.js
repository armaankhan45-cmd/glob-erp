const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const workers = await db('workers').where({ organization_id: req.user.organization_id }).orderBy('created_at', 'desc');
    res.json({ success: true, workers });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed', workers: [] }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    const [worker] = await db('workers').insert(data).returning('id');
    res.status(201).json({ success: true, worker: { id: worker.id || worker } });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db('workers').where({ id: req.params.id, organization_id: req.user.organization_id }).update(req.body);
    res.json({ success: true, msg: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    await db('workers').where({ id: req.params.id, organization_id: req.user.organization_id }).del();
    res.json({ success: true, msg: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

module.exports = router;
