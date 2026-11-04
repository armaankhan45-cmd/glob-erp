const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

// ═══ Quarterly GST computation (self-contained — no separate helper file to misplace) ═══
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MONTH_FULL = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
const QUARTER_RANGE = ['Apr – Jun', 'Jul – Sep', 'Oct – Dec', 'Jan – Mar'];
// States where the quarterly GSTR-3B is due on the 22nd (category 1); all others → 24th.
const DUE_22_STATES = new Set(['27', '24', '23', '22', '29', '30', '32', '33', '36', '37', '25', '26', '34', '35', '31']);

const pad = (n) => String(n).padStart(2, '0');
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => parseFloat(v || 0) || 0;

function monthKeyFor(fy, i) { return i < 9 ? `${fy}-${pad(i + 4)}` : `${fy + 1}-${pad(i - 8)}`; }

function emptyHeads() { return { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 }; }
function headsFrom(row) {
  const cgst = num(row?.cgst), sgst = num(row?.sgst), igst = num(row?.igst);
  return { taxable: num(row?.taxable), cgst, sgst, igst, total: cgst + sgst + igst, count: parseInt(row?.cnt || 0) };
}
function addHeads(a, b) {
  return { taxable: a.taxable + b.taxable, cgst: a.cgst + b.cgst, sgst: a.sgst + b.sgst, igst: a.igst + b.igst, total: a.total + b.total, count: a.count + b.count };
}
const roundHeads = (h) => ({ taxable: r2(h.taxable), cgst: r2(h.cgst), sgst: r2(h.sgst), igst: r2(h.igst), total: r2(h.total), count: h.count });

function setOff(led, o) {
  let due = o.igst, use;
  use = Math.min(led.i, due); led.i -= use; due -= use;
  if (due > 0) { use = Math.min(led.c, due); led.c -= use; due -= use; }
  if (due > 0) { use = Math.min(led.s, due); led.s -= use; due -= use; }
  const payI = due;
  due = o.cgst; use = Math.min(led.c, due); led.c -= use; due -= use;
  if (due > 0) { use = Math.min(led.i, due); led.i -= use; due -= use; }
  const payC = due;
  due = o.sgst; use = Math.min(led.s, due); led.s -= use; due -= use;
  if (due > 0) { use = Math.min(led.i, due); led.i -= use; due -= use; }
  const payS = due;
  return { cgst: payC, sgst: payS, igst: payI };
}

async function groupByMonth(db, table, dateCol, orgId, fyStart, fyEnd, extra) {
  const q = db(table).where({ organization_id: orgId }).whereBetween(dateCol, [fyStart, fyEnd]);
  if (extra) extra(q);
  return q.select(
    db.raw(`TO_CHAR(${dateCol}, 'YYYY-MM') as month`),
    db.raw('COUNT(*) as cnt'),
    db.raw('COALESCE(SUM(subtotal), 0) as taxable'),
    db.raw('COALESCE(SUM(cgst_amount), 0) as cgst'),
    db.raw('COALESCE(SUM(sgst_amount), 0) as sgst'),
    db.raw('COALESCE(SUM(igst_amount), 0) as igst')
  ).groupBy('month');
}

