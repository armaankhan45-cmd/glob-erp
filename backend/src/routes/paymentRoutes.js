const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

const FIELDS = ['payment_number', 'payment_date', 'type', 'customer_id', 'invoice_id', 'amount', 'payment_mode', 'reference', 'bank_name', 'notes'];
const MODES = ['Cash', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Card', 'Bank Transfer', 'Other'];

// Recompute an invoice's payment_status from the payments recorded against it.
async function syncInvoiceStatus(trx, invoiceId) {
  const invoice = await trx('invoices').where({ id: invoiceId }).first('id', 'total_amount');
  if (!invoice) return null;
  const [{ total }] = await trx('payments').where({ invoice_id: invoiceId }).whereRaw("COALESCE(type, 'Received') = 'Received'").sum('amount as total');
  const paid = Math.round(parseFloat(total || 0) * 100) / 100;
  const due = Math.round(parseFloat(invoice.total_amount || 0) * 100) / 100;
  const payment_status = paid <= 0 ? 'Unpaid' : paid + 0.009 >= due ? 'Paid' : 'Partial';
  await trx('invoices').where({ id: invoiceId }).update({ payment_status });
  return { paid, due, balance: Math.max(0, Math.round((due - paid) * 100) / 100), payment_status };
}

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const q = db('payments')
      .where({ 'payments.organization_id': req.user.organization_id })
      .leftJoin('customers', 'payments.customer_id', 'customers.id')
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .select('payments.*', 'customers.name as customer_name', 'invoices.invoice_number')
      .orderBy([{ column: 'payments.payment_date', order: 'desc' }, { column: 'payments.id', order: 'desc' }]);
    if (req.query.invoice_id) q.where('payments.invoice_id', req.query.invoice_id);
    if (req.query.customer_id) q.where('payments.customer_id', req.query.customer_id);
    res.json({ success: true, payments: await q });
  } catch (err) {
    console.error('List payments error:', err);
    res.status(500).json({ success: false, msg: 'Failed', payments: [] });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const data = { organization_id: orgId };
    FIELDS.forEach(f => { if (req.body[f] !== undefined && req.body[f] !== '') data[f] = req.body[f]; });
    data.amount = parseFloat(data.amount);
    if (!(data.amount > 0)) return res.status(400).json({ success: false, msg: 'Enter an amount greater than 0' });
    if (data.payment_mode && !MODES.includes(data.payment_mode)) data.payment_mode = 'Other';
    data.type = data.type || 'Received';
    data.payment_date = data.payment_date || new Date().toISOString().slice(0, 10);

    const result = await db.transaction(async trx => {
      if (data.invoice_id) {
        const inv = await trx('invoices').where({ id: data.invoice_id, organization_id: orgId }).first('id', 'customer_id');
        if (!inv) { const e = new Error('Invoice not found'); e.status = 404; throw e; }
        data.customer_id = data.customer_id || inv.customer_id;
      }
      const [row] = await trx('payments').insert(data).returning('id');
      const id = row.id || row;
      const invoice = data.invoice_id ? await syncInvoiceStatus(trx, data.invoice_id) : null;
      return { id, invoice };
    });

    await auditLog(req.user.id, orgId, 'CREATE', 'payments', result.id, null, data, req.ip);
    res.status(201).json({ success: true, payment: { id: result.id }, invoice: result.invoice });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, msg: err.message });
    console.error('Create payment error:', err);
    res.status(500).json({ success: false, msg: 'Could not record the payment' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const result = await db.transaction(async trx => {
      const p = await trx('payments').where({ id: req.params.id, organization_id: orgId }).first();
      if (!p) return null;
      await trx('payments').where({ id: p.id }).del();
      return { payment: p, invoice: p.invoice_id ? await syncInvoiceStatus(trx, p.invoice_id) : null };
    });
    if (!result) return res.status(404).json({ success: false, msg: 'Payment not found' });
    await auditLog(req.user.id, orgId, 'DELETE', 'payments', result.payment.id, result.payment, null, req.ip);
    res.json({ success: true, invoice: result.invoice });
  } catch (err) {
    console.error('Delete payment error:', err);
    res.status(500).json({ success: false, msg: 'Could not delete the payment' });
  }
});

module.exports = router;
module.exports.syncInvoiceStatus = syncInvoiceStatus;
