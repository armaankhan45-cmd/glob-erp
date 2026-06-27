const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/stats', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;

    // Total revenue
    const revenue = await db('invoices')
      .where({ organization_id: orgId })
      .sum('total_amount as total')
      .first();

    // Pending invoices count and amount
    const pending = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Unpaid' })
      .count('id as count')
      .sum('total_amount as amount')
      .first();

    // GST payable (output - input)
    const outputGST = await db('invoices')
      .where({ organization_id: orgId })
      .sum('cgst_amount as cgst')
      .sum('sgst_amount as sgst')
      .sum('igst_amount as igst')
      .first();

    const inputGST = await db('purchase_bills')
      .where({ organization_id: orgId })
      .sum('cgst_amount as cgst')
      .sum('sgst_amount as sgst')
      .sum('igst_amount as igst')
      .first();

    const customerCount = await db('customers')
      .where({ organization_id: orgId })
      .count('id as count')
      .first();

    // Recent invoices
    const recentInvoices = await db('invoices')
      .where({ 'invoices.organization_id': orgId })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.id', 'invoices.invoice_number', 'invoices.total_amount', 'invoices.payment_status', 'invoices.invoice_date', 'customers.name as customer_name')
      .orderBy('invoices.created_at', 'desc')
      .limit(10);

    // Monthly sales for chart (current FY)
    const now = new Date();
    const fyStart = now.getMonth() < 3 ? new Date(now.getFullYear() - 1, 3, 1) : new Date(now.getFullYear(), 3, 1);
    
    const monthlySales = await db('invoices')
      .where({ organization_id: orgId })
      .where('invoice_date', '>=', fyStart.toISOString().split('T')[0])
      .select(
        db.raw("TO_CHAR(invoice_date, 'YYYY-MM') as month"),
        db.raw('SUM(total_amount) as total')
      )
      .groupBy('month')
      .orderBy('month');

    const outCGST = parseFloat(outputGST?.cgst || 0);
    const outSGST = parseFloat(outputGST?.sgst || 0);
    const outIGST = parseFloat(outputGST?.igst || 0);
    const inCGST = parseFloat(inputGST?.cgst || 0);
    const inSGST = parseFloat(inputGST?.sgst || 0);
    const inIGST = parseFloat(inputGST?.igst || 0);

    res.json({
      success: true,
      stats: {
        totalRevenue: parseFloat(revenue?.total || 0),
        pendingInvoices: parseInt(pending?.count || 0),
        pendingAmount: parseFloat(pending?.amount || 0),
        customerCount: parseInt(customerCount?.count || 0),
        outputGST: { cgst: outCGST, sgst: outSGST, igst: outIGST, total: outCGST + outSGST + outIGST },
        inputGST: { cgst: inCGST, sgst: inSGST, igst: inIGST, total: inCGST + inSGST + inIGST },
        netPayable: {
          cgst: Math.max(0, outCGST - inCGST),
          sgst: Math.max(0, outSGST - inSGST),
          igst: Math.max(0, outIGST - inIGST)
        }
      },
      recentInvoices,
      monthlySales
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, msg: 'Failed', stats: {}, recentInvoices: [], monthlySales: [] });
  }
});

module.exports = router;