async function computeQuarterly(db, orgId, fy, opts = {}) {
  const useCreditNotes = opts.creditNotes !== false;
  const fyStart = `${fy}-04-01`;
  const fyEnd = `${fy + 1}-03-31`;

  const org = await db('organizations').where({ id: orgId }).first('state_code', 'gstin');
  const stateCode = String(org?.state_code || (org?.gstin ? org.gstin.substring(0, 2) : '') || '27');
  const dueDay = DUE_22_STATES.has(stateCode) ? 22 : 24;

  const [outRows, inRows] = await Promise.all([
    groupByMonth(db, 'invoices', 'invoice_date', orgId, fyStart, fyEnd, (q) => q.whereRaw("COALESCE(status, '') NOT ILIKE 'cancel%'")),
    groupByMonth(db, 'purchase_bills', 'bill_date', orgId, fyStart, fyEnd),
  ]);
  let cnRows = [];
  if (useCreditNotes) {
    try { cnRows = await groupByMonth(db, 'credit_notes', 'credit_date', orgId, fyStart, fyEnd); } catch (e) { cnRows = []; }
  }
  const byMonth = (rows) => Object.fromEntries(rows.map((r) => [r.month, headsFrom(r)]));
  const outM = byMonth(outRows), inM = byMonth(inRows), cnM = byMonth(cnRows);

  const months = MONTHS.map((label, i) => {
    const key = monthKeyFor(fy, i);
    const gross = outM[key] || emptyHeads();
    const cn = cnM[key] || emptyHeads();
    const inp = inM[key] || emptyHeads();
    // Credit notes reduce output tax. A head can't go below zero in a month for this report.
    const net = {
      taxable: Math.max(0, gross.taxable - cn.taxable), count: gross.count,
      cgst: Math.max(0, gross.cgst - cn.cgst), sgst: Math.max(0, gross.sgst - cn.sgst), igst: Math.max(0, gross.igst - cn.igst),
    };
    net.total = net.cgst + net.sgst + net.igst;
    return { key, label, fullName: MONTH_FULL[i], quarter: Math.floor(i / 3) + 1, output: net, creditNotes: cn, input: inp };
  });

  const led = { c: 0, s: 0, i: 0 };
  const quarters = [0, 1, 2, 3].map((qi) => {
    const qMonths = months.slice(qi * 3, qi * 3 + 3);
    const sum = (pick) => qMonths.reduce((acc, m) => addHeads(acc, pick(m)), emptyHeads());
    const output = sum((m) => m.output);
    const creditNotes = sum((m) => m.creditNotes);
    const input = sum((m) => m.input);

    const opening = { cgst: led.c, sgst: led.s, igst: led.i, total: led.c + led.s + led.i };
    led.c += input.cgst; led.s += input.sgst; led.i += input.igst;
    const pay = setOff(led, output);
    const payable = { ...pay, total: pay.cgst + pay.sgst + pay.igst };
    const closing = { cgst: led.c, sgst: led.s, igst: led.i, total: led.c + led.s + led.i };

    // Quarterly return is due in the month after the quarter ends: Q1→Jul, Q2→Oct, Q3→Jan, Q4→Apr
    const dueMonth = [7, 10, 1, 4][qi];
    const dueYearFinal = qi >= 2 ? fy + 1 : fy;
    return {
      q: qi + 1,
      label: `Q${qi + 1}`,
      range: QUARTER_RANGE[qi],
      startDate: `${monthKeyFor(fy, qi * 3)}-01`,
      endDate: new Date(Date.UTC(qi < 3 ? fy : fy + 1, [6, 9, 12, 3][qi], 0)).toISOString().slice(0, 10),
      dueDate: `${dueYearFinal}-${pad(dueMonth)}-${pad(dueDay)}`,
      months: qMonths.map((m) => ({ ...m, output: roundHeads(m.output), creditNotes: roundHeads(m.creditNotes), input: roundHeads(m.input) })),
      output: roundHeads(output), creditNotes: roundHeads(creditNotes), input: roundHeads(input),
      opening: { cgst: r2(opening.cgst), sgst: r2(opening.sgst), igst: r2(opening.igst), total: r2(opening.total) },
      payable: { cgst: r2(payable.cgst), sgst: r2(payable.sgst), igst: r2(payable.igst), total: r2(payable.total) },
      closing: { cgst: r2(closing.cgst), sgst: r2(closing.sgst), igst: r2(closing.igst), total: r2(closing.total) },
    };
  });

  const totals = {
    output: roundHeads(quarters.reduce((a, q) => addHeads(a, q.output), emptyHeads())),
    input: roundHeads(quarters.reduce((a, q) => addHeads(a, q.input), emptyHeads())),
    creditNotes: roundHeads(quarters.reduce((a, q) => addHeads(a, q.creditNotes), emptyHeads())),
    payable: r2(quarters.reduce((s, q) => s + q.payable.total, 0)),
    closingCredit: quarters[3].closing.total,
  };

  return { fy, fyLabel: `${fy}-${String(fy + 1).slice(2)}`, stateCode, dueDay, creditNotesApplied: useCreditNotes, quarters, totals, months };
}

function currentFy(date = new Date()) { return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1; }


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

// Customer-wise sales (honours the from/to filter the Reports page sends)
router.get('/customer-wise-sales', auth, async (req, res) => {
  try {
    const db = getDb();
    const { from, to } = req.query;
    let query = db('invoices')
      .where({ 'invoices.organization_id': req.user.organization_id })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id');
    if (from) query = query.where('invoices.invoice_date', '>=', from);
    if (to) query = query.where('invoices.invoice_date', '<=', to);
    const data = await query
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

// Quarterly GST — Indian FY (Apr–Mar), tax settled per quarter with statutory ITC set-off
router.get('/gst-quarterly', auth, async (req, res) => {
  try {
    const db = getDb();
    const fy = parseInt(req.query.fy, 10) || currentFy();
    const data = await computeQuarterly(db, req.user.organization_id, fy, { creditNotes: req.query.cn !== '0' });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Quarterly GST error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
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
    
    let payQuery = db('payments')
      .where({ customer_id: req.params.id, organization_id: req.user.organization_id });
    if (from) payQuery = payQuery.where('payment_date', '>=', from);
    if (to) payQuery = payQuery.where('payment_date', '<=', to);
    const payments = await payQuery.orderBy('payment_date');

    const customer = await db('customers').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    
    res.json({ success: true, customer, invoices, payments });
  } catch (err) {
    console.error('Customer statement error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// exposed so exportRoutes can reuse the same numbers for the Excel workbook
router.computeQuarterly = computeQuarterly;
router.currentFy = currentFy;
module.exports = router;
