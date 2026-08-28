const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

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

// JSON preview — same data, same shape, powers the in-app table before download
router.get('/:key/preview', auth, async (req, res) => {
  const exp = EXPORTS[req.params.key];
  if (!exp) return res.status(404).json({ success: false, msg: 'Unknown export' });
  try {
    const db = getDb();
    const rows = await exp.fetch(db, req.user.organization_id);
    const total = exp.moneyKey ? rows.reduce((s, r) => s + (Number(r[exp.moneyKey]) || 0), 0) : null;
    res.json({
      success: true,
      label: exp.label,
      columns: exp.columns,
      rows,
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

// One route generates every .xlsx export from the same EXPORTS definition
router.get('/:key.xlsx', auth, async (req, res) => {
  const exp = EXPORTS[req.params.key];
  if (!exp) return res.status(404).json({ success: false, msg: 'Unknown export' });
  try {
    const db = getDb();
    const rows = await exp.fetch(db, req.user.organization_id);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Glob ERP';
    wb.created = new Date();

    const ws = wb.addWorksheet(exp.label, { properties: { tabColor: { argb: BRAND } } });
    addTable(ws, exp.columns, rows);
    if (exp.moneyKey) addTotalsRow(ws, exp.columns, rows, exp.columns[0].key);
    addInsightsSheet(wb, exp.label, rows, exp.moneyKey, exp.dateKey);

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.key}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, msg: 'Export failed' });
  }
});

module.exports = router;
