const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const { computeQuarterly } = require('../services/gstQuarterly');

// Self-healing require: if exceljs isn't installed yet on this server
// (e.g. package.json was updated but `npm install` hasn't run there),
// don't hard-crash every export — fall back to a dependency-free CSV
// so the feature keeps working. The moment exceljs actually becomes
// available (after npm install + restart), this automatically upgrades
// back to the full styled Excel version with no code change needed.
let ExcelJS = null;
try {
  ExcelJS = require('exceljs');
} catch (e) {
  console.warn('[export] exceljs not installed — falling back to plain CSV exports until `npm install` is run on this server.');
}

function toCsv(columns, rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map(c => esc(c.header)).join(',');
  const body = rows.map(r => columns.map(c => esc(r[c.key])).join(',')).join('\n');
  return header + '\n' + body;
}

// ─── Shared styling ───────────────────────────────────────────────
const BRAND = 'FF1E3A5F';      // header fill
const BRAND_TEXT = 'FFFFFFFF'; // header text
const ALT_ROW = 'FFF4F7FB';    // zebra stripe
const BORDER = { style: 'thin', color: { argb: 'FFD8DEE6' } };
const MONEY_FMT = '₹#,##0.00';
const CURRENCY_COLS = new Set(['subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'amount',
  'taxable', 'cgst', 'sgst', 'igst', 'total', 'sales_taxable', 'out_cgst', 'out_sgst', 'out_igst', 'output_gst',
  'pur_taxable', 'in_cgst', 'in_sgst', 'in_igst', 'input_gst', 'net_gst', 'opening_credit', 'pay_cgst', 'pay_sgst',
  'pay_igst', 'pay_total', 'closing_credit', 'fixed_sum', 'self_estimate']);
const COUNT_COLS = new Set(['records', 'sales_count', 'purchase_count']);   // summed in totals rows, no ₹ format
const DATE_COLS = new Set(['invoice_date', 'bill_date', 'payment_date', 'date']);

function styleHeaderRow(row) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    cell.font = { bold: true, color: { argb: BRAND_TEXT }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER };
  });
  row.height = 22;
}

function styleDataRow(row, rowIndex, columns) {
  row.eachCell((cell, colNumber) => {
    const key = columns[colNumber - 1]?.key;
    cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER };
    cell.alignment = { vertical: 'middle', horizontal: CURRENCY_COLS.has(key) ? 'right' : 'left' };
    if (rowIndex % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } };
    if (CURRENCY_COLS.has(key)) cell.numFmt = MONEY_FMT;
    if (DATE_COLS.has(key) && cell.value) cell.numFmt = 'dd-mmm-yyyy';
  });
}

function autoWidth(ws, columns) {
  columns.forEach((col, i) => {
    const c = ws.getColumn(i + 1);
    const headerLen = String(col.header || '').length;
    let maxLen = headerLen;
    c.eachCell({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    c.width = Math.min(Math.max(maxLen + 3, 12), 40);
  });
}

function addTable(ws, columns, rows) {
  ws.columns = columns;
  styleHeaderRow(ws.getRow(1));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  rows.forEach((r, i) => {
    const row = ws.addRow(r);
    styleDataRow(row, i, columns);
  });
  autoWidth(ws, columns);
  return ws;
}

function addTotalsRow(ws, columns, rows, labelKey, skip = new Set()) {
  if (!rows.length) return;
  const totals = {};
  columns.forEach(col => {
    if ((CURRENCY_COLS.has(col.key) || COUNT_COLS.has(col.key)) && !skip.has(col.key)) {
      totals[col.key] = rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0);
    }
  });
  if (!Object.keys(totals).length) return;
  totals[labelKey] = 'TOTAL';
  const row = ws.addRow(totals);
  row.eachCell((cell, colNumber) => {
    const key = columns[colNumber - 1]?.key;
    cell.font = { bold: true };
    cell.border = { top: { style: 'double', color: { argb: 'FF1E3A5F' } }, left: BORDER, right: BORDER, bottom: BORDER };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EEF5' } };
    if (CURRENCY_COLS.has(key)) cell.numFmt = MONEY_FMT;
  });
}

// Insights sheet: quick summary stats a business owner actually wants at a glance
function addInsightsSheet(wb, title, rows, moneyKey = 'total_amount', dateKey = null) {
  const ws = wb.addWorksheet('Insights', { properties: { tabColor: { argb: BRAND } } });
  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;

  const titleRow = ws.addRow([title + ' — Summary']);
  ws.mergeCells('A1:B1');
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND } };
  titleRow.height = 26;
  ws.addRow([]);

  const total = moneyKey ? rows.reduce((s, r) => s + (Number(r[moneyKey]) || 0), 0) : 0;
  const avg = rows.length ? total / rows.length : 0;
  const stats = [['Total Records', rows.length]];
  if (moneyKey) {
    stats.push(['Total Value', total]);
    stats.push(['Average Value', avg]);
  }
  if (dateKey) {
    const dates = rows.map(r => r[dateKey]).filter(Boolean).sort();
    if (dates.length) {
      stats.push(['Earliest Date', dates[0]]);
      stats.push(['Latest Date', dates[dates.length - 1]]);
    }
  }
  stats.forEach(([label, value]) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    if (typeof value === 'number' && label.includes('Value')) row.getCell(2).numFmt = MONEY_FMT;
    row.eachCell(c => { c.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER }; });
  });
  return ws;
}


