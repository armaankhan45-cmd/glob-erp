const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/stats', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;

    // ═══ Total revenue ═══
    const revenue = await db('invoices')
      .where({ organization_id: orgId })
      .sum('total_amount as total')
      .first();

    // ═══ Paid revenue ═══
    const paidRevenue = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Paid' })
      .sum('total_amount as total')
      .first();

    // ═══ Partial revenue ═══
    const partialRevenue = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Partial' })
      .sum('total_amount as total')
      .first();

    // ═══ Pending invoices ═══
    const pending = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Unpaid' })
      .count('id as count')
      .sum('total_amount as amount')
      .first();

    // ═══ Overdue invoices (past due_date or invoice_date > 30 days ago) ═══
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const overdue = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Unpaid' })
      .where('invoice_date', '<', thirtyDaysAgo)
      .count('id as count')
      .sum('total_amount as amount')
      .first();

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const overdue60 = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Unpaid' })
      .where('invoice_date', '<', sixtyDaysAgo)
      .count('id as count')
      .sum('total_amount as amount')
      .first();

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const overdue90 = await db('invoices')
      .where({ organization_id: orgId, payment_status: 'Unpaid' })
      .where('invoice_date', '<', ninetyDaysAgo)
      .count('id as count')
      .sum('total_amount as amount')
      .first();

    // ═══ GST payable (output - input) ═══
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

    // ═══ Total expenses ═══
    const totalExpenses = await db('expenses')
      .where({ organization_id: orgId })
      .sum('amount as total')
      .first();

    // ═══ Monthly expenses for chart ═══
    const now = new Date();
    const fyStart = now.getMonth() < 3 ? new Date(now.getFullYear() - 1, 3, 1) : new Date(now.getFullYear(), 3, 1);

    const monthlyExpenses = await db('expenses')
      .where({ organization_id: orgId })
      .where('expense_date', '>=', fyStart.toISOString().split('T')[0])
      .select(
        db.raw("TO_CHAR(expense_date, 'YYYY-MM') as month"),
        db.raw('SUM(amount) as total')
      )
      .groupBy('month')
      .orderBy('month');

    // ═══ Recent invoices ═══
    const recentInvoices = await db('invoices')
      .where({ 'invoices.organization_id': orgId })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.id', 'invoices.invoice_number', 'invoices.total_amount', 'invoices.payment_status', 'invoices.invoice_date', 'customers.name as customer_name')
      .orderBy('invoices.created_at', 'desc')
      .limit(10);

    // ═══ Top customers (by total invoice amount) ═══
    const topCustomers = await db('invoices')
      .where({ 'invoices.organization_id': orgId })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('customers.id', 'customers.name', 'customers.gstin', 'customers.city', 'customers.state', 'customers.state_code')
      .sum('invoices.total_amount as totalBusiness')
      .groupBy('customers.id')
      .orderBy('totalBusiness', 'desc')
      .limit(5);

    // ═══ Monthly sales for chart ═══
    const monthlySales = await db('invoices')
      .where({ organization_id: orgId })
      .where('invoice_date', '>=', fyStart.toISOString().split('T')[0])
      .select(
        db.raw("TO_CHAR(invoice_date, 'YYYY-MM') as month"),
        db.raw('SUM(total_amount) as total')
      )
      .groupBy('month')
      .orderBy('month');

    // ═══ Quotation stats ═══
    const quotationStats = await db('quotations')
      .where({ organization_id: orgId })
      .count('id as count')
      .sum('total_amount as total')
      .first();

    const convertedQuotes = await db('quotations')
      .where({ organization_id: orgId, status: 'Converted' })
      .count('id as count')
      .first();

    // ═══ Purchase bill stats ═══
    const purchaseStats = await db('purchase_bills')
      .where({ organization_id: orgId })
      .count('id as count')
      .sum('total_amount as total')
      .first();

    // ═══ Inventory low stock alerts ═══
    const lowStockItems = await db('inventory')
      .where({ organization_id: orgId })
      .whereRaw('quantity <= min_quantity')
      .select('id', 'item_name', 'quantity', 'min_quantity', 'unit')
      .limit(10);

    // ═══ Calculate values ═══
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
        paidRevenue: parseFloat(paidRevenue?.total || 0),
        partialRevenue: parseFloat(partialRevenue?.total || 0),
        pendingInvoices: parseInt(pending?.count || 0),
        pendingAmount: parseFloat(pending?.amount || 0),
        overdue30: { count: parseInt(overdue?.count || 0), amount: parseFloat(overdue?.amount || 0) },
        overdue60: { count: parseInt(overdue60?.count || 0), amount: parseFloat(overdue60?.amount || 0) },
        overdue90: { count: parseInt(overdue90?.count || 0), amount: parseFloat(overdue90?.amount || 0) },
        customerCount: parseInt(customerCount?.count || 0),
        totalExpenses: parseFloat(totalExpenses?.total || 0),
        netProfit: parseFloat(revenue?.total || 0) - parseFloat(totalExpenses?.total || 0),
        quotationCount: parseInt(quotationStats?.count || 0),
        quotationTotal: parseFloat(quotationStats?.total || 0),
        convertedQuotes: parseInt(convertedQuotes?.count || 0),
        purchaseCount: parseInt(purchaseStats?.count || 0),
        purchaseTotal: parseFloat(purchaseStats?.total || 0),
        outputGST: { cgst: outCGST, sgst: outSGST, igst: outIGST, total: outCGST + outSGST + outIGST },
        inputGST: { cgst: inCGST, sgst: inSGST, igst: inIGST, total: inCGST + inSGST + inIGST },
        netPayable: {
          cgst: Math.max(0, outCGST - inCGST),
          sgst: Math.max(0, outSGST - inSGST),
          igst: Math.max(0, outIGST - inIGST)
        }
      },
      recentInvoices,
      topCustomers,
      monthlySales,
      monthlyExpenses,
      lowStockItems
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, msg: 'Failed', stats: {}, recentInvoices: [], topCustomers: [], monthlySales: [], monthlyExpenses: [], lowStockItems: [] });
  }
});

module.exports = router;
