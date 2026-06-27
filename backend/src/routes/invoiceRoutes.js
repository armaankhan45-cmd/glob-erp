const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

function getFY(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  if (m < 3) return `${(y - 1) % 100}-${y % 100}`;
  return `${y % 100}-${(y + 1) % 100}`;
}

// List invoices
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { status, search, from, to } = req.query;
    let query = db('invoices')
      .where({ 'invoices.organization_id': req.user.organization_id })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.*', 'customers.name as customer_name');

    if (status && status !== 'All') query = query.where('invoices.status', status);
    if (search) query = query.where(function() {
      this.where('invoices.invoice_number', 'ilike', `%${search}%`)
        .orWhere('customers.name', 'ilike', `%${search}%`);
    });
    if (from) query = query.where('invoices.invoice_date', '>=', from);
    if (to) query = query.where('invoices.invoice_date', '<=', to);

    const invoices = await query.orderBy('invoices.created_at', 'desc');
    
    // Stats
    const stats = await db('invoices')
      .where({ organization_id: req.user.organization_id })
      .select(
        db.raw('COUNT(*) as total_bills'),
        db.raw('COALESCE(SUM(total_amount), 0) as total_amount'),
        db.raw("COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END), 0) as total_paid"),
        db.raw("COALESCE(SUM(CASE WHEN payment_status != 'Paid' THEN total_amount ELSE 0 END), 0) as outstanding")
      ).first();

    res.json({ success: true, invoices, stats });
  } catch (err) {
    console.error('List invoices error:', err);
    res.status(500).json({ success: false, msg: 'Failed to fetch invoices', invoices: [], stats: {} });
  }
});

// Get single invoice with items
router.get('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices')
      .where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.*', 'customers.name as customer_name', 'customers.gstin as customer_gstin', 
        'customers.address as customer_address', 'customers.city as customer_city',
        'customers.state as customer_state', 'customers.state_code as customer_state_code',
        'customers.pincode as customer_pincode', 'customers.phone as customer_phone')
      .first();
    
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    
    const items = await db('invoice_items').where({ invoice_id: invoice.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    
    res.json({ success: true, invoice, items, organization: org });
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Create invoice
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...invoiceData } = req.body;
    const orgId = req.user.organization_id;

    // Generate invoice number
    const org = await db('organizations').where({ id: orgId }).first();
    const prefix = org.invoice_prefix || 'GST-';
    const last = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY(new Date(invoiceData.invoice_date));
    const invoiceNumber = `${prefix}${String(nextNo).padStart(4, '0')}/${fy}`;

    const data = {
      ...invoiceData,
      organization_id: orgId,
      invoice_number: invoiceNumber
    };

    const [invoice] = await db('invoices').insert(data).returning('id');
    const invoiceId = invoice.id || invoice;

    // Insert items
    if (items && items.length > 0) {
      const itemRows = items.map(item => ({ ...item, invoice_id: invoiceId }));
      await db('invoice_items').insert(itemRows);
    }

    await auditLog(req.user.id, orgId, 'CREATE', 'invoices', invoiceId, null, data, req.ip);

    res.status(201).json({ success: true, invoice: { id: invoiceId, invoice_number: invoiceNumber } });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ success: false, msg: 'Failed to create invoice: ' + err.message });
  }
});

// Full update with items
router.put('/:id/full', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...invoiceData } = req.body;
    const orgId = req.user.organization_id;

    const old = await db('invoices').where({ id: req.params.id, organization_id: orgId }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Invoice not found' });

    await db('invoices').where({ id: req.params.id }).update(invoiceData);

    // Replace items
    await db('invoice_items').where({ invoice_id: req.params.id }).del();
    if (items && items.length > 0) {
      const itemRows = items.map(item => ({ ...item, invoice_id: req.params.id }));
      await db('invoice_items').insert(itemRows);
    }

    await auditLog(req.user.id, orgId, 'UPDATE', 'invoices', req.params.id, old, invoiceData, req.ip);

    res.json({ success: true, msg: 'Invoice updated' });
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ success: false, msg: 'Failed to update' });
  }
});

// Simple update
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const old = await db('invoices').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Invoice not found' });

    await db('invoices').where({ id: req.params.id }).update(req.body);
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'invoices', req.params.id, old, req.body, req.ip);

    res.json({ success: true, msg: 'Invoice updated' });
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Delete invoice
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });

    await db('invoice_items').where({ invoice_id: req.params.id }).del();
    await db('invoices').where({ id: req.params.id }).del();
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'invoices', req.params.id, invoice, null, req.ip);

    res.json({ success: true, msg: 'Invoice deleted' });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ success: false, msg: 'Failed to delete' });
  }
});