// ─── Month / quarter helpers (Indian financial year: Apr–Mar) ─────────────
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QSPAN = ['', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec', 'Jan–Mar'];
const pad2 = n => String(n).padStart(2, '0');
function monthKeyOf(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : `${v.getFullYear()}-${pad2(v.getMonth() + 1)}`;
  const m = /^(\d{4})-(\d{2})/.exec(String(v));
  return m ? `${m[1]}-${m[2]}` : null;
}
const monthLabel = k => `${MON[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
const quarterOf = k => { const m = +k.slice(5, 7); return m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 ? 3 : 4; };
const fyOfKey = k => { const y = +k.slice(0, 4), m = +k.slice(5, 7); return m >= 4 ? y : y - 1; };
const fyLabel = fy => `FY ${fy}-${String(fy + 1).slice(2)}`;
const quarterLabel = k => `Q${quarterOf(k)} ${fyLabel(fyOfKey(k))}`;
function currentFyStart() { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; }
function parseFy(q) { if (!q || q === 'all') return null; const n = parseInt(q, 10); return Number.isFinite(n) ? n : null; }

// pg returns NUMERIC as strings — make them real numbers so Excel can sum, sort and format them
function normalizeRows(rows) {
  return rows.map(r => {
    const o = { ...r };
    Object.keys(o).forEach(k => { if (CURRENCY_COLS.has(k) && o[k] !== null && o[k] !== undefined) o[k] = Number(o[k]) || 0; });
    return o;
  });
}
function filterByFy(rows, dateKey, fy) {
  if (fy == null || !dateKey) return rows;
  return rows.filter(r => { const k = monthKeyOf(r[dateKey]); return k && fyOfKey(k) === fy; });
}
async function loadRows(exp, db, orgId, fy) {
  return filterByFy(normalizeRows(await exp.fetch(db, orgId)), exp.dateKey, fy);
}

// Month-wise + quarter-wise summary of any date-based export
function summaryColumns(exp, first) {
  const hasTax = exp.columns.some(c => c.key === 'cgst_amount');
  const cols = [{ header: first, key: 'period' }, { header: 'Quarter', key: 'quarter' }, { header: 'Records', key: 'records' }];
  if (hasTax) cols.push({ header: 'Taxable Value', key: 'taxable' }, { header: 'CGST', key: 'cgst' }, { header: 'SGST', key: 'sgst' }, { header: 'IGST', key: 'igst' });
  cols.push({ header: exp.moneyKey === 'amount' ? 'Total Amount' : 'Total', key: 'total' });
  return { cols, hasTax };
}
function summarize(rows, exp) {
  const { hasTax } = summaryColumns(exp, '');
  const bucket = (map, key, label, quarter, r) => {
    let a = map.get(key);
    if (!a) { a = { sort: key, period: label, quarter, records: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }; map.set(key, a); }
    a.records += 1; a.total += Number(r[exp.moneyKey]) || 0;
    if (hasTax) { a.taxable += Number(r.subtotal) || 0; a.cgst += Number(r.cgst_amount) || 0; a.sgst += Number(r.sgst_amount) || 0; a.igst += Number(r.igst_amount) || 0; }
  };
  const months = new Map(), quarters = new Map();
  rows.forEach(r => {
    const k = monthKeyOf(r[exp.dateKey]); if (!k) return;
    bucket(months, k, monthLabel(k), quarterLabel(k), r);
    const qk = `${fyOfKey(k)}-${quarterOf(k)}`;
    bucket(quarters, qk, `${quarterLabel(k)} (${QSPAN[quarterOf(k)]})`, quarterLabel(k), r);
  });
  const sorted = m => [...m.values()].sort((a, b) => a.sort.localeCompare(b.sort)).map(({ sort, ...x }) => x);
  return { monthly: sorted(months), quarterly: sorted(quarters) };
}

// Sheet listing every month with data + per-quarter totals underneath
function addSummarySheet(wb, exp, rows, fy) {
  const ws = wb.addWorksheet('Month-wise Summary', { properties: { tabColor: { argb: 'FF2E8B57' } } });
  const { monthly, quarterly } = summarize(rows, exp);
  const { cols } = summaryColumns(exp, 'Month');
  const title = ws.addRow([`${exp.label} — month-wise report${fy != null ? ' · ' + fyLabel(fy) : ' · all time'}`]);
  title.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND } }; title.height = 26;
  ws.addRow([]);
  const hdr = ws.addRow(cols.map(c => c.header)); styleHeaderRow(hdr);
  monthly.forEach((m, i) => { const r = ws.addRow(cols.map(c => m[c.key])); styleDataRow(r, i, cols); });
  const tot = {}; cols.forEach(c => { if (CURRENCY_COLS.has(c.key) || COUNT_COLS.has(c.key)) tot[c.key] = monthly.reduce((s, m) => s + (m[c.key] || 0), 0); });
  const trow = ws.addRow(cols.map(c => c.key === 'period' ? 'TOTAL' : tot[c.key]));
  trow.eachCell((cell, n) => { const k = cols[n - 1].key; cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9EEF5' } }; cell.border = { top: { style: 'double', color: { argb: BRAND } }, left: BORDER, right: BORDER, bottom: BORDER }; if (CURRENCY_COLS.has(k)) cell.numFmt = MONEY_FMT; });
  ws.addRow([]);
  const qt = ws.addRow(['Quarter-wise totals (for quarterly GST filers)']); qt.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND } };
  const qh = ws.addRow(cols.map(c => c.key === 'period' ? 'Quarter' : c.header)); styleHeaderRow(qh);
  quarterly.forEach((m, i) => { const r = ws.addRow(cols.map(c => m[c.key])); styleDataRow(r, i, cols); });
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.key === 'period' ? 34 : 16; });
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  return ws;
}

// One sheet per month that has data, each with its own total row
function addMonthSheets(wb, exp, rows) {
  const keys = [...new Set(rows.map(r => monthKeyOf(r[exp.dateKey])).filter(Boolean))].sort();
  keys.forEach(k => {
    const ws = wb.addWorksheet(monthLabel(k), { properties: { tabColor: { argb: BRAND } } });
    const mr = rows.filter(r => monthKeyOf(r[exp.dateKey]) === k).sort((a, b) => new Date(a[exp.dateKey]) - new Date(b[exp.dateKey]));
    addTable(ws, exp.columns, mr);
    if (exp.moneyKey) addTotalsRow(ws, exp.columns, mr, exp.columns[0].key);
  });
}

// ─── GST report workbook: monthly + quarterly (QRMP) + one sheet per month with the bills ───
const GST_MONTH_COLS = [
  { header: 'Month', key: 'month' }, { header: 'Quarter', key: 'quarter' },
  { header: 'Sales Invoices', key: 'sales_count' }, { header: 'Sales Taxable Value', key: 'sales_taxable' },
  { header: 'Output CGST', key: 'out_cgst' }, { header: 'Output SGST', key: 'out_sgst' }, { header: 'Output IGST', key: 'out_igst' },
  { header: 'Total Output GST', key: 'output_gst' },
  { header: 'Purchase Bills', key: 'purchase_count' }, { header: 'Purchase Taxable Value', key: 'pur_taxable' },
  { header: 'Input CGST', key: 'in_cgst' }, { header: 'Input SGST', key: 'in_sgst' }, { header: 'Input IGST', key: 'in_igst' },
  { header: 'Total Input GST (ITC)', key: 'input_gst' },
  { header: 'Net GST (Output − Input)', key: 'net_gst' },
];
const GST_QUARTER_COLS = [
  { header: 'Quarter', key: 'quarter' }, { header: 'Period', key: 'period' },
  { header: 'Sales Taxable Value', key: 'sales_taxable' }, { header: 'Output GST', key: 'output_gst' }, { header: 'Input GST (ITC)', key: 'input_gst' },
  { header: 'Credit Brought Forward', key: 'opening_credit' },
  { header: 'Cash Payable CGST', key: 'pay_cgst' }, { header: 'Cash Payable SGST', key: 'pay_sgst' }, { header: 'Cash Payable IGST', key: 'pay_igst' },
  { header: 'TOTAL GST PAYABLE', key: 'pay_total' }, { header: 'Credit Carried Forward', key: 'closing_credit' },
  { header: 'GSTR-1 Due', key: 'gstr1_due' }, { header: 'GSTR-3B Due', key: 'gstr3b_due' },
];
const fmtDue = iso => { const [y, m, d] = iso.split('-'); return `${d}-${MON[+m - 1]}-${y}`; };

function gstMonthlyRows(g) {
  return g.quarters.flatMap(q => q.months.map(m => ({
    month: m.label, quarter: q.label,
    sales_count: m.sales.count, sales_taxable: m.sales.taxable, out_cgst: m.sales.cgst, out_sgst: m.sales.sgst, out_igst: m.sales.igst, output_gst: m.outputGST,
    purchase_count: m.purchases.count, pur_taxable: m.purchases.taxable, in_cgst: m.purchases.cgst, in_sgst: m.purchases.sgst, in_igst: m.purchases.igst, input_gst: m.inputGST,
    net_gst: Math.round((m.outputGST - m.inputGST) * 100) / 100,
  })));
}
function gstQuarterRows(g) {
  return g.quarters.map(q => ({
    quarter: q.label, period: q.name.replace(/^Q\d /, '').replace(/[()]/g, ''),
    sales_taxable: q.output.taxable, output_gst: q.output.gst, input_gst: q.input.gst, opening_credit: q.openingCredit,
    pay_cgst: q.payable.cgst, pay_sgst: q.payable.sgst, pay_igst: q.payable.igst, pay_total: q.payable.total, closing_credit: q.closingCredit,
    gstr1_due: fmtDue(q.due.gstr1), gstr3b_due: fmtDue(q.due.gstr3b),
  }));
}
function gstPmtRows(g) {
  return g.quarters.flatMap(q => q.due.pmt06.map(p => ({ quarter: q.label, month: p.month, due: fmtDue(p.due), fixed_sum: p.fixedSum, self_estimate: p.selfAssessmentEstimate })));
}

async function buildGstWorkbook(db, orgId, fy) {
  const g = await computeQuarterly(db, orgId, fy);
  const wb = new ExcelJS.Workbook(); wb.creator = 'Glob ERP'; wb.created = new Date();

  // Sheet 1 — month by month
  const ws1 = wb.addWorksheet('Monthly GST', { properties: { tabColor: { argb: 'FF2E8B57' } } });
  const mrows = gstMonthlyRows(g);
  addTable(ws1, GST_MONTH_COLS, mrows);
  addTotalsRow(ws1, GST_MONTH_COLS, mrows, 'month');

  // Sheet 2 — quarter by quarter (what you actually file and pay)
  const ws2 = wb.addWorksheet('Quarterly GST (QRMP)', { properties: { tabColor: { argb: 'FFC0392B' } } });
  const qrows = gstQuarterRows(g);
  addTable(ws2, GST_QUARTER_COLS, qrows);
  addTotalsRow(ws2, GST_QUARTER_COLS, qrows, 'quarter', new Set(['opening_credit', 'closing_credit']));
  ws2.autoFilter = undefined;
  ws2.addRow([]);
  const t = ws2.addRow(['Monthly tax deposit (PMT-06) — first two months of every quarter, due by the 25th of the next month']);
  t.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND } };
  const pcols = [{ header: 'Quarter', key: 'quarter' }, { header: 'Month', key: 'month' }, { header: 'Due Date', key: 'due' }, { header: '35% Fixed-Sum Amount', key: 'fixed_sum' }, { header: 'Self-Assessment Estimate', key: 'self_estimate' }];
  styleHeaderRow(ws2.addRow(pcols.map(c => c.header)));
  gstPmtRows(g).forEach((r, i) => { const row = ws2.addRow(pcols.map(c => r[c.key])); styleDataRow(row, i, pcols); });
  ws2.addRow([]);
  [
    `Registration: GSTIN ${g.registration.gstin || '—'} · State code ${g.registration.stateCode} (category ${g.registration.category}) · ${g.registration.scheme}`,
    `GSTR-1 is due on the 13th and GSTR-3B on the ${g.registration.gstr3bDay}th of the month after each quarter. Tax for month 1 and 2 is paid via PMT-06 by the 25th.`,
    'Fixed-sum method = 35% of the cash tax paid in the previous quarter (only if the last return was filed quarterly). Self-assessment = estimate from your own bills, after available credit.',
    'ITC is set off per CGST Act §49 (IGST first, then CGST, then SGST; CGST and SGST credit never cross-pay). Credit carries forward between quarters.',
    'Figures are computed from the invoices and purchase bills recorded in Glob ERP. Please confirm with your CA before filing.',
  ].forEach(n => { const r = ws2.addRow([n]); r.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF5A6573' } }; });
  [12, 22, 18, 16, 16, 18, 16, 16, 16, 20, 20, 16, 16].forEach((w, i) => { ws2.getColumn(i + 1).width = w; });

  // Sheets 3+ — one sheet per month: sales invoices, then purchase bills
  const start = `${fy}-04-01`, end = `${fy + 1}-03-31`;
  const inv = normalizeRows(await db('invoices').where({ 'invoices.organization_id': orgId }).whereBetween('invoices.invoice_date', [start, end])
    .leftJoin('customers', 'invoices.customer_id', 'customers.id')
    .select('invoices.invoice_number as doc_no', 'invoices.invoice_date as date', 'customers.name as party', 'invoices.subtotal', 'invoices.cgst_amount', 'invoices.sgst_amount', 'invoices.igst_amount', 'invoices.total_amount', 'invoices.payment_status')
    .orderBy('invoices.invoice_date'));
  const pur = normalizeRows(await db('purchase_bills').where({ organization_id: orgId }).whereBetween('bill_date', [start, end])
    .select('bill_number as doc_no', 'bill_date as date', 'supplier_name as party', 'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'payment_status')
    .orderBy('bill_date'));
  const keys = [...new Set([...inv, ...pur].map(r => monthKeyOf(r.date)).filter(Boolean))].sort();
  const mk = (first, second) => [
    { header: first, key: 'doc_no' }, { header: 'Date', key: 'date' }, { header: second, key: 'party' },
    { header: 'Taxable Value', key: 'subtotal' }, { header: 'CGST', key: 'cgst_amount' }, { header: 'SGST', key: 'sgst_amount' }, { header: 'IGST', key: 'igst_amount' },
    { header: 'Total', key: 'total_amount' }, { header: 'Payment', key: 'payment_status' },
  ];
  const block = (ws, title, cols, rows) => {
    const tr = ws.addRow([title]); tr.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND } };
    styleHeaderRow(ws.addRow(cols.map(c => c.header)));
    rows.forEach((r, i) => { const row = ws.addRow(cols.map(c => r[c.key])); styleDataRow(row, i, cols); });
    if (rows.length) addTotalsRow(ws, cols, rows, 'doc_no');
    else { const e = ws.addRow(['No entries']); e.getCell(1).font = { italic: true, color: { argb: 'FF8A94A0' } }; }
    ws.addRow([]);
  };
  keys.forEach(k => {
    const ws = wb.addWorksheet(monthLabel(k), { properties: { tabColor: { argb: BRAND } } });
    block(ws, `Sales invoices — ${monthLabel(k)}`, mk('Invoice #', 'Customer'), inv.filter(r => monthKeyOf(r.date) === k));
    block(ws, `Purchase bills — ${monthLabel(k)}`, mk('Bill #', 'Supplier'), pur.filter(r => monthKeyOf(r.date) === k));
    [16, 14, 30, 16, 14, 14, 14, 16, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  });
  return { wb, g };
}

// ─── Export definitions: one place, drives both the .xlsx file and the JSON preview ──
const EXPORTS = {
  invoices: {
    label: 'Invoices',
    columns: [
      { header: 'Invoice #', key: 'invoice_number' },
      { header: 'Date', key: 'invoice_date' },
      { header: 'Customer', key: 'customer_name' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'CGST', key: 'cgst_amount' },
      { header: 'SGST', key: 'sgst_amount' },
      { header: 'IGST', key: 'igst_amount' },
      { header: 'Total', key: 'total_amount' },
      { header: 'Payment', key: 'payment_status' },
      { header: 'Status', key: 'status' },
    ],
    moneyKey: 'total_amount',
    dateKey: 'invoice_date',
    async fetch(db, orgId) {
      return db('invoices').where({ 'invoices.organization_id': orgId })
        .leftJoin('customers', 'invoices.customer_id', 'customers.id')
        .select('invoices.invoice_number', 'invoices.invoice_date', 'customers.name as customer_name',
          'invoices.subtotal', 'invoices.cgst_amount', 'invoices.sgst_amount', 'invoices.igst_amount',
          'invoices.total_amount', 'invoices.payment_status', 'invoices.status')
        .orderBy('invoices.invoice_date', 'desc');
    },
  },
  customers: {
    label: 'Customers',
    columns: [
      { header: 'Name', key: 'name' },
      { header: 'GSTIN', key: 'gstin' },
      { header: 'Phone', key: 'phone' },
      { header: 'Email', key: 'email' },
      { header: 'Address', key: 'address' },
      { header: 'City', key: 'city' },
      { header: 'State', key: 'state' },
      { header: 'Pincode', key: 'pincode' },
      { header: 'Contact Person', key: 'contact_person' },
      { header: 'Business Type', key: 'business_type' },
    ],
    moneyKey: null,
    dateKey: null,
    async fetch(db, orgId) {
      return db('customers').where({ organization_id: orgId })
        .select('name', 'gstin', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'contact_person', 'business_type')
        .orderBy('name');
    },
  },
  purchases: {
    label: 'Purchases',
    columns: [
      { header: 'Bill #', key: 'bill_number' },
      { header: 'Date', key: 'bill_date' },
      { header: 'Supplier', key: 'supplier_name' },
      { header: 'Supplier GSTIN', key: 'supplier_gstin' },
      { header: 'Subtotal', key: 'subtotal' },
      { header: 'CGST', key: 'cgst_amount' },
      { header: 'SGST', key: 'sgst_amount' },
      { header: 'IGST', key: 'igst_amount' },
      { header: 'Total', key: 'total_amount' },
      { header: 'Payment', key: 'payment_status' },
    ],
    moneyKey: 'total_amount',
    dateKey: 'bill_date',
    async fetch(db, orgId) {
      return db('purchase_bills').where({ organization_id: orgId })
        .select('bill_number', 'bill_date', 'supplier_name', 'supplier_gstin', 'subtotal',
          'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'payment_status')
        .orderBy('bill_date', 'desc');
    },
  },
  payments: {
    label: 'Payments',
    columns: [
      { header: 'Payment #', key: 'payment_number' },
      { header: 'Date', key: 'payment_date' },
      { header: 'Type', key: 'type' },
      { header: 'Customer', key: 'customer_name' },
      { header: 'Amount', key: 'amount' },
      { header: 'Mode', key: 'payment_mode' },
      { header: 'Reference', key: 'reference' },
      { header: 'Bank', key: 'bank_name' },
    ],
    moneyKey: 'amount',
    dateKey: 'payment_date',
    async fetch(db, orgId) {
      return db('payments').where({ 'payments.organization_id': orgId })
        .leftJoin('customers', 'payments.customer_id', 'customers.id')
        .select('payments.payment_number', 'payments.payment_date', 'payments.type', 'customers.name as customer_name',
          'payments.amount', 'payments.payment_mode', 'payments.reference', 'payments.bank_name')
        .orderBy('payments.payment_date', 'desc');
    },
  },
};

// ─── Routes ────────────────────────────────────────────────────────

// JSON preview — same data, same shape, powers the in-app table before download.
// ?fy=2026 limits to FY 2026-27, ?fy=all (default) = everything.
router.get('/:key/preview', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;

    if (req.params.key === 'gst-report') {
      const fy = parseFy(req.query.fy) ?? currentFyStart();
      const g = await computeQuarterly(db, orgId, fy);
      const rows = gstMonthlyRows(g);
      return res.json({
        success: true, label: `GST Report — ${fyLabel(fy)}`, fy,
        columns: GST_MONTH_COLS, rows,
        sections: [
          { title: 'Quarter-wise GST (what you file and pay)', columns: GST_QUARTER_COLS, rows: gstQuarterRows(g) },
          { title: 'Monthly tax deposit (PMT-06) — due 25th of next month', columns: [{ header: 'Quarter', key: 'quarter' }, { header: 'Month', key: 'month' }, { header: 'Due Date', key: 'due' }, { header: '35% Fixed-Sum Amount', key: 'fixed_sum' }, { header: 'Self-Assessment Estimate', key: 'self_estimate' }], rows: gstPmtRows(g) },
        ],
        registration: g.registration,
        insights: { count: rows.filter(r => r.sales_count || r.purchase_count).length, total: g.totals.payable, average: null, totalLabel: 'GST payable (cash)' },
      });
    }

    const exp = EXPORTS[req.params.key];
    if (!exp) return res.status(404).json({ success: false, msg: 'Unknown export' });
    const fy = parseFy(req.query.fy);
    const rows = await loadRows(exp, db, orgId, fy);
    const total = exp.moneyKey ? rows.reduce((s, r) => s + (Number(r[exp.moneyKey]) || 0), 0) : null;
    const sections = [];
    if (exp.dateKey) {
      const { monthly, quarterly } = summarize(rows, exp);
      const { cols } = summaryColumns(exp, 'Month');
      sections.push({ title: 'Month-wise', columns: cols, rows: monthly });
      sections.push({ title: 'Quarter-wise', columns: cols.map(c => c.key === 'period' ? { ...c, header: 'Quarter' } : c), rows: quarterly });
    }
    res.json({
      success: true, label: exp.label, fy,
      columns: exp.columns, rows, sections,
      insights: { count: rows.length, total, average: total !== null && rows.length ? total / rows.length : null },
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ success: false, msg: 'Preview failed' });
  }
});

// One route generates every .xlsx export — month-wise sheets for anything with a date
router.get('/:key.xlsx', auth, async (req, res) => {
  const key = req.params.key;
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const send = async (wb, name) => {
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
      res.send(buf);
    };

    if (key === 'gst-report') {
      if (!ExcelJS) return res.status(503).json({ success: false, msg: 'Excel library not installed on the server (run npm install in backend)' });
      const fy = parseFy(req.query.fy) ?? currentFyStart();
      const { wb } = await buildGstWorkbook(db, orgId, fy);
      return send(wb, `GST-Report_${fyLabel(fy).replace(/\s/g, '')}`);
    }

    const exp = EXPORTS[key];
    if (!exp) return res.status(404).json({ success: false, msg: 'Unknown export' });
    const fy = parseFy(req.query.fy);
    const rows = await loadRows(exp, db, orgId, fy);

    if (!ExcelJS) {
      const csv = toCsv(exp.columns, rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${key}.csv"`);
      return res.send(csv);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Glob ERP';
    wb.created = new Date();

    if (exp.dateKey) {
      addSummarySheet(wb, exp, rows, fy);                                   // 1. month-wise + quarter-wise totals
      const all = wb.addWorksheet(`All ${exp.label}`, { properties: { tabColor: { argb: BRAND } } });
      addTable(all, exp.columns, rows);                                      // 2. everything in one list
      if (exp.moneyKey) addTotalsRow(all, exp.columns, rows, exp.columns[0].key);
      addMonthSheets(wb, exp, rows);                                         // 3. one sheet per month
    } else {
      const ws = wb.addWorksheet(exp.label, { properties: { tabColor: { argb: BRAND } } });
      addTable(ws, exp.columns, rows);
      if (exp.moneyKey) addTotalsRow(ws, exp.columns, rows, exp.columns[0].key);
    }
    addInsightsSheet(wb, exp.label, rows, exp.moneyKey, exp.dateKey);

    await send(wb, `${key}${fy != null ? '_' + fyLabel(fy).replace(/\s/g, '') : ''}`);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, msg: 'Export failed' });
  }
});

module.exports = router;
