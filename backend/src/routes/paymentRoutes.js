const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const payments = await db('payments')
      .where({ 'payments.organization_id': req.user.organization_id })
      .leftJoin('customers', 'payments.customer_id', 'customers.id')
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .select('payments.*', 'customers.name as customer_name', 'invoices.invoice_number')
      .orderBy('payments.created_at', 'desc');
    res.json({ success: true, payments });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ success: false, msg: 'Failed', payments: [] });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    const [payment] = await db('payments').insert(data).returning('id');

    // Update invoice payment status if applicable
    if (data.invoice_id && data.type === 'Received') {
      const invoice = await db('invoices').where({ id: data.invoice_id }).first();
      if (invoice) {
        const totalPayments = await db('payments')
          .where({ invoice_id: data.invoice_id, type: 'Received' })
          .sum('amount as total');
        const paid = parseFloat(totalPayments[0]?.total || 0);
        if (paid >= parseFloat(invoice.total_amount)) {
          await db('invoices').where({ id: data.invoice_id }).update({ payment_status: 'Paid' });
        } else if (paid > 0) {
          await db('invoices').where({ id: data.invoice_id }).update({ payment_status: 'Partial' });
        }
      }
    }

    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'payments', payment.id || payment, null, data, req.ip);
    res.status(201).json({ success: true, payment: { id: payment.id || payment } });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

module.exports = router;