// Generate PDF
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices')
      .where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id })
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .select('invoices.*', 'customers.name as customer_name', 'customers.gstin as customer_gstin',
        'customers.address as customer_address', 'customers.city as customer_city',
        'customers.state as customer_state', 'customers.state_code as customer_state_code',
        'customers.pincode as customer_pincode')
      .first();
    
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    
    const items = await db('invoice_items').where({ invoice_id: invoice.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();

    // Generate HTML for PDF
    const html = generateInvoiceHTML(invoice, items, org);

    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
      res.send(pdf);
    } catch (puppeteerErr) {
      // If puppeteer fails, return HTML
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ success: false, msg: 'PDF generation failed' });
  }
});

function formatIndian(num) {
  if (num === null || num === undefined || isNaN(num)) return '0/-';
  const n = parseFloat(num);
  const isWhole = n === Math.floor(n);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2
  }).format(n);
  return formatted + '/-';
}

function generateInvoiceHTML(invoice, items, org) {
  function numberToWords(num) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function inW(n) {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : '');
      if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+inW(n%100) : '');
      if (n < 100000) return inW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+inW(n%1000) : '');
      if (n < 10000000) return inW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+inW(n%100000) : '');
      return inW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+inW(n%10000000) : '');
    }
    const rupees = Math.round(Math.floor(num));
    const paise = Math.round((num - Math.floor(num)) * 100);
    let result = inW(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + inW(paise) + ' Paise';
    return result + ' Only';
  }

  const invNum = (invoice.invoice_number || '').split('/')[0];
  const hasCGST = parseFloat(invoice.cgst_amount) > 0;
  const hasIGST = parseFloat(invoice.igst_amount) > 0;
  const custStateCode = invoice.customer_state_code || (invoice.customer_gstin ? invoice.customer_gstin.substring(0,2) : '');
  const orgStateCode = org.state_code || '27';
  const placeOfSupply = custStateCode ? `${custStateCode}-${invoice.customer_state || ''}` : `${orgStateCode}-${org.state || ''}`;

  // HSN summary — use qty*rate as taxable, NOT item.amount
  const hsnMap = {};
  items.forEach(item => {
    const hsn = item.hsn_code || 'Others';
    if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 };
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxable = qty * rate;
    hsnMap[hsn].taxable += taxable;
    hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0;
    hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0;
    hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0;
    hsnMap[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100;
    hsnMap[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100;
    hsnMap[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100;
  });

  const itemsHTML = items.map((item, i) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxable = qty * rate;
    const taxRate = (parseFloat(item.igst_rate) || 0) > 0 ? parseFloat(item.igst_rate) : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate));
    const taxAmt = taxable * taxRate / 100;
    return `<tr>
      <td style="border:1px solid #000;padding:2px;text-align:center;vertical-align:top">${i+1}</td>
      <td style="border:1px solid #000;padding:2px;line-height:1.25;white-space:pre-line">${item.description || ''}</td>
      <td style="border:1px solid #000;padding:2px;text-align:center;vertical-align:top">${item.hsn_code || '-'}</td>
      <td style="border:1px solid #000;padding:2px;text-align:center;vertical-align:top">${taxRate > 0 ? taxRate + '%' : ''}</td>
      <td style="border:1px solid #000;padding:2px;text-align:center;vertical-align:top">${qty} ${item.unit || 'NOS'}</td>
      <td style="border:1px solid #000;padding:2px;text-align:right;vertical-align:top">${formatIndian(rate)}</td>
      <td style="border:1px solid #000;padding:2px;text-align:right;vertical-align:top">${formatIndian(taxable)}</td>
      <td style="border:1px solid #000;padding:2px;text-align:right;vertical-align:top">${formatIndian(taxAmt)}</td>
      <td style="border:1px solid #000;padding:2px;text-align:right;font-weight:bold;vertical-align:top">${formatIndian(taxable + taxAmt)}</td>
    </tr>`;
  }).join('');

  // Empty rows to fill space
  const emptyRows = items.length < 12 ? Array.from({length: 12 - items.length}).map((_, i) => 
    `<tr style="height:18px"><td style="border:1px solid #000;padding:2px">&nbsp;</td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td></tr>`
  ).join('') : '';

  let hsnRows = '';
  Object.entries(hsnMap).forEach(([hsn, data]) => {
    hsnRows += `<tr>
      <td style="border:1px solid #000;padding:2px 3px;text-align:center">${hsn}</td>
      <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(data.taxable)}</td>
      ${hasCGST ? `
        <td style="border:1px solid #000;padding:2px 3px;text-align:center">${data.cgstRate}%</td>
        <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(data.cgstAmt)}</td>
        <td style="border:1px solid #000;padding:2px 3px;text-align:center">${data.sgstRate}%</td>
        <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(data.sgstAmt)}</td>
      ` : `
        <td style="border:1px solid #000;padding:2px 3px;text-align:center">${data.igstRate}%</td>
        <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(data.igstAmt)}</td>
      `}
      <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(data.cgstAmt + data.sgstAmt + data.igstAmt)}</td>
    </tr>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; }
    .page { width: 210mm; height: 297mm; display: flex; flex-direction: column; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 3px 2px; background: #f0f0f0; text-align: center; font-size: 8pt; }
  </style></head><body>
    <div class="page">
      <!-- Company Header -->
      <div style="border:2px solid #000;padding:6px 10px;flex-shrink:0;display:flex;align-items:center">
        <div style="width:60px;height:60px;border:1px solid #999;display:flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0">
          ${org.logo_url ? `<img src="${org.logo_url}" style="max-width:54px;max-height:54px">` : '<span style="font-size:7px;color:#999">LOGO</span>'}
        </div>
        <div style="flex:1">
          <div style="font-size:15pt;font-weight:bold;letter-spacing:0.5px;color:#111">${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
          <div style="font-size:8.5pt;color:#333;margin-top:1px">${org.address || ''}${org.city ? ', ' + org.city : ''}${org.state ? ', ' + org.state : ''}${org.pincode ? ' - ' + org.pincode : ''}</div>
          <div style="display:flex;gap:16px;margin-top:2px;font-size:8pt;color:#444;flex-wrap:wrap">
            ${org.gstin ? `<span><strong>GSTIN:</strong> ${org.gstin}</span>` : ''}
            ${org.phone ? `<span><strong>Mobile:</strong> ${org.phone}</span>` : ''}
            ${org.email ? `<span><strong>Email:</strong> ${org.email}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Tax Invoice Title -->
      <div style="text-align:center;padding:3px 0;border-top:1px solid #000;border-bottom:2px solid #000;flex-shrink:0">
        <div style="font-size:12pt;font-weight:bold;letter-spacing:1.5px">TAX INVOICE</div>
        <div style="font-size:7pt;font-weight:bold;color:#555">ORIGINAL FOR RECIPIENT</div>
      </div>

      <!-- Invoice + Customer Info -->
      <div style="display:flex;border-bottom:1px solid #000;flex-shrink:0">
        <div style="width:38%;border-right:1px solid #000;padding:4px 8px;font-size:8pt">
          <div style="margin-bottom:1px"><strong>Invoice #:</strong> ${invNum}</div>
          <div style="margin-bottom:1px"><strong>Date:</strong> ${invoice.invoice_date}</div>
          ${invoice.due_date ? `<div style="margin-bottom:1px"><strong>Due Date:</strong> ${invoice.due_date}</div>` : ''}
          <div style="margin-bottom:1px"><strong>Place of Supply:</strong> ${placeOfSupply}</div>
        </div>
        <div style="width:62%;padding:4px 8px;font-size:8pt">
          <div style="font-weight:bold;margin-bottom:1px">Customer Details:</div>
          <div style="font-weight:bold;text-transform:uppercase;font-size:8.5pt">${(invoice.customer_name || '').toUpperCase()}</div>
          ${invoice.customer_gstin ? `<div><strong>GSTIN:</strong> ${invoice.customer_gstin}</div>` : ''}
          <div><strong>Billing:</strong> ${invoice.customer_address || ''}${invoice.customer_city ? ', ' + invoice.customer_city : ''}${invoice.customer_state ? ', ' + invoice.customer_state : ''}${invoice.customer_pincode ? ' - ' + invoice.customer_pincode : ''}</div>
        </div>
      </div>

      <!-- Items Table (fills space) -->
      <div style="flex:1;display:flex;flex-direction:column">
        <table style="font-size:8pt;flex:1">
          <thead><tr>
            <th style="width:4%">#</th><th style="width:28%">Item</th><th style="width:8%">HSN</th>
            <th style="width:6%">Tax</th><th style="width:8%">Qty</th><th style="width:11%">Rate</th>
            <th style="width:13%">Taxable Val</th><th style="width:10%">Tax Amt</th><th style="width:12%">Amount</th>
          </tr></thead>
          <tbody>${itemsHTML}${emptyRows}</tbody>
        </table>

        <!-- Totals -->
        <table style="font-size:8.5pt;flex-shrink:0">
          <tr><td style="border:1px solid #000;padding:3px;text-align:right;width:70%">Taxable Amount</td><td style="border:1px solid #000;padding:3px;text-align:right">${formatIndian(invoice.subtotal)}</td></tr>
          ${hasCGST ? `
            <tr><td style="border:1px solid #000;padding:3px;text-align:right">CGST @ ${parseFloat(items[0]?.cgst_rate||0).toFixed(1)}%</td><td style="border:1px solid #000;padding:3px;text-align:right">${formatIndian(invoice.cgst_amount)}</td></tr>
            <tr><td style="border:1px solid #000;padding:3px;text-align:right">SGST @ ${parseFloat(items[0]?.sgst_rate||0).toFixed(1)}%</td><td style="border:1px solid #000;padding:3px;text-align:right">${formatIndian(invoice.sgst_amount)}</td></tr>
          ` : ''}
          ${hasIGST ? `<tr><td style="border:1px solid #000;padding:3px;text-align:right">IGST @ ${parseFloat(items[0]?.igst_rate||0).toFixed(1)}%</td><td style="border:1px solid #000;padding:3px;text-align:right">${formatIndian(invoice.igst_amount)}</td></tr>` : ''}
          ${parseFloat(invoice.round_off) !== 0 ? `<tr><td style="border:1px solid #000;padding:3px;text-align:right">Round Off</td><td style="border:1px solid #000;padding:3px;text-align:right">${formatIndian(invoice.round_off)}</td></tr>` : ''}
          <tr style="background:#f0f0f0"><td style="border:2px solid #000;padding:4px;text-align:right;font-size:10pt"><strong>Total</strong></td><td style="border:2px solid #000;padding:4px;text-align:right;font-size:10pt;font-weight:bold">₹${formatIndian(invoice.total_amount)}</td></tr>
        </table>
      </div>

      <!-- Amount in Words -->
      <div style="padding:3px 0;font-size:8pt;flex-shrink:0">
        <strong>Amount Chargeable (in words):</strong> INR ${numberToWords(invoice.total_amount)}
        <span style="float:right;font-size:7pt;color:#666">E & O.E</span>
      </div>

      <!-- HSN Summary -->
      <table style="font-size:7.5pt;flex-shrink:0">
        <thead>
          <tr style="background:#f0f0f0"><th>HSN/SAC</th><th>Taxable Value</th>
            ${hasCGST ? '<th colspan="2">Central Tax</th><th colspan="2">State/UT Tax</th>' : '<th colspan="2">Integrated Tax</th>'}
            <th>Total Tax</th>
          </tr>
          <tr style="font-size:6.5pt"><th></th><th></th>
            ${hasCGST ? '<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>' : '<th>Rate</th><th>Amount</th>'}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${hsnRows}
          <tr style="font-weight:bold;background:#f8f8f8">
            <td style="border:1px solid #000;padding:1px 2px;text-align:center">TOTAL</td>
            <td style="border:1px solid #000;padding:1px 2px;text-align:right">${formatIndian(invoice.subtotal)}</td>
            ${hasCGST ? `
              <td style="border:1px solid #000;padding:1px 2px"></td>
              <td style="border:1px solid #000;padding:1px 2px;text-align:right">${formatIndian(invoice.cgst_amount)}</td>
              <td style="border:1px solid #000;padding:1px 2px"></td>
              <td style="border:1px solid #000;padding:1px 2px;text-align:right">${formatIndian(invoice.sgst_amount)}</td>
            ` : `
              <td style="border:1px solid #000;padding:1px 2px"></td>
              <td style="border:1px solid #000;padding:1px 2px;text-align:right">${formatIndian(invoice.igst_amount)}</td>
            `}
            <td style="border:1px solid #000;padding:1px 2px;text-align:right">${formatIndian(parseFloat(invoice.cgst_amount) + parseFloat(invoice.sgst_amount) + parseFloat(invoice.igst_amount))}</td>
          </tr>
        </tbody>
      </table>

      <!-- Bank + Signature -->
      <div style="display:flex;border-top:1px solid #000;padding-top:3px;margin-top:3px;flex-shrink:0">
        <div style="width:55%;font-size:7.5pt;padding-right:8px">
          <div style="font-weight:bold;margin-bottom:2px">Bank Details:</div>
          ${org.bank_name ? `<div><strong>Bank:</strong> ${org.bank_name}</div>` : ''}
          ${org.account_no ? `<div><strong>A/C:</strong> ${org.account_no}</div>` : ''}
          ${org.ifsc ? `<div><strong>IFSC:</strong> ${org.ifsc}</div>` : ''}
          ${org.upi_id ? `<div><strong>UPI:</strong> ${org.upi_id}</div>` : ''}
        </div>
        <div style="width:45%;text-align:right;font-size:7.5pt">
          <div>For <strong>${(org.name || '').toUpperCase()}</strong></div>
          <div style="height:25px"></div>
          <div style="border-top:1px solid #000;display:inline-block;padding-top:1px">Authorized Signatory</div>
        </div>
      </div>
    </div>
  </body></html>`;
}

module.exports = router;
