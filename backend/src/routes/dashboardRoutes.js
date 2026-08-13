const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return d.toISOString().split('T')[0]; }
function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

// Reads ?period=month|all and ?month=YYYY-MM from the query string.
// Defaults to the current month when nothing (or something invalid) is passed.
function parsePeriod(query) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const period = query.period === 'all' ? 'all' : 'month';
  const month = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : currentMonth;

  let start = null, end = null; // end is exclusive
  if (period === 'month') {
    const [y, m] = month.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(y, m, 1));
  }
  return { period, month, start, end, currentMonth };
}

router.get('/stats', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const { period, month, start, end, currentMonth } = parsePeriod(req.query);

    // Applies the selected month's date range to a query builder, when period === 'month'.
    // Left untouched (whole history) when period === 'all'.
    function scoped(query, dateCol) {
      if (period === 'month') {
        query = query.where(dateCol, '>=', fmtDate(start)).where(dateCol, '<', fmtDate(end));
      }
      return query;
    }

    // ═══ Revenue (period-scoped) ═══
    const revenue = await scoped(db('invoices').where({ organization_id: orgId }), 'invoice_date')
      .sum('total_amount as total').first();

    const paidRevenue = await scoped(db('invoices').where({ organization_id: orgId, payment_status: 'Paid' }), 'invoice_date')
      .sum('total_amount as total').first();

    const partialRevenue = await scoped(db('invoices').where({ organization_id: orgId, payment_status: 'Partial' }), 'invoice_date')
      .sum('total_amount as total').first();

    // ═══ Outstanding — unpaid invoices dated within the selected period ═══
    const pending = await scoped(db('invoices').where({ organization_id: orgId, payment_status: 'Unpaid' }), 'invoice_date')
      .count('id as count').sum('total_amount as amount').first();

    // ═══ Overdue — always relative to "today", regardless of the selected period.
    // An unpaid invoice from a past month is still overdue when you're looking at "This Month". ═══
    const thirtyDaysAgo = fmtDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = fmtDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgo = fmtDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const [overdue, overdue60, overdue90] = await Promise.all(
      [thirtyDaysAgo, sixtyDaysAgo, ninetyDaysAgo].map(cutoff =>
        db('invoices').where({ organization_id: orgId, payment_status: 'Unpaid' })
          .where('invoice_date', '<', cutoff)
          .count('id as count').sum('total_amount as amount').first()
      )
    );

    // ═══ GST payable (period-scoped: output from invoices, input from purchase bills) ═══
    const outputGST = await scoped(db('invoices').where({ organization_id: orgId }), 'invoice_date')
      .sum('cgst_amount as cgst').sum('sgst_amount as sgst').sum('igst_amount as igst').first();

    const inputGST = await scoped(db('purchase_bills').where({ organization_id: orgId }), 'bill_date')
      .sum('cgst_amount as cgst').sum('sgst_amount as sgst').sum('igst_amount as igst').first();

    // ═══ Month-over-month growth — always compares the calendar month in view
    // (or the current month, when period=all) against the month before it. ═══
    const compareMonth = period === 'month' ? month : currentMonth;
    const [cy, cm] = compareMonth.split('-').map(Number);
    const curStart = new Date(Date.UTC(cy, cm - 1, 1));
    const curEnd = new Date(Date.UTC(cy, cm, 1));
    const prevStart = new Date(Date.UTC(cy, cm - 2, 1));
    const prevEnd = curStart;
    const [curTotal, prevTotal] = await Promise.all([
      db('invoices').where({ organization_id: orgId })
        .where('invoice_date', '>=', fmtDate(curStart)).where('invoice_date', '<', fmtDate(curEnd))
        .sum('total_amount as total').first(),
      db('invoices').where({ organization_id: orgId })
        .where('invoice_date', '>=', fmtDate(prevStart)).where('invoice_date', '<', fmtDate(prevEnd))
        .sum('total_amount as total').first()
    ]);
    const curTotalVal = parseFloat(curTotal?.total || 0);
    const prevTotalVal = parseFloat(prevTotal?.total || 0);
    const momGrowth = prevTotalVal > 0 ? ((curTotalVal - prevTotalVal) / prevTotalVal) * 100 : null;

    const customerCount = await db('customers').where({ organization_id: orgId }).count('id as count').first();

    const totalExpenses = await scoped(db('expenses').where({ organization_id: orgId }), 'expense_date')
      .sum('amount as total').first();

    // ═══ Recent invoices — always the latest, independent of the period filter ═══
    const recentInvoices = await db('invoices')
      .where({ 'invoices.organization_id': orgId })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.id', 'invoices.invoice_number', 'invoices.total_amount', 'invoices.payment_status', 'invoices.invoice_date', 'customers.name as customer_name')
      .orderBy('invoices.created_at', 'desc')
      .limit(10);

    // ═══ Top customers (period-scoped, so "This Month" shows this month's top customers) ═══
    const topCustomers = await scoped(
      db('invoices').where({ 'invoices.organization_id': orgId }).leftJoin('customers', 'invoices.customer_id', 'customers.id'),
      'invoices.invoice_date'
    )
      .select('customers.id', 'customers.name', 'customers.gstin', 'customers.city', 'customers.state', 'customers.state_code')
      .sum('invoices.total_amount as totalBusiness')
      .groupBy('customers.id')
      .orderBy('totalBusiness', 'desc')
      .limit(5);

    // ═══ Chart data ═══
    // period=month  → one bar per DAY of the selected month (revenue vs expenses)
    // period=all    → one bar per MONTH for the trailing 12 months (revenue vs expenses)
    let chartData = [];
    if (period === 'month') {
      const [dailySales, dailyExpenses] = await Promise.all([
        db('invoices').where({ organization_id: orgId })
          .where('invoice_date', '>=', fmtDate(start)).where('invoice_date', '<', fmtDate(end))
          .select(db.raw("TO_CHAR(invoice_date, 'YYYY-MM-DD') as day"), db.raw('SUM(total_amount) as revenue'))
          .groupBy('day'),
        db('expenses').where({ organization_id: orgId })
          .where('expense_date', '>=', fmtDate(start)).where('expense_date', '<', fmtDate(end))
          .select(db.raw("TO_CHAR(expense_date, 'YYYY-MM-DD') as day"), db.raw('SUM(amount) as expenses'))
          .groupBy('day')
      ]);

      const salesMap = new Map(dailySales.map(r => [r.day, parseFloat(r.revenue) || 0]));
      const expenseMap = new Map(dailyExpenses.map(r => [r.day, parseFloat(r.expenses) || 0]));

      const daysInMonth = new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0).getUTCDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${month}-${pad2(d)}`;
        chartData.push({
          label: String(d),
          date: dayStr,
          revenue: salesMap.get(dayStr) || 0,
          expenses: expenseMap.get(dayStr) || 0
        });
      }
    } else {
      const windowStart = new Date();
      windowStart.setUTCMonth(windowStart.getUTCMonth() - 11);
      windowStart.setUTCDate(1);

      const [monthlySalesRows, monthlyExpenseRows] = await Promise.all([
        db('invoices').where({ organization_id: orgId })
          .where('invoice_date', '>=', fmtDate(windowStart))
          .select(db.raw("TO_CHAR(invoice_date, 'YYYY-MM') as m"), db.raw('SUM(total_amount) as revenue'))
          .groupBy('m'),
        db('expenses').where({ organization_id: orgId })
          .where('expense_date', '>=', fmtDate(windowStart))
          .select(db.raw("TO_CHAR(expense_date, 'YYYY-MM') as m"), db.raw('SUM(amount) as expenses'))
          .groupBy('m')
      ]);

      const salesMap = new Map(monthlySalesRows.map(r => [r.m, parseFloat(r.revenue) || 0]));
      const expenseMap = new Map(monthlyExpenseRows.map(r => [r.m, parseFloat(r.expenses) || 0]));

      for (let i = 0; i < 12; i++) {
        const d = new Date(windowStart);
        d.setUTCMonth(d.getUTCMonth() + i);
        const mStr = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
        chartData.push({
          label: monthLabel(mStr),
          date: mStr,
          revenue: salesMap.get(mStr) || 0,
          expenses: expenseMap.get(mStr) || 0
        });
      }
    }

    // ═══ Quotation / purchase stats (period-scoped) ═══
    const quotationStats = await scoped(db('quotations').where({ organization_id: orgId }), 'quotation_date')
      .count('id as count').sum('total_amount as total').first();

    const convertedQuotes = await scoped(db('quotations').where({ organization_id: orgId, status: 'Converted' }), 'quotation_date')
      .count('id as count').first();

    const purchaseStats = await scoped(db('purchase_bills').where({ organization_id: orgId }), 'bill_date')
      .count('id as count').sum('total_amount as total').first();

    // ═══ Inventory low stock alerts (not period-scoped — current stock, not historical) ═══
    const lowStockItems = await db('inventory')
      .where({ organization_id: orgId })
      .whereRaw('quantity <= min_quantity')
      .select('id', 'item_name', 'quantity', 'min_quantity', 'unit')
      .limit(10);

    const outCGST = parseFloat(outputGST?.cgst || 0);
    const outSGST = parseFloat(outputGST?.sgst || 0);
    const outIGST = parseFloat(outputGST?.igst || 0);
    const inCGST = parseFloat(inputGST?.cgst || 0);
    const inSGST = parseFloat(inputGST?.sgst || 0);
    const inIGST = parseFloat(inputGST?.igst || 0);

    res.json({
      success: true,
      period,
      month,
      isCurrentMonth: month === currentMonth,
      periodLabel: period === 'all' ? 'All Time' : monthLabel(month),
      momGrowth: momGrowth === null ? null : parseFloat(momGrowth.toFixed(1)),
      momCompareLabel: monthLabel(compareMonth),
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
      chartData,
      lowStockItems
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, msg: 'Failed', stats: {}, recentInvoices: [], topCustomers: [], chartData: [], lowStockItems: [] });
  }
});

module.exports = router;
