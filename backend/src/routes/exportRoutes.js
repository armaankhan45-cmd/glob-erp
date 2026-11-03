const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const { computeQuarterly, currentFy, MONTHS, QUARTER_RANGE, monthKeyFor } = require('../utils/gstQuarterly');

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
const CURRENCY_COLS = new Set(['subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'amount']);
const DATE_COLS = new Set(['invoice_date', 'bill_date', 'payment_date']);

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

function addTotalsRow(ws, columns, rows, labelKey) {
  if (!rows.length) return;
  const totals = {};
  columns.forEach(col => {
    if (CURRENCY_COLS.has(col.key)) {
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

// ─── Month-wise helpers ─────────────────────────────────────────────
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad2 = (n) => String(n).padStart(2, '0');
const monthLabelOf = (key) => `${MONTH_SHORT[parseInt(key.slice(5, 7), 10) - 1]} ${key.slice(0, 4)}`;
function monthKeyOf(v) {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}`;
  return String(v).slice(0, 7);
}
function quarterOfKey(key) { const m = parseInt(key.slice(5, 7), 10); return Math.floor((m >= 4 ? m - 4 : m + 8) / 3) + 1; }

// ?month=YYYY-MM → one month · ?fy=2026 → Apr 2026–Mar 2027 · neither → everything (still month-wise)
function parseRange(q) {
  const month = /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : null;
  const fy = parseInt(q.fy, 10) || null;
  if (month) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { scope: 'month', from: `${month}-01`, to: `${month}-${pad2(last)}`, tag: month, label: monthLabelOf(month), fy: null };
  }
  if (fy) return { scope: 'fy', from: `${fy}-04-01`, to: `${fy + 1}-03-31`, tag: `FY${fy}-${String(fy + 1).slice(2)}`, label: `FY ${fy}-${String(fy + 1).slice(2)}`, fy };
  return { scope: 'all', from: null, to: null, tag: 'all-time', label: 'All time', fy: null };
}
function applyRange(qb, col, range) {
  if (range?.from) qb.where(col, '>=', range.from);
  if (range?.to) qb.where(col, '<=', range.to);
  return qb;
}
function rowsByMonth(rows, dateKey) {
  const map = new Map();
  rows.forEach((r) => {
    const k = monthKeyOf(r[dateKey]);
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  map.forEach((list) => list.sort((a, b) => String(a[dateKey] instanceof Date ? a[dateKey].toISOString() : a[dateKey]).localeCompare(String(b[dateKey] instanceof Date ? b[dateKey].toISOString() : b[dateKey]))));
  return map;
}
function monthKeysFor(range, groups) {
  if (range.scope === 'fy') return Array.from({ length: 12 }, (_, i) => monthKeyFor(range.fy, i));
  if (range.scope === 'month') return [range.tag];
  return Array.from(groups.keys()).sort();
}
function sumKeys(rows, keys) {
  const out = {};
  keys.forEach((k) => { out[k] = rows.reduce((s, r) => s + (Number(r[k]) || 0), 0); });
  return out;
}
function monthlySummary(exp, rows, range) {
  const moneyKeys = exp.columns.filter((c) => CURRENCY_COLS.has(c.key)).map((c) => c.key);
  const groups = rowsByMonth(rows, exp.dateKey);
  return monthKeysFor(range, groups).map((key) => {
    const list = groups.get(key) || [];
    return { key, label: monthLabelOf(key), quarter: quarterOfKey(key), count: list.length, totals: sumKeys(list, moneyKeys) };
  });
}

function shadeRow(row, argb, bold = true) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold, color: { argb: 'FF1E3A5F' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER };
  });
}

// One workbook: a Summary sheet (every month, quarter sub-totals, grand total) + one sheet per month
function buildMonthWiseWorkbook(exp, rows, range) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Glob ERP'; wb.created = new Date();
  const moneyCols = exp.columns.filter((c) => CURRENCY_COLS.has(c.key));
  const showQuarter = range.scope === 'fy';
  const groups = rowsByMonth(rows, exp.dateKey);
  const keys = monthKeysFor(range, groups);

  const ws = wb.addWorksheet('Summary', { properties: { tabColor: { argb: BRAND } } });
  const width = 2 + (showQuarter ? 1 : 0) + moneyCols.length;
  ws.addRow([`${exp.label} — Month-wise Report (${range.label})`]);
  ws.mergeCells(1, 1, 1, Math.max(width, 3));
  ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.getRow(1).height = 26;
  ws.addRow([`Generated ${new Date().toLocaleDateString('en-IN')} · Financial year runs April to March`]);
  ws.getRow(2).getCell(1).font = { italic: true, color: { argb: 'FF6B7785' } };
  ws.addRow([]);
  const header = ['Month', ...(showQuarter ? ['Quarter'] : []), 'Records', ...moneyCols.map((c) => c.header)];
  const hr = ws.addRow(header);
  styleHeaderRow(hr);
  const fmtRow = (row, isMoneyFrom) => row.eachCell((cell, n) => {
    if (n >= isMoneyFrom) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
    if (n === isMoneyFrom - 1) { cell.numFmt = '0'; cell.alignment = { horizontal: 'center' }; }
  });
  const moneyFrom = 3 + (showQuarter ? 1 : 0);
  const grand = { count: 0, totals: Object.fromEntries(moneyCols.map((c) => [c.key, 0])) };
  let qAcc = null;
  keys.forEach((key, i) => {
    const list = groups.get(key) || [];
    const totals = sumKeys(list, moneyCols.map((c) => c.key));
    const row = ws.addRow([monthLabelOf(key), ...(showQuarter ? [`Q${quarterOfKey(key)}`] : []), list.length, ...moneyCols.map((c) => totals[c.key])]);
    fmtRow(row, moneyFrom);
    row.eachCell((cell) => { cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER }; if (list.length === 0) cell.font = { color: { argb: 'FF9AA5B1' } }; });
    grand.count += list.length;
    moneyCols.forEach((c) => { grand.totals[c.key] += totals[c.key]; });
    if (showQuarter) {
      if (!qAcc) qAcc = { count: 0, totals: Object.fromEntries(moneyCols.map((c) => [c.key, 0])) };
      qAcc.count += list.length;
      moneyCols.forEach((c) => { qAcc.totals[c.key] += totals[c.key]; });
      if (i % 3 === 2) {
        const qr = ws.addRow([`Quarter ${quarterOfKey(key)} total (${QUARTER_RANGE[quarterOfKey(key) - 1]})`, '', qAcc.count, ...moneyCols.map((c) => qAcc.totals[c.key])]);
        fmtRow(qr, moneyFrom); shadeRow(qr, 'FFE9EEF5');
        qr.eachCell((cell, n) => { if (n >= moneyFrom) cell.numFmt = MONEY_FMT; });
        qAcc = null;
      }
    }
  });
  const gr = ws.addRow(['GRAND TOTAL', ...(showQuarter ? [''] : []), grand.count, ...moneyCols.map((c) => grand.totals[c.key])]);
  fmtRow(gr, moneyFrom); shadeRow(gr, 'FFD6E0EE');
  gr.eachCell((cell, n) => { if (n >= moneyFrom) cell.numFmt = MONEY_FMT; });
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= width; c++) ws.getColumn(c).width = 18;
  ws.views = [{ state: 'frozen', ySplit: 4 }];

  keys.forEach((key) => {
    const list = groups.get(key);
    if (!list || !list.length) return;
    const sheet = wb.addWorksheet(monthLabelOf(key), { properties: { tabColor: { argb: 'FF3B82F6' } } });
    const cols = exp.columns.map((c) => ({ ...c }));
    addTable(sheet, cols, list);
    if (exp.moneyKey) addTotalsRow(sheet, cols, list, cols[0].key);
  });
  return wb;
}

// Quarterly GST workbook: summary by quarter, month-wise table, and the sales/purchase/credit-note registers
function buildQuarterlyWorkbook(data, sales, purchases, creditNotes) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Glob ERP'; wb.created = new Date();
  const dmy = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Sheet 1: Quarterly Summary ──
  const ws = wb.addWorksheet('Quarterly Summary', { properties: { tabColor: { argb: BRAND } } });
  ws.addRow([`Quarterly GST Report — FY ${data.fyLabel}`]);
  ws.mergeCells('A1:F1');
  ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.getRow(1).height = 26;
  ws.addRow([`Tax is settled once per quarter · quarterly return due on the ${data.dueDay}th of the month after each quarter · ${data.creditNotesApplied ? 'credit notes are deducted from output tax' : 'credit notes NOT applied'}`]);
  ws.mergeCells('A2:F2');
  ws.getRow(2).getCell(1).font = { italic: true, color: { argb: 'FF6B7785' } };
  ws.addRow([]);
  const hr = ws.addRow(['Particulars', ...data.quarters.map((q) => `${q.label} (${q.range})`), 'FY Total']);
  styleHeaderRow(hr);

  const section = (title) => { const r = ws.addRow([title]); ws.mergeCells(r.number, 1, r.number, 6); shadeRow(r, 'FFE9EEF5'); };
  const line = (label, get, { total = 'sum', kind = 'money', bold = false, fill = null } = {}) => {
    const vals = data.quarters.map(get);
    let tot = '';
    if (total === 'sum') tot = vals.reduce((a, b) => a + (Number(b) || 0), 0);
    else if (total === 'first') tot = vals[0];
    else if (total === 'last') tot = vals[3];
    const r = ws.addRow([label, ...vals, tot]);
    r.eachCell((cell, n) => {
      cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER };
      if (n > 1) {
        cell.alignment = { horizontal: 'right' };
        if (kind === 'money') cell.numFmt = MONEY_FMT; else if (kind === 'count') cell.numFmt = '0';
      }
      if (bold) cell.font = { bold: true };
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    });
    return r;
  };
  section('OUTPUT TAX — SALES');
  line('Sales invoices (count)', (q) => q.output.count, { kind: 'count' });
  line('Taxable sales (net of credit notes)', (q) => q.output.taxable);
  line('Output CGST', (q) => q.output.cgst);
  line('Output SGST', (q) => q.output.sgst);
  line('Output IGST', (q) => q.output.igst);
  line('TOTAL OUTPUT TAX', (q) => q.output.total, { bold: true, fill: 'FFF4F7FB' });
  line('  of which reduced by credit notes', (q) => q.creditNotes.total);
  section('INPUT TAX CREDIT — PURCHASES');
  line('Purchase bills (count)', (q) => q.input.count, { kind: 'count' });
  line('Taxable purchases', (q) => q.input.taxable);
  line('ITC — CGST', (q) => q.input.cgst);
  line('ITC — SGST', (q) => q.input.sgst);
  line('ITC — IGST', (q) => q.input.igst);
  line('TOTAL ITC AVAILABLE', (q) => q.input.total, { bold: true, fill: 'FFF4F7FB' });
  section('SET-OFF & PAYMENT');
  line('Credit brought forward from previous quarter', (q) => q.opening.total, { total: 'first' });
  line('Tax payable in cash — CGST', (q) => q.payable.cgst);
  line('Tax payable in cash — SGST', (q) => q.payable.sgst);
  line('Tax payable in cash — IGST', (q) => q.payable.igst);
  line('TOTAL TAX PAYABLE (CASH)', (q) => q.payable.total, { bold: true, fill: 'FFFDE8E8' });
  line('Credit carried forward to next quarter', (q) => q.closing.total, { total: 'last', bold: true, fill: 'FFE8F7EE' });
  const due = ws.addRow(['Return / payment due date', ...data.quarters.map((q) => dmy(q.dueDate)), '']);
  due.eachCell((cell, n) => { cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER }; if (n > 1) cell.alignment = { horizontal: 'right' }; });
  ws.addRow([]);
  const note = ws.addRow(['Set-off follows CGST Act §49 / Rule 88A (IGST credit first, CGST↔IGST and SGST↔IGST only; never CGST↔SGST). Due dates are the standard dates — check the GST portal for any extension. Verify against GSTR-3B before filing.']);
  ws.mergeCells(note.number, 1, note.number, 6);
  note.getCell(1).alignment = { wrapText: true, vertical: 'top' }; note.height = 44;
  note.getCell(1).font = { italic: true, color: { argb: 'FF6B7785' } };
  ws.getColumn(1).width = 46;
  for (let c = 2; c <= 6; c++) ws.getColumn(c).width = 19;
  ws.views = [{ state: 'frozen', ySplit: 4, xSplit: 1 }];

  // ── Sheet 2: Month-wise ──
  const wm = wb.addWorksheet('Month-wise', { properties: { tabColor: { argb: 'FF3B82F6' } } });
  const mcols = [
    { header: 'Month', key: 'month' }, { header: 'Quarter', key: 'quarter' },
    { header: 'Invoices', key: 'inv' }, { header: 'Taxable Sales', key: 'o_tax' },
    { header: 'Output CGST', key: 'o_c' }, { header: 'Output SGST', key: 'o_s' }, { header: 'Output IGST', key: 'o_i' }, { header: 'Total Output', key: 'o_t' },
    { header: 'Bills', key: 'bills' }, { header: 'Taxable Purchases', key: 'i_tax' },
    { header: 'ITC CGST', key: 'i_c' }, { header: 'ITC SGST', key: 'i_s' }, { header: 'ITC IGST', key: 'i_i' }, { header: 'Total ITC', key: 'i_t' },
  ];
  wm.columns = mcols;
  styleHeaderRow(wm.getRow(1));
  wm.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];
  const moneyKeys = new Set(['o_tax', 'o_c', 'o_s', 'o_i', 'o_t', 'i_tax', 'i_c', 'i_s', 'i_i', 'i_t']);
  const mrow = (label, q, o, i, bold, fill) => {
    const r = wm.addRow({ month: label, quarter: q, inv: o.count, o_tax: o.taxable, o_c: o.cgst, o_s: o.sgst, o_i: o.igst, o_t: o.total, bills: i.count, i_tax: i.taxable, i_c: i.cgst, i_s: i.sgst, i_i: i.igst, i_t: i.total });
    r.eachCell((cell, n) => {
      const key = mcols[n - 1].key;
      cell.border = { top: BORDER, left: BORDER, right: BORDER, bottom: BORDER };
      if (moneyKeys.has(key)) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
      if (bold) cell.font = { bold: true };
      if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    });
  };
  const zero = () => ({ taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 });
  const addH = (a, b) => ({ taxable: a.taxable + b.taxable, cgst: a.cgst + b.cgst, sgst: a.sgst + b.sgst, igst: a.igst + b.igst, total: a.total + b.total, count: a.count + b.count });
  let fyO = zero(), fyI = zero();
  data.quarters.forEach((q) => {
    q.months.forEach((m) => mrow(`${m.fullName} ${m.key.slice(0, 4)}`, q.label, m.output, m.input, false, null));
    mrow(`${q.label} total`, '', q.output, q.input, true, 'FFE9EEF5');
    fyO = addH(fyO, q.output); fyI = addH(fyI, q.input);
  });
  mrow('FY TOTAL', '', fyO, fyI, true, 'FFD6E0EE');
  mcols.forEach((c, i) => { wm.getColumn(i + 1).width = i === 0 ? 24 : 16; });

  // ── Registers ──
  const regCols = (first) => [
    { header: 'Quarter', key: 'quarter' }, { header: 'Month', key: 'month' },
    { header: first.header, key: first.key }, { header: 'Date', key: first.date },
    { header: first.party, key: 'party' }, { header: 'GSTIN', key: 'gstin' },
    { header: 'Taxable', key: 'subtotal' }, { header: 'CGST', key: 'cgst_amount' }, { header: 'SGST', key: 'sgst_amount' },
    { header: 'IGST', key: 'igst_amount' }, { header: 'Total', key: 'total_amount' },
  ];
  const decorate = (list, dateKey) => list.map((r) => { const k = monthKeyOf(r[dateKey]); return { ...r, quarter: k ? `Q${quarterOfKey(k)}` : '', month: k ? monthLabelOf(k) : '' }; });
  const addRegister = (name, cols, list, dateKey, labelKey, tab) => {
    const sheet = wb.addWorksheet(name, { properties: { tabColor: { argb: tab } } });
    const rows = decorate(list, dateKey);
    addTable(sheet, cols, rows);
    if (rows.length) addTotalsRow(sheet, cols, rows, labelKey);
  };
  const salesCols = regCols({ header: 'Invoice #', key: 'invoice_number', date: 'invoice_date', party: 'Customer' });
  addRegister('Sales Register', salesCols, sales, 'invoice_date', 'quarter', 'FF1E9E5A');
  const purCols = regCols({ header: 'Bill #', key: 'bill_number', date: 'bill_date', party: 'Supplier' });
  addRegister('Purchase Register', purCols, purchases, 'bill_date', 'quarter', 'FFF97316');
  if (creditNotes.length) {
    const cnCols = regCols({ header: 'Credit Note #', key: 'credit_note_number', date: 'credit_date', party: 'Customer' });
    addRegister('Credit Notes', cnCols, creditNotes, 'credit_date', 'quarter', 'FFEF4444');
  }
  return wb;
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
    async fetch(db, orgId, range) {
      return db('invoices').where({ 'invoices.organization_id': orgId }).whereRaw("COALESCE(invoices.status, '') NOT ILIKE 'cancel%'").modify(qb => applyRange(qb, 'invoices.invoice_date', range))
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
    async fetch(db, orgId, range) {
      return db('purchase_bills').where({ organization_id: orgId }).modify(qb => applyRange(qb, 'bill_date', range))
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
    async fetch(db, orgId, range) {
      return db('payments').where({ 'payments.organization_id': orgId }).modify(qb => applyRange(qb, 'payments.payment_date', range))
        .leftJoin('customers', 'payments.customer_id', 'customers.id')
        .select('payments.payment_number', 'payments.payment_date', 'payments.type', 'customers.name as customer_name',
          'payments.amount', 'payments.payment_mode', 'payments.reference', 'payments.bank_name')
        .orderBy('payments.payment_date', 'desc');
    },
  },
};

// ─── Routes ────────────────────────────────────────────────────────

// Quarterly GST workbook (Indian FY, tax settled per quarter) — must be registered before /:key.xlsx
router.get('/gst-quarterly.xlsx', auth, async (req, res) => {
  try {
    if (!ExcelJS) return res.status(501).json({ success: false, msg: 'Excel library not installed on the server yet' });
    const db = getDb();
    const orgId = req.user.organization_id;
    const fy = parseInt(req.query.fy, 10) || currentFy();
    const data = await computeQuarterly(db, orgId, fy, { creditNotes: req.query.cn !== '0' });
    const from = `${fy}-04-01`, to = `${fy + 1}-03-31`;

    const sales = await db('invoices').where({ 'invoices.organization_id': orgId })
      .whereBetween('invoices.invoice_date', [from, to]).whereRaw("COALESCE(invoices.status, '') NOT ILIKE 'cancel%'")
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.invoice_number', 'invoices.invoice_date', 'customers.name as party', 'customers.gstin as gstin',
        'invoices.subtotal', 'invoices.cgst_amount', 'invoices.sgst_amount', 'invoices.igst_amount', 'invoices.total_amount')
      .orderBy('invoices.invoice_date');
    const purchases = await db('purchase_bills').where({ organization_id: orgId }).whereBetween('bill_date', [from, to])
      .select('bill_number', 'bill_date', 'supplier_name as party', 'supplier_gstin as gstin',
        'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount')
      .orderBy('bill_date');
    let creditNotes = [];
    if (data.creditNotesApplied) {
      try {
        creditNotes = await db('credit_notes').where({ 'credit_notes.organization_id': orgId }).whereBetween('credit_notes.credit_date', [from, to])
          .leftJoin('customers', 'credit_notes.customer_id', 'customers.id')
          .select('credit_notes.credit_note_number', 'credit_notes.credit_date', 'customers.name as party', 'customers.gstin as gstin',
            'credit_notes.subtotal', 'credit_notes.cgst_amount', 'credit_notes.sgst_amount', 'credit_notes.igst_amount', 'credit_notes.total_amount')
          .orderBy('credit_notes.credit_date');
      } catch (e) { creditNotes = []; }
    }

    const wb = buildQuarterlyWorkbook(data, sales, purchases, creditNotes);
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="gst-quarterly-FY${data.fyLabel}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('Quarterly export error:', err);
    res.status(500).json({ success: false, msg: 'Export failed' });
  }
});

// JSON preview — same data, same shape, powers the in-app table before download
router.get('/:key/preview', auth, async (req, res) => {
  const exp = EXPORTS[req.params.key];
  if (!exp) return res.status(404).json({ success: false, msg: 'Unknown export' });
  try {
    const db = getDb();
    const range = exp.dateKey ? parseRange(req.query) : parseRange({});
    const rows = await exp.fetch(db, req.user.organization_id, range);
    const total = exp.moneyKey ? rows.reduce((s, r) => s + (Number(r[exp.moneyKey]) || 0), 0) : null;
    res.json({
      success: true,
      label: exp.label,
      columns: exp.columns,
      rows,
      range: { scope: range.scope, label: range.label },
      monthly: exp.dateKey ? monthlySummary(exp, rows, range) : [],
      insights: {
        count: rows.length,
        total,
        average: total !== null && rows.length ? total / rows.length : null,
      },
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ success: false, msg: 'Preview failed' });
  }
});

// One route generates every .xlsx export — month-wise (Summary sheet + one sheet per month)
router.get('/:key.xlsx', auth, async (req, res) => {
  const exp = EXPORTS[req.params.key];
  if (!exp) return res.status(404).json({ success: false, msg: 'Unknown export' });
  try {
    const db = getDb();
    const range = exp.dateKey ? parseRange(req.query) : parseRange({});
    const rows = await exp.fetch(db, req.user.organization_id, range);
    const fileTag = exp.dateKey ? `-${range.tag}` : '';

    if (!ExcelJS) {
      // Fallback path — no styling, but never a hard failure
      const csv = toCsv(exp.columns, rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.key}${fileTag}.csv"`);
      return res.send(csv);
    }

    let wb;
    if (exp.dateKey) {
      wb = buildMonthWiseWorkbook(exp, rows, range);
    } else {
      wb = new ExcelJS.Workbook();
      wb.creator = 'Glob ERP';
      wb.created = new Date();
      const ws = wb.addWorksheet(exp.label, { properties: { tabColor: { argb: BRAND } } });
      addTable(ws, exp.columns, rows);
    }

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.key}${fileTag}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, msg: 'Export failed' });
  }
});

module.exports = router;
