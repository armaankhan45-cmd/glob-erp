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
    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);
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

  // HSN summary
  const hsnMap = {};
  items.forEach(item => {
    const hsn = item.hsn_code || 'Others';
    if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 };
    const amt = parseFloat(item.amount) || 0;
    hsnMap[hsn].taxable += amt;
    hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0;
    hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0;
    hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0;
    hsnMap[hsn].cgstAmt += amt * (parseFloat(item.cgst_rate) || 0) / 100;
    hsnMap[hsn].sgstAmt += amt * (parseFloat(item.sgst_rate) || 0) / 100;
    hsnMap[hsn].igstAmt += amt * (parseFloat(item.igst_rate) || 0) / 100;
  });

  const itemsHTML = items.map((item, i) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxable = qty * rate;
    const taxRate = (parseFloat(item.igst_rate) || 0) > 0 ? parseFloat(item.igst_rate) : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate));
    const taxAmt = taxable * taxRate / 100;
    return `<tr>
      <td style="border:1px solid #000;padding:3px;text-align:center;vertical-align:top">${i+1}</td>
      <td style="border:1px solid #000;padding:3px;line-height:1.3;white-space:pre-line">${item.description || ''}</td>
      <td style="border:1px solid #000;padding:3px;text-align:center;vertical-align:top">${item.hsn_code || '-'}</td>
      <td style="border:1px solid #000;padding:3px;text-align:center;vertical-align:top">${taxRate > 0 ? taxRate + '%' : ''}</td>
      <td style="border:1px solid #000;padding:3px;text-align:center;vertical-align:top">${qty} ${item.unit || 'NOS'}</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;vertical-align:top">${formatIndian(rate)}</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;vertical-align:top">${formatIndian(taxable)}</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;vertical-align:top">${formatIndian(taxAmt)}</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;font-weight:bold;vertical-align:top">${formatIndian(taxable + taxAmt)}</td>
    </tr>`;
  }).join('');

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
    .page { width: 210mm; min-height: 297mm; padding: 8mm 10mm; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 4px 3px; background: #f0f0f0; text-align: center; }
  </style></head><body>
    <div class="page">
      <!-- Company Header -->
      <div style="border:2px solid #000;padding:8px 12px;margin-bottom:6px;display:flex;align-items:center">
        <div style="width:70px;height:70px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;margin-right:14px;flex-shrink:0">
          ${org.logo_url ? `<img src="${org.logo_url}" style="max-width:64px;max-height:64px">` : '<span style="font-size:8px;color:#999">LOGO</span>'}
        </div>
        <div style="flex:1">
          <h1 style="font-size:16pt;font-weight:bold;margin:0;letter-spacing:0.5px">${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</h1>
          <p style="font-size:9pt;margin:2px 0 0;color:#333">${org.address || ''}${org.city ? ', ' + org.city : ''}${org.state ? ', ' + org.state : ''}${org.pincode ? ' - ' + org.pincode : ''}</p>
          <div style="display:flex;gap:20px;margin-top:3px;font-size:8.5pt;color:#444">
            ${org.gstin ? `<span><strong>GSTIN:</strong> ${org.gstin}</span>` : ''}
            ${org.phone ? `<span><strong>Mobile:</strong> ${org.phone}</span>` : ''}
            ${org.email ? `<span><strong>Email:</strong> ${org.email}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Tax Invoice Heading -->
      <div style="text-align:center;margin:6px 0">
        <h2 style="font-size:14pt;font-weight:bold;margin:0;letter-spacing:1px">TAX INVOICE</h2>
        <p style="font-size:8pt;margin:2px 0 0;font-weight:bold;color:#555">ORIGINAL FOR RECIPIENT</p>
      </div>

      <!-- Invoice Info + Customer -->
      <div style="display:flex;border:1px solid #000;margin-bottom:6px">
        <div style="width:40%;border-right:1px solid #000;padding:6px 10px;font-size:8.5pt">
          <div style="margin-bottom:3px"><strong>Invoice #:</strong> ${invNum}</div>
          <div style="margin-bottom:3px"><strong>Invoice Date:</strong> ${invoice.invoice_date}</div>
          <div style="margin-bottom:3px"><strong>Due Date:</strong> ${invoice.due_date || '-'}</div>
          <div style="margin-bottom:3px"><strong>Place of Supply:</strong> ${placeOfSupply}</div>
        </div>
        <div style="width:60%;padding:6px 10px;font-size:8.5pt">
          <div style="font-weight:bold;margin-bottom:3px">Customer Details:</div>
          <div style="font-weight:bold;text-transform:uppercase;font-size:9pt">${(invoice.customer_name || '').toUpperCase()}</div>
          ${invoice.customer_gstin ? `<div><strong>GSTIN:</strong> ${invoice.customer_gstin}</div>` : ''}
          <div><strong>Billing Address:</strong> ${invoice.customer_address || ''}${invoice.customer_city ? ', ' + invoice.customer_city : ''}${invoice.customer_state ? ', ' + invoice.customer_state : ''}${invoice.customer_pincode ? ' - ' + invoice.customer_pincode : ''}</div>
          ${invoice.customer_phone ? `<div><strong>Ph:</strong> ${invoice.customer_phone}</div>` : ''}
        </div>
      </div>

      <!-- Items Table -->
      <table style="font-size:8.5pt;margin-bottom:0">
        <thead><tr>
          <th style="width:4%">#</th><th style="width:30%">Item</th><th style="width:9%">HSN/SAC</th>
          <th style="width:8%">Tax</th><th style="width:7%">Qty</th><th style="width:12%">Rate/Item</th>
          <th style="width:14%">Taxable Value</th><th style="width:8%">Tax Amt</th><th style="width:8%">Amount</th>
        </tr></thead>
        <tbody>${itemsHTML}</tbody>
      </table>

      <!-- Totals -->
      <table style="font-size:9pt">
        <tr><td style="border:1px solid #000;padding:4px;text-align:right;width:70%"><strong>Taxable Amount</strong></td><td style="border:1px solid #000;padding:4px;text-align:right">${formatIndian(invoice.subtotal)}</td></tr>
        ${hasCGST ? `
          <tr><td style="border:1px solid #000;padding:4px;text-align:right">CGST @ ${parseFloat(items[0]?.cgst_rate||0).toFixed(1)}% on ${formatIndian(invoice.subtotal)}</td><td style="border:1px solid #000;padding:4px;text-align:right">${formatIndian(invoice.cgst_amount)}</td></tr>
          <tr><td style="border:1px solid #000;padding:4px;text-align:right">SGST @ ${parseFloat(items[0]?.sgst_rate||0).toFixed(1)}% on ${formatIndian(invoice.subtotal)}</td><td style="border:1px solid #000;padding:4px;text-align:right">${formatIndian(invoice.sgst_amount)}</td></tr>
        ` : ''}
        ${hasIGST ? `<tr><td style="border:1px solid #000;padding:4px;text-align:right">IGST @ ${parseFloat(items[0]?.igst_rate||0).toFixed(1)}% on ${formatIndian(invoice.subtotal)}</td><td style="border:1px solid #000;padding:4px;text-align:right">${formatIndian(invoice.igst_amount)}</td></tr>` : ''}
        ${parseFloat(invoice.discount) > 0 ? `<tr><td style="border:1px solid #000;padding:4px;text-align:right">Discount</td><td style="border:1px solid #000;padding:4px;text-align:right">-${formatIndian(invoice.discount)}</td></tr>` : ''}
        ${parseFloat(invoice.round_off) !== 0 ? `<tr><td style="border:1px solid #000;padding:4px;text-align:right">Round Off</td><td style="border:1px solid #000;padding:4px;text-align:right">${formatIndian(invoice.round_off)}</td></tr>` : ''}
        <tr style="background:#f0f0f0"><td style="border:2px solid #000;padding:5px;text-align:right;font-size:10pt"><strong>Total</strong></td><td style="border:2px solid #000;padding:5px;text-align:right;font-size:10pt;font-weight:bold">₹${formatIndian(invoice.total_amount)}</td></tr>
      </table>

      <p style="margin-top:4px;font-size:8.5pt"><strong>Amount Chargeable (in words):</strong> INR ${numberToWords(invoice.total_amount)}</p>
      <p style="font-size:7pt;color:#666;margin-bottom:6px">E & O.E</p>

      <!-- HSN Summary -->
      <table style="font-size:8pt;margin-bottom:6px">
        <thead>
          <tr style="background:#f0f0f0"><th>HSN/SAC</th><th>Taxable Value</th>
            ${hasCGST ? '<th colspan="2">Central Tax</th><th colspan="2">State/UT Tax</th>' : '<th colspan="2">Integrated Tax</th>'}
            <th>Total Tax Amount</th>
          </tr>
          <tr style="background:#f5f5f5;font-size:7pt"><th></th><th></th>
            ${hasCGST ? '<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>' : '<th>Rate</th><th>Amount</th>'}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${hsnRows}
          <tr style="font-weight:bold;background:#f8f8f8">
            <td style="border:1px solid #000;padding:2px 3px;text-align:center">TOTAL</td>
            <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(invoice.subtotal)}</td>
            ${hasCGST ? `
              <td style="border:1px solid #000;padding:2px 3px"></td>
              <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(invoice.cgst_amount)}</td>
              <td style="border:1px solid #000;padding:2px 3px"></td>
              <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(invoice.sgst_amount)}</td>
            ` : `
              <td style="border:1px solid #000;padding:2px 3px"></td>
              <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(invoice.igst_amount)}</td>
            `}
            <td style="border:1px solid #000;padding:2px 3px;text-align:right">${formatIndian(parseFloat(invoice.cgst_amount) + parseFloat(invoice.sgst_amount) + parseFloat(invoice.igst_amount))}</td>
          </tr>
        </tbody>
      </table>

      <!-- Bank + Signature -->
      <div style="display:flex;border-top:1px solid #000;padding-top:6px;margin-top:4px">
        <div style="width:55%;font-size:8pt;padding-right:10px">
          <div style="font-weight:bold;margin-bottom:3px">Bank Details:</div>
          ${org.bank_name ? `<div><strong>Bank:</strong> ${org.bank_name}</div>` : ''}
          ${org.account_no ? `<div><strong>Account #:</strong> ${org.account_no}</div>` : ''}
          ${org.ifsc ? `<div><strong>IFSC Code:</strong> ${org.ifsc}</div>` : ''}
          ${org.upi_id ? `<div style="margin-top:2px"><strong>Pay using UPI:</strong> ${org.upi_id}</div>` : ''}
        </div>
        <div style="width:45%;text-align:right">
          <div style="font-size:8pt;margin-bottom:2px">For <strong>${(org.name || '').toUpperCase()}</strong></div>
          <div style="height:35px"></div>
          <div style="border-top:1px solid #000;display:inline-block;padding-top:2px;font-size:8pt">Authorized Signatory</div>
        </div>
      </div>

      ${invoice.notes ? `<div style="margin-top:6px;font-size:7.5pt;color:#444;border-top:1px dotted #ccc;padding-top:4px"><strong>Notes:</strong> ${invoice.notes}</div>` : ''}
      <div style="margin-top:4px;font-size:7pt;color:#888;text-align:center"><strong>Company GSTIN:</strong> ${org.gstin || ''} | <strong>State:</strong> ${org.state || ''} (${org.state_code || ''}) | Page 1/1</div>
    </div>
  </body></html>`;
}

module.exports = router;
