const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const expenses = await db('expenses')
      .where({ organization_id: req.user.organization_id })
      .orderBy('expense_date', 'desc');
    res.json({ success: true, expenses });
  } catch (err) {
    console.error('List expenses error:', err);
    res.status(500).json({ success: false, msg: 'Failed', expenses: [] });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    const [expense] = await db('expenses').insert(data).returning('id');
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'expenses', expense.id || expense, null, data, req.ip);
    res.status(201).json({ success: true, expense: { id: expense.id || expense } });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
