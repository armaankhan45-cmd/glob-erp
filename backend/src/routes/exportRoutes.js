const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

async function exportToXlsx(data, columns, sheetName, res, filename) {
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: columns });
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, msg: 'Export failed' });
  }
}

router.get('/invoices.xlsx', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoices = await db('invoices')
      .where({ 'invoices.organization_id': req.user.organization_id })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.invoice_number', 'invoices.invoice_date', 'customers.name as customer_name',
        'invoices.subtotal', 'invoices.cgst_amount', 'invoices.sgst_amount', 'invoices.igst_amount',
        'invoices.total_amount', 'invoices.payment_status', 'invoices.status');
    
    await exportToXlsx(invoices, 
      ['invoice_number','invoice_date','customer_name','subtotal','cgst_amount','sgst_amount','igst_amount','total_amount','payment_status','status'],
      'Invoices', res, 'invoices.xlsx');
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.get('/customers.xlsx', auth, async (req, res) => {
  try {
    const db = getDb();
    const customers = await db('customers')
      .where({ organization_id: req.user.organization_id })
      .select('name','gstin','phone','email','address','city','state','pincode','contact_person','business_type');
    
    await exportToXlsx(customers,
      ['name','gstin','phone','email','address','city','state','pincode','contact_person','business_type'],
      'Customers', res, 'customers.xlsx');
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.get('/purchases.xlsx', auth, async (req, res) => {
  try {
    const db = getDb();
    const purchases = await db('purchase_bills')
      .where({ organization_id: req.user.organization_id })
      .select('bill_number','bill_date','supplier_name','supplier_gstin','subtotal','cgst_amount','sgst_amount','igst_amount','total_amount','payment_status');
    
    await exportToXlsx(purchases,
      ['bill_number','bill_date','supplier_name','supplier_gstin','subtotal','cgst_amount','sgst_amount','igst_amount','total_amount','payment_status'],
      'Purchases', res, 'purchases.xlsx');
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

router.get('/payments.xlsx', auth, async (req, res) => {
  try {
    const db = getDb();
    const payments = await db('payments')
      .where({ 'payments.organization_id': req.user.organization_id })
      .leftJoin('customers', 'payments.customer_id', 'customers.id')
      .select('payments.payment_number','payments.payment_date','payments.type','customers.name as customer_name',
        'payments.amount','payments.payment_mode','payments.reference','payments.bank_name');
    
    await exportToXlsx(payments,
      ['payment_number','payment_date','type','customer_name','amount','payment_mode','reference','bank_name'],
      'Payments', res, 'payments.xlsx');
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
