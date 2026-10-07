const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

// GET /api/search?q=... — global search across invoices, quotations, purchases, customers
router.get('/', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ success: true, results: [] });
  const orgId = req.user.organization_id;
  const like = `%${q}%`;

  try {
    const db = getDb();

    const [invoices, quotations, purchases, customers] = await Promise.all([
      db('invoices').where({ 'invoices.organization_id': orgId })
        .leftJoin('customers', 'invoices.customer_id', 'customers.id')
        .where(function () {
          this.where('invoices.invoice_number', 'ilike', like).orWhere('customers.name', 'ilike', like);
        })
        .select('invoices.id', 'invoices.invoice_number', 'customers.name as customer_name', 'invoices.total_amount')
        .limit(5),

      db('quotations').where({ 'quotations.organization_id': orgId })
        .leftJoin('customers', 'quotations.customer_id', 'customers.id')
        .where(function () {
          this.where('quotations.quotation_number', 'ilike', like).orWhere('quotations.customer_name', 'ilike', like).orWhere('customers.name', 'ilike', like);
        })
        .select('quotations.id', 'quotations.quotation_number', db.raw('COALESCE(customers.name, quotations.customer_name) as customer_name'), 'quotations.total_amount')
        .limit(5),

      db('purchase_bills').where({ organization_id: orgId })
        .where(function () {
          this.where('bill_number', 'ilike', like).orWhere('supplier_name', 'ilike', like);
        })
        .select('id', 'bill_number', 'supplier_name', 'total_amount')
        .limit(5),

      db('customers').where({ organization_id: orgId })
        .where(function () {
          this.where('name', 'ilike', like).orWhere('gstin', 'ilike', like).orWhere('phone', 'ilike', like);
        })
        .select('id', 'name', 'phone', 'gstin')
        .limit(5),
    ]);

    const results = [
      ...invoices.map(r => ({ type: 'invoice', id: r.id, title: r.invoice_number, subtitle: r.customer_name, path: `/app/invoices/${r.id}` })),
      ...quotations.map(r => ({ type: 'quotation', id: r.id, title: r.quotation_number, subtitle: r.customer_name, path: `/app/quotations/${r.id}` })),
      ...purchases.map(r => ({ type: 'purchase', id: r.id, title: r.bill_number, subtitle: r.supplier_name, path: `/app/purchases/${r.id}` })),
      ...customers.map(r => ({ type: 'customer', id: r.id, title: r.name, subtitle: r.phone || r.gstin, path: `/app/customers/${r.id}` })),
    ];

    res.json({ success: true, results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, msg: 'Search failed' });
  }
});

module.exports = router;
