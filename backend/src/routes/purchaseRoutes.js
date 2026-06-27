const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { search, from, to } = req.query;
    let query = db('purchase_bills').where({ organization_id: req.user.organization_id });
    if (search) query = query.where(function() {
      this.where('bill_number', 'ilike', `%${search}%`).orWhere('supplier_name', 'ilike', `%${search}%`);
    });
    if (from) query = query.where('bill_date', '>=', from);
    if (to) query = query.where('bill_date', '<=', to);
    const purchases = await query.orderBy('created_at', 'desc');
    res.json({ success: true, purchases });
  } catch (err) {
    console.error('List purchases error:', err);
    res.status(500).json({ success: false, msg: 'Failed', purchases: [] });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const purchase = await db('purchase_bills').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!purchase) return res.status(404).json({ success: false, msg: 'Not found' });
    const items = await db('purchase_bill_items').where({ purchase_id: purchase.id });
    res.json({ success: true, purchase, items });
  } catch (err) {
    console.error('Get purchase error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...data } = req.body;
    data.organization_id = req.user.organization_id;
    const [purchase] = await db('purchase_bills').insert(data).returning('id');
    const pId = purchase.id || purchase;
    if (items && items.length > 0) {
      await db('purchase_bill_items').insert(items.map(i => ({ ...i, purchase_id: pId })));
    }
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'purchase_bills', pId, null, data, req.ip);
    res.status(201).json({ success: true, purchase: { id: pId } });
  } catch (err) {
    console.error('Create purchase error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...data } = req.body;
    const old = await db('purchase_bills').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Not found' });
    await db('purchase_bills').where({ id: req.params.id }).update(data);
    await db('purchase_bill_items').where({ purchase_id: req.params.id }).del();
    if (items && items.length > 0) {
      await db('purchase_bill_items').insert(items.map(i => ({ ...i, purchase_id: req.params.id })));
    }
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'purchase_bills', req.params.id, old, data, req.ip);
    res.json({ success: true, msg: 'Purchase updated' });
  } catch (err) {
    console.error('Update purchase error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const purchase = await db('purchase_bills').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!purchase) return res.status(404).json({ success: false, msg: 'Not found' });
    await db('purchase_bill_items').where({ purchase_id: req.params.id }).del();
    await db('purchase_bills').where({ id: req.params.id }).del();
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'purchase_bills', req.params.id, purchase, null, req.ip);
    res.json({ success: true, msg: 'Purchase deleted' });
  } catch (err) {
    console.error('Delete purchase error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
