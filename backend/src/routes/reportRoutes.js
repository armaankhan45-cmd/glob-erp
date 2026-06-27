const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

// Item-wise sales
router.get('/item-wise-sales', auth, async (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    let query = db('invoice_items')
      .join('invoices', 'invoice_items.invoice_id', 'invoices.id')
      .where({ 'invoices.organization_id': req.user.organization_id });
    if (from) query = query.where('invoices.invoice_date', '>=', from);
    if (to) query = query.where('invoices.invoice_date', '<=', to);
    
    const data = await query
      .select('invoice_items.description', 'invoice_items.hsn_code',
        db.raw('SUM(invoice_items.quantity) as total_qty'),
        db.raw('SUM(invoice_items.amount) as total_amount'),
        db.raw('SUM(invoice_items.cgst_rate) as cgst'),
        db.raw('SUM(invoice_items.igst_rate) as igst'))
      .groupBy('invoice_items.description', 'invoice_items.hsn_code')
      .orderBy('total_amount', 'desc');
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('Item-wise sales error:', err);
    res.status(500).json({ success: false, msg: 'Failed', data: [] });
  }
});

// Customer-wise sales
router.get('/customer-wise-sales', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = await db('invoices')
      .where({ 'invoices.organization_id': req.user.organization_id })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('customers.name as customer_name', 'customers.gstin',
        db.raw('COUNT(invoices.id) as invoice_count'),
        db.raw('SUM(invoices.total_amount) as total_amount'))
      .groupBy('customers.id')
      .orderBy('total_amount', 'desc');
    
    res.json({ success: true, data });
  } catch (err) {
    console.error('Customer-wise sales error:', err);
    res.status(500).json({ success: false, msg: 'Failed', data: [] });
  }
});

// Ageing report
router.get('/ageing', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoices = await db('invoices')
      .where({ organization_id: req.user.organization_id })
      .whereNot({ payment_status: 'Paid' })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.*', 'customers.name as customer_name');

    const today = new Date();
    const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };

    invoices.forEach(inv => {
      const days = Math.floor((today - new Date(inv.invoice_date)) / 86400000);
      const amount = parseFloat(inv.total_amount || 0);
      if (days <= 30) buckets['0-30'].push({ ...inv, days });
      else if (days <= 60) buckets['31-60'].push({ ...inv, days });
      else if (days <= 90) buckets['61-90'].push({ ...inv, days });
      else buckets['90+'].push({ ...inv, days });
    });

    res.json({ success: true, buckets });
  } catch (err) {
    console.error('Ageing error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Customer statement
router.get('/customer-statement/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    let query = db('invoices')
      .where({ customer_id: req.params.id, organization_id: req.user.organization_id });
    if (from) query = query.where('invoice_date', '>=', from);
    if (to) query = query.where('invoice_date', '<=', to);
    const invoices = await query.orderBy('invoice_date');
    
    const payments = await db('payments')
      .where({ customer_id: req.params.id, organization_id: req.user.organization_id });
    if (from) query = query.where('payment_date', '>=', from);
    if (to) query = query.where('payment_date', '<=', to);

    const customer = await db('customers').where({ id: req.params.id }).first();
    
    res.json({ success: true, customer, invoices, payments });
  } catch (err) {
    console.error('Customer statement error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
