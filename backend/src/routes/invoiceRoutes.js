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

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Sanitize empty date strings to null (PostgreSQL rejects "" for date columns)
function sanitizeDates(data) {
  const dateFields = ['invoice_date', 'due_date'];
  const clean = { ...data };
  dateFields.forEach(f => {
    if (clean[f] === '' || clean[f] === undefined) clean[f] = null;
  });
  return clean;
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

    const org = await db('organizations').where({ id: orgId }).first();
    const prefix = org.invoice_prefix || 'GST-';
    const last = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY(new Date(invoiceData.invoice_date));
    const invoiceNumber = `${prefix}${String(nextNo).padStart(4, '0')}/${fy}`;

    const data = sanitizeDates({
      ...invoiceData,
      organization_id: orgId,
      invoice_number: invoiceNumber
    });

    const [invoice] = await db('invoices').insert(data).returning('id');
    const invoiceId = invoice.id || invoice;

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
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ success: false, msg: 'PDF generation failed' });
  }
});

function formatIndian(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const n = parseFloat(num);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

function generateInvoiceHTML(invoice, items, org) {
  function numberToWords(num) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
      'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
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
  const totalTax = parseFloat(invoice.cgst_amount || 0) + parseFloat(invoice.sgst_amount || 0) + parseFloat(invoice.igst_amount || 0);
  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid';
  const custStateCode = invoice.customer_state_code || (invoice.customer_gstin ? invoice.customer_gstin.substring(0,2) : '');
  const orgStateCode = org.state_code || '27';
  const placeOfSupply = custStateCode ? `${custStateCode} - ${invoice.customer_state || ''}` : `${orgStateCode} - ${org.state || ''}`;
  const invoiceDate = formatDate(invoice.invoice_date);
  const hasShipping = invoice.shipping_name || invoice.shipping_address;

  // UPI QR URL (using Google Charts API for server-side HTML)
  const upiId = org.upi_id || '';
  const upiName = encodeURIComponent((org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and'));
  const upiAmount = parseFloat(invoice.total_amount || 0).toFixed(2);
  const upiNote = encodeURIComponent(`Invoice ${invNum}`);
  const qrUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${upiName}&am=${upiAmount}&cu=INR&tn=${upiNote}`)}` : '';

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
    const total = taxable + taxAmt;
    return `<tr>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:top">${i+1}</td>
      <td style="border:1px solid #000;padding:3px 4px;line-height:1.3;white-space:pre-line">${item.description || ''}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:top">${item.hsn_code || '—'}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;vertical-align:top">${formatIndian(rate)}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:top">${qty}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:top">${item.unit || 'NOS'}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;vertical-align:top">${formatIndian(taxable)}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;vertical-align:top">${taxRate > 0 ? taxRate + '%' : '—'}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;vertical-align:top">${formatIndian(taxAmt)}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-weight:bold;vertical-align:top">${formatIndian(total)}</td>
    </tr>`;
  }).join('');

  const emptyRows = items.length < 12 ? Array.from({length: 12 - items.length}).map(() =>
    `<tr style="height:20px"><td style="border:1px solid #000;padding:2px">&nbsp;</td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td></tr>`
  ).join('') : '';

  let hsnRows = '';
  Object.entries(hsnMap).forEach(([hsn, data]) => {
    hsnRows += `<tr>
      <td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${hsn}</td>
      <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.taxable)}</td>
      ${hasCGST ? `
        <td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${data.cgstRate}%</td>
        <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.cgstAmt)}</td>
        <td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${data.sgstRate}%</td>
        <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.sgstAmt)}</td>
      ` : `
        <td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${data.igstRate}%</td>
        <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.igstAmt)}</td>
      `}
      <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt;font-weight:bold">${formatIndian(data.cgstAmt + data.sgstAmt + data.igstAmt)}</td>
    </tr>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a1a; }
    .page { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 4px 3px; background: #e8e8e8; text-align: center; font-size: 7.5pt; font-weight: 700; }
    .section-title { font-size: 7.5pt; font-weight: 700; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 1px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.3px; }
  </style></head><body>
    <div class="page">

      <!-- HEADER -->
      <div style="display:flex;border-bottom:2.5px solid #000;padding:8px 12px 6px;flex-shrink:0">
        <div style="width:68px;height:68px;border:1.5px solid #bbb;border-radius:4px;display:flex;align-items:center;justify-content:center;margin-right:14px;flex-shrink:0;background:#fafafa">
          ${org.logo_url ? `<img src="${org.logo_url}" style="max-width:60px;max-height:60px;object-fit:contain">` : '<span style="font-size:6px;color:#aaa">LOGO</span>'}
        </div>
        <div style="flex:1">
          <div style="font-size:16pt;font-weight:800;letter-spacing:0.8px;color:#111">${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
          <div style="font-size:8pt;color:#333;margin-top:1px">${[org.address, org.city, org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</div>
          <div style="display:flex;gap:16px;margin-top:2px;font-size:7.8pt;color:#444;flex-wrap:wrap">
            ${org.gstin ? `<span><b>GSTIN:</b> ${org.gstin}</span>` : ''}
            ${org.phone ? `<span><b>Phone:</b> ${org.phone}</span>` : ''}
            ${org.email ? `<span><b>Email:</b> ${org.email}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- TITLE BAR -->
      <div style="text-align:center;padding:4px 0;border-bottom:2.5px solid #000;flex-shrink:0;background:linear-gradient(to right,#f8f8f8,#fff,#f8f8f8)">
        <div style="font-size:13pt;font-weight:800;letter-spacing:2.5px;color:#111">TAX INVOICE</div>
        <div style="font-size:7pt;font-weight:700;color:#555;letter-spacing:0.5px">ORIGINAL FOR RECIPIENT</div>
      </div>

      <!-- INVOICE INFO + BILLING/SHIPPING -->
      <div style="display:flex;border-bottom:1px solid #000;flex-shrink:0">
        <div style="width:36%;border-right:1px solid #000;padding:5px 10px;font-size:8pt;line-height:1.4">
          <div style="margin-bottom:2px"><b>Invoice No:</b> ${invNum}</div>
          <div style="margin-bottom:2px"><b>Date:</b> ${invoiceDate}</div>
          <div style="margin-bottom:2px"><b>Place of Supply:</b> ${placeOfSupply}</div>
          <div><b>Reverse Charge:</b> No</div>
        </div>
        <div style="width:${hasShipping ? '32' : '64'}%;padding:5px 10px;font-size:8pt">
          <div class="section-title">Bill To</div>
          <div style="font-weight:700;text-transform:uppercase;font-size:9pt">${(invoice.customer_name || '').toUpperCase()}</div>
          ${invoice.customer_gstin ? `<div><b>GSTIN:</b> ${invoice.customer_gstin}</div>` : ''}
          <div>${[invoice.customer_address, invoice.customer_city, invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</div>
          ${invoice.customer_phone ? `<div><b>Ph:</b> ${invoice.customer_phone}</div>` : ''}
        </div>
        ${hasShipping ? `
        <div style="width:32%;border-left:1px solid #000;padding:5px 10px;font-size:8pt">
          <div class="section-title">Ship To</div>
          <div style="font-weight:700;text-transform:uppercase;font-size:9pt">${(invoice.shipping_name || invoice.customer_name || '').toUpperCase()}</div>
          <div>${[invoice.shipping_address, invoice.shipping_city, invoice.shipping_state, invoice.shipping_pincode].filter(Boolean).join(', ')}</div>
        </div>
        ` : ''}
      </div>

      <!-- ITEMS TABLE -->
      <div style="flex:1;display:flex;flex-direction:column">
        <table style="font-size:8pt;flex:1">
          <thead><tr>
            <th style="width:4%">Sr<br>No</th>
            <th style="width:24%">Item Description</th>
            <th style="width:8%">HSN/<br>SAC</th>
            <th style="width:9%">Rate<br>(&#8377;)</th>
            <th style="width:6%">Qty</th>
            <th style="width:5%">Unit</th>
            <th style="width:13%">Taxable<br>Value (&#8377;)</th>
            <th style="width:7%">GST<br>%</th>
            <th style="width:10%">Tax<br>Amount (&#8377;)</th>
            <th style="width:14%">Total<br>Amount (&#8377;)</th>
          </tr></thead>
          <tbody>${itemsHTML}${emptyRows}</tbody>
        </table>

        <!-- TOTALS -->
        <table style="font-size:8.5pt;flex-shrink:0">
          <tr><td style="border:1px solid #000;padding:3px 6px;text-align:right;width:74%;background:#fafafa">Taxable Amount</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">&#8377;${formatIndian(invoice.subtotal)}</td></tr>
          ${hasCGST ? `
            <tr><td style="border:1px solid #000;padding:3px 6px;text-align:right">CGST @ ${parseFloat(items[0]?.cgst_rate||0).toFixed(1)}% on &#8377;${formatIndian(invoice.subtotal)}</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">&#8377;${formatIndian(invoice.cgst_amount)}</td></tr>
            <tr><td style="border:1px solid #000;padding:3px 6px;text-align:right">SGST @ ${parseFloat(items[0]?.sgst_rate||0).toFixed(1)}% on &#8377;${formatIndian(invoice.subtotal)}</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">&#8377;${formatIndian(invoice.sgst_amount)}</td></tr>
          ` : ''}
          ${hasIGST ? `<tr><td style="border:1px solid #000;padding:3px 6px;text-align:right">IGST @ ${parseFloat(items[0]?.igst_rate||0).toFixed(1)}% on &#8377;${formatIndian(invoice.subtotal)}</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">&#8377;${formatIndian(invoice.igst_amount)}</td></tr>` : ''}
          ${parseFloat(invoice.round_off) !== 0 ? `<tr><td style="border:1px solid #000;padding:3px 6px;text-align:right">Round Off</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">${parseFloat(invoice.round_off) > 0 ? '+' : ''} &#8377;${formatIndian(invoice.round_off)}</td></tr>` : ''}
          <tr style="background:#e8e8e8"><td style="border:2px solid #000;padding:5px 6px;text-align:right;font-size:10.5pt"><b>GRAND TOTAL</b></td><td style="border:2px solid #000;padding:5px 6px;text-align:right;font-size:10.5pt;font-weight:800">&#8377;${formatIndian(invoice.total_amount)}</td></tr>
        </table>
      </div>

      <!-- AMOUNT IN WORDS -->
      <div style="padding:4px 8px;font-size:8pt;border-top:1.5px solid #000;flex-shrink:0;display:flex;justify-content:space-between">
        <div><b>Amount Chargeable (in words):</b> INR ${numberToWords(invoice.total_amount)}</div>
        <div style="font-size:7pt;color:#666">E & O.E</div>
      </div>

      <!-- HSN-WISE TAX SUMMARY -->
      <div style="flex-shrink:0">
        <div style="font-size:7.5pt;font-weight:700;padding:3px 4px 0;color:#333;letter-spacing:0.3px">HSN-WISE TAX SUMMARY</div>
        <table style="font-size:7pt">
          <thead>
            <tr><th style="font-size:6.5pt">HSN/SAC</th><th style="font-size:6.5pt">Taxable Value</th>
              ${hasCGST ? '<th style="font-size:6.5pt" colspan="2">Central Tax</th><th style="font-size:6.5pt" colspan="2">State/UT Tax</th>' : '<th style="font-size:6.5pt" colspan="2">Integrated Tax</th>'}
              <th style="font-size:6.5pt">Total Tax Amt</th>
            </tr>
            <tr><th style="font-size:6pt;padding:1px"></th><th style="font-size:6pt;padding:1px"></th>
              ${hasCGST ? '<th style="font-size:6pt;padding:1px">Rate</th><th style="font-size:6pt;padding:1px">Amount</th><th style="font-size:6pt;padding:1px">Rate</th><th style="font-size:6pt;padding:1px">Amount</th>' : '<th style="font-size:6pt;padding:1px">Rate</th><th style="font-size:6pt;padding:1px">Amount</th>'}
              <th style="font-size:6pt;padding:1px"></th>
            </tr>
          </thead>
          <tbody>
            ${hsnRows}
            <tr style="font-weight:700;background:#f0f0f0">
              <td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">TOTAL</td>
              <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">&#8377;${formatIndian(invoice.subtotal)}</td>
              ${hasCGST ? `
                <td style="border:1px solid #000;padding:1px 2px;font-size:7pt"></td>
                <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">&#8377;${formatIndian(invoice.cgst_amount)}</td>
                <td style="border:1px solid #000;padding:1px 2px;font-size:7pt"></td>
                <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">&#8377;${formatIndian(invoice.sgst_amount)}</td>
              ` : `
                <td style="border:1px solid #000;padding:1px 2px;font-size:7pt"></td>
                <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">&#8377;${formatIndian(invoice.igst_amount)}</td>
              `}
              <td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">&#8377;${formatIndian(totalTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- BANK DETAILS + QR + SIGNATURE -->
      <div style="display:flex;border-top:1.5px solid #000;margin-top:auto;flex-shrink:0">
        <div style="width:42%;padding:5px 10px;font-size:7.5pt;line-height:1.5">
          <div class="section-title">Bank Details</div>
          ${org.bank_name ? `<div><b>Bank:</b> ${org.bank_name}</div>` : ''}
          ${org.account_no ? `<div><b>A/C No:</b> ${org.account_no}</div>` : ''}
          ${org.ifsc ? `<div><b>IFSC:</b> ${org.ifsc}</div>` : ''}
          ${org.branch ? `<div><b>Branch:</b> ${org.branch}</div>` : ''}
          ${org.upi_id ? `<div><b>UPI:</b> ${org.upi_id}</div>` : ''}
        </div>
        <div style="width:18%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;border-left:1px solid #000;border-right:1px solid #000">
          ${qrUrl ? `<img src="${qrUrl}" style="width:72px;height:72px"><div style="font-size:5.5pt;color:#666;margin-top:2px;text-align:center">Scan to Pay</div>` : '<div style="font-size:7pt;color:#aaa;text-align:center">QR Code</div>'}
        </div>
        <div style="width:40%;padding:5px 10px;font-size:7.5pt;display:flex;flex-direction:column;justify-content:space-between">
          <div style="margin-bottom:4px">
            <span style="font-weight:700">Payment Status: </span>
            <span style="display:inline-block;padding:1px 8px;border-radius:3px;font-size:7pt;font-weight:700;letter-spacing:0.3px;${isPaid ? 'background:#d4edda;color:#155724;border:1px solid #c3e6cb' : 'background:#fff3cd;color:#856404;border:1px solid #ffeaa7'}">${isPaid ? '✓ PAID' : '● UNPAID'}</span>
          </div>
          <div style="text-align:right;margin-top:auto">
            <div style="font-size:7.5pt;margin-bottom:24px">For <b>${(org.name || '').toUpperCase()}</b></div>
            <div style="border-top:1px solid #000;display:inline-block;padding-top:2px;font-size:7.5pt;font-weight:600">Authorized Signatory</div>
          </div>
        </div>
      </div>

      <!-- NOTES -->
      ${invoice.notes ? `<div style="padding:4px 10px;font-size:7pt;border-top:1px solid #000;flex-shrink:0;color:#444;line-height:1.5"><b>Notes:</b> ${invoice.notes}</div>` : ''}

      <!-- TERMS -->
      <div style="padding:3px 10px;font-size:6.5pt;border-top:1px solid #ccc;flex-shrink:0;color:#777">
        <b>Terms & Conditions:</b> 1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged on delayed payments. 3. Subject to Maharashtra jurisdiction only.
      </div>

      <!-- FOOTER -->
      <div style="text-align:center;font-size:6.5pt;color:#999;padding:3px 0;border-top:1px solid #ddd;flex-shrink:0">
        Computer Generated Invoice | ${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()} | Page 1 of 1
      </div>

    </div>
  </body></html>`;
}

module.exports = router;
