const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth, canWrite } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

const PURCHASE_COLUMNS = [
  'bill_number', 'supplier_name', 'supplier_gstin', 'bill_date',
  'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount',
  'discount', 'round_off', 'total_amount', 'payment_status', 'notes'
];

const PURCHASE_ITEM_COLUMNS = [
  'description', 'hsn_code', 'quantity', 'unit', 'rate',
  'cgst_rate', 'sgst_rate', 'igst_rate', 'amount'
];

function sanitizeDates(data) {
  const dateFields = ['bill_date'];
  const clean = { ...data };
  dateFields.forEach(f => {
    if (clean[f] === '' || clean[f] === undefined) clean[f] = null;
  });
  return clean;
}

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

router.post('/', auth, canWrite, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...rawData } = req.body;
    const data = { organization_id: req.user.organization_id };
    PURCHASE_COLUMNS.forEach(col => { if (rawData[col] !== undefined) data[col] = rawData[col]; });
    const cleanData = sanitizeDates(data);
    const [purchase] = await db('purchase_bills').insert(cleanData).returning('id');
    const pId = purchase.id || purchase;
    if (items && items.length > 0) {
      const itemRows = items.map(i => {
        const row = { purchase_id: pId };
        PURCHASE_ITEM_COLUMNS.forEach(col => { if (i[col] !== undefined) row[col] = i[col]; });
        return row;
      });
      await db('purchase_bill_items').insert(itemRows);
    }
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'purchase_bills', pId, null, cleanData, req.ip);
    res.status(201).json({ success: true, purchase: { id: pId } });
  } catch (err) {
    console.error('Create purchase error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

router.put('/:id', auth, canWrite, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...rawData } = req.body;
    const old = await db('purchase_bills').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Not found' });
    const data = {};
    PURCHASE_COLUMNS.forEach(col => { if (rawData[col] !== undefined) data[col] = rawData[col]; });
    const cleanData = sanitizeDates(data);
    await db('purchase_bills').where({ id: req.params.id }).update(cleanData);
    await db('purchase_bill_items').where({ purchase_id: req.params.id }).del();
    if (items && items.length > 0) {
      const itemRows = items.map(i => {
        const row = { purchase_id: req.params.id };
        PURCHASE_ITEM_COLUMNS.forEach(col => { if (i[col] !== undefined) row[col] = i[col]; });
        return row;
      });
      await db('purchase_bill_items').insert(itemRows);
    }
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'purchase_bills', req.params.id, old, cleanData, req.ip);
    res.json({ success: true, msg: 'Purchase updated' });
  } catch (err) {
    console.error('Update purchase error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.delete('/:id', auth, canWrite, async (req, res) => {
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
