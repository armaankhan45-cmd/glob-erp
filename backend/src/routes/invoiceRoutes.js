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

function generateInvoiceHTML(invoice, items, org) {
  const letterheadMm = org.print_letterhead_mm || 65;
  const footerMm = org.print_footer_mm || 50;

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

  const itemsHTML = items.map((item, i) => `
    <tr>
      <td style="border:1px solid #000;padding:4px;text-align:center">${i+1}</td>
      <td style="border:1px solid #000;padding:4px">${item.description || ''}${item.hsn_code ? `<br><small>HSN: ${item.hsn_code}</small>` : ''}</td>
      <td style="border:1px solid #000;padding:4px;text-align:center">${item.quantity}</td>
      <td style="border:1px solid #000;padding:4px;text-align:center">${item.unit || 'NOS'}</td>
      <td style="border:1px solid #000;padding:4px;text-align:right">${parseFloat(item.rate).toFixed(2)}</td>
      <td style="border:1px solid #000;padding:4px;text-align:right">${parseFloat(item.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const hasCGST = parseFloat(invoice.cgst_amount) > 0;
  const hasIGST = parseFloat(invoice.igst_amount) > 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 10pt; }
    .print-area { width: 210mm; height: 297mm; overflow: hidden; }
    .letterhead-space { height: ${letterheadMm}mm; }
    .content-area { max-height: ${297 - letterheadMm - footerMm}mm; overflow: hidden; padding: 0 14mm; }
    .footer-space { height: ${footerMm}mm; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 6px; background: #f0f0f0; text-align: center; font-size: 9pt; }
    .right { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
  </style></head><body>
    <div class="print-area">
      <div class="letterhead-space"></div>
      <div class="content-area">
        <h2 class="center" style="margin-bottom:8px">TAX INVOICE</h2>
        <table style="margin-bottom:8px"><tr>
          <td style="width:50%;padding:4px"><strong>Invoice No:</strong> ${invoice.invoice_number}<br><strong>Date:</strong> ${invoice.invoice_date}</td>
          <td style="width:50%;padding:4px"><strong>Buyer:</strong> ${invoice.customer_name || ''}<br>${invoice.customer_address || ''}<br>${invoice.customer_city || ''}, ${invoice.customer_state || ''} - ${invoice.customer_pincode || ''}<br><strong>GSTIN:</strong> ${invoice.customer_gstin || ''}</td>
        </tr></table>
        <table>
          <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <table style="margin-top:4px">
          <tr><td style="text-align:right;padding:4px;width:75%"><strong>Subtotal</strong></td><td style="text-align:right;padding:4px">${parseFloat(invoice.subtotal).toFixed(2)}</td></tr>
          ${hasCGST ? `<tr><td style="text-align:right;padding:4px">CGST @ ${parseFloat(items[0]?.cgst_rate||0).toFixed(1)}%</td><td style="text-align:right;padding:4px">${parseFloat(invoice.cgst_amount).toFixed(2)}</td></tr>
          <tr><td style="text-align:right;padding:4px">SGST @ ${parseFloat(items[0]?.sgst_rate||0).toFixed(1)}%</td><td style="text-align:right;padding:4px">${parseFloat(invoice.sgst_amount).toFixed(2)}</td></tr>` : ''}
          ${hasIGST ? `<tr><td style="text-align:right;padding:4px">IGST @ ${parseFloat(items[0]?.igst_rate||0).toFixed(1)}%</td><td style="text-align:right;padding:4px">${parseFloat(invoice.igst_amount).toFixed(2)}</td></tr>` : ''}
          ${parseFloat(invoice.discount) > 0 ? `<tr><td style="text-align:right;padding:4px">Discount</td><td style="text-align:right;padding:4px">-${parseFloat(invoice.discount).toFixed(2)}</td></tr>` : ''}
          ${parseFloat(invoice.round_off) !== 0 ? `<tr><td style="text-align:right;padding:4px">Round Off</td><td style="text-align:right;padding:4px">${parseFloat(invoice.round_off).toFixed(2)}</td></tr>` : ''}
          <tr style="font-size:11pt"><td style="text-align:right;padding:6px"><strong>TOTAL</strong></td><td style="text-align:right;padding:6px"><strong>₹${parseFloat(invoice.total_amount).toFixed(2)}</strong></td></tr>
        </table>
        <p style="margin-top:6px;font-size:9pt"><strong>Amount in Words:</strong> ${numberToWords(invoice.total_amount)}</p>
        ${invoice.notes ? `<p style="margin-top:6px;font-size:8pt">${invoice.notes}</p>` : ''}
        <p style="margin-top:6px;font-size:8pt"><strong>Company GSTIN:</strong> ${org.gstin || ''}</p>
      </div>
      <div class="footer-space"></div>
    </div>
  </body></html>`;
}

module.exports = router;
