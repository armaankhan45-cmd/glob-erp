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

function sanitizeDates(data) {
  const dateFields = ['invoice_date', 'due_date'];
  const clean = { ...data };
  dateFields.forEach(f => {
    if (clean[f] === '' || clean[f] === undefined) clean[f] = null;
  });
  return clean;
}

function sanitizeItem(item, invoiceId) {
  const hasTaxRate = item.tax_rate !== undefined && item.tax_rate !== null;
  const hasCgstRate = item.cgst_rate !== undefined && item.cgst_rate !== null;
  const hasSgstRate = item.sgst_rate !== undefined && item.sgst_rate !== null;
  const hasIgstRate = item.igst_rate !== undefined && item.igst_rate !== null;

  let cgstRate = parseFloat(item.cgst_rate) || 0;
  let sgstRate = parseFloat(item.sgst_rate) || 0;
  let igstRate = parseFloat(item.igst_rate) || 0;

  if (hasTaxRate && !hasCgstRate && !hasSgstRate && !hasIgstRate) {
    const tr = parseFloat(item.tax_rate) || 0;
    if (igstRate > 0) { igstRate = tr; cgstRate = 0; sgstRate = 0; }
    else { cgstRate = tr / 2; sgstRate = tr / 2; igstRate = 0; }
  }

  const qty = parseFloat(item.quantity) || 0;
  const rate = parseFloat(item.rate) || 0;

  return {
    invoice_id: invoiceId,
    description: item.description || '',
    hsn_code: item.hsn_code || '',
    quantity: qty,
    unit: item.unit || 'NOS',
    rate: rate,
    cgst_rate: cgstRate,
    sgst_rate: sgstRate,
    igst_rate: igstRate,
    amount: parseFloat(item.amount) || (qty * rate)
  };
}

const VALID_INVOICE_COLUMNS = [
  'organization_id', 'invoice_number', 'customer_id',
  'invoice_date', 'due_date',
  'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount',
  'discount', 'round_off', 'total_amount',
  'status', 'payment_status', 'notes',
  'irn_number', 'ack_no', 'ack_date'
];

function sanitizeInvoiceData(data) {
  const clean = {};
  VALID_INVOICE_COLUMNS.forEach(col => {
    if (data[col] !== undefined) { clean[col] = data[col]; }
  });
  return clean;
}

// Get next invoice number
router.get('/next-number', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const org = await db('organizations').where({ id: orgId }).first();
    const prefix = org.invoice_prefix || 'GST-';
    const lastInvoice = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('invoice_number', 'id');
    let nextNum = 1;
    if (lastInvoice?.invoice_number) {
      const numPart = lastInvoice.invoice_number.split('/')[0];
      const digits = numPart.replace(/^[A-Za-z\-]+/, '');
      if (digits && !isNaN(parseInt(digits))) nextNum = parseInt(digits) + 1;
      else nextNum = (lastInvoice.id || 0) + 1;
    }
    const fy = getFY(new Date());
    res.json({ success: true, nextNumber: `${prefix}${String(nextNum).padStart(4, '0')}/${fy}`, nextNumeric: nextNum, prefix, fy });
  } catch (err) { res.status(500).json({ success: false, msg: err.message }); }
});

// List invoices
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { status, search, from, to } = req.query;
    let query = db('invoices').where({ 'invoices.organization_id': req.user.organization_id }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.*', 'customers.name as customer_name');
    if (status && status !== 'All') query = query.where('invoices.status', status);
    if (search) query = query.where(function() { this.where('invoices.invoice_number', 'ilike', `%${search}%`).orWhere('customers.name', 'ilike', `%${search}%`); });
    if (from) query = query.where('invoices.invoice_date', '>=', from);
    if (to) query = query.where('invoices.invoice_date', '<=', to);
    const invoices = await query.orderBy('invoices.created_at', 'desc');
    const stats = await db('invoices').where({ organization_id: req.user.organization_id }).select(db.raw('COUNT(*) as total_bills'), db.raw('COALESCE(SUM(total_amount), 0) as total_amount'), db.raw("COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END), 0) as total_paid"), db.raw("COALESCE(SUM(CASE WHEN payment_status != 'Paid' THEN total_amount ELSE 0 END), 0) as outstanding")).first();
    res.json({ success: true, invoices, stats });
  } catch (err) { console.error('List invoices error:', err); res.status(500).json({ success: false, msg: 'Failed to fetch invoices', invoices: [], stats: {} }); }
});

// Get single invoice
router.get('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices').where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.*', 'customers.name as customer_name', 'customers.gstin as customer_gstin', 'customers.address as customer_address', 'customers.city as customer_city', 'customers.state as customer_state', 'customers.state_code as customer_state_code', 'customers.pincode as customer_pincode', 'customers.phone as customer_phone').first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    const items = await db('invoice_items').where({ invoice_id: invoice.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    res.json({ success: true, invoice, items, organization: org });
  } catch (err) { console.error('Get invoice error:', err); res.status(500).json({ success: false, msg: 'Failed' }); }
});

// Create invoice
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...invoiceData } = req.body;
    const orgId = req.user.organization_id;
    const org = await db('organizations').where({ id: orgId }).first();
    let invoiceNumber;
    if (invoiceData.invoice_number && invoiceData.invoice_number.trim()) { invoiceNumber = invoiceData.invoice_number.trim(); }
    else { const prefix = org.invoice_prefix || 'GST-'; const last = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('id'); const nextNo = (last?.id || 0) + 1; const fy = getFY(new Date(invoiceData.invoice_date)); invoiceNumber = `${prefix}${String(nextNo).padStart(4, '0')}/${fy}`; }
    const data = sanitizeDates(sanitizeInvoiceData({ ...invoiceData, organization_id: orgId, invoice_number: invoiceNumber }));
    const [invoice] = await db('invoices').insert(data).returning('id');
    const invoiceId = invoice.id || invoice;
    if (items && items.length > 0) { await db('invoice_items').insert(items.map(item => sanitizeItem(item, invoiceId))); }
    await auditLog(req.user.id, orgId, 'CREATE', 'invoices', invoiceId, null, data, req.ip);
    res.status(201).json({ success: true, invoice: { id: invoiceId, invoice_number: invoiceNumber } });
  } catch (err) { console.error('Create invoice error:', err); res.status(500).json({ success: false, msg: 'Failed to create invoice: ' + err.message }); }
});

// Full update
router.put('/:id/full', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, ...invoiceData } = req.body;
    const orgId = req.user.organization_id;
    const old = await db('invoices').where({ id: req.params.id, organization_id: orgId }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    const cleanData = sanitizeInvoiceData(invoiceData);
    await db('invoices').where({ id: req.params.id }).update(cleanData);
    await db('invoice_items').where({ invoice_id: req.params.id }).del();
    if (items && items.length > 0) { await db('invoice_items').insert(items.map(item => sanitizeItem(item, req.params.id))); }
    await auditLog(req.user.id, orgId, 'UPDATE', 'invoices', req.params.id, old, cleanData, req.ip);
    res.json({ success: true, msg: 'Invoice updated' });
  } catch (err) { console.error('Update invoice error:', err); res.status(500).json({ success: false, msg: 'Failed to update: ' + err.message }); }
});

// Simple update
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const old = await db('invoices').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    const cleanData = sanitizeInvoiceData(req.body);
    await db('invoices').where({ id: req.params.id }).update(cleanData);
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'invoices', req.params.id, old, cleanData, req.ip);
    res.json({ success: true, msg: 'Invoice updated' });
  } catch (err) { console.error('Update invoice error:', err); res.status(500).json({ success: false, msg: 'Failed' }); }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    await db('invoice_items').where({ invoice_id: req.params.id }).del();
    await db('invoices').where({ id: req.params.id }).del();
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'invoices', req.params.id, invoice, null, req.ip);
    res.json({ success: true, msg: 'Invoice deleted' });
  } catch (err) { console.error('Delete invoice error:', err); res.status(500).json({ success: false, msg: 'Failed to delete' }); }
});

// PDF Auth
function pdfAuth(req, res, next) {
  const jwt = require('jsonwebtoken');
  const config = require('../config/env');
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) token = req.query.token;
  if (!token) return res.status(401).json({ success: false, msg: 'Login required' });
  try { req.user = jwt.verify(token, config.JWT_SECRET); next(); }
  catch { return res.status(401).json({ success: false, msg: 'Invalid token' }); }
}

// PDF / HTML — supports ?layout=pro or ?layout=classic
router.get('/:id/pdf', pdfAuth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices').where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.*', db.raw("COALESCE(customers.name, '(No Customer)') as customer_name"), 'customers.gstin as customer_gstin', 'customers.address as customer_address', 'customers.city as customer_city', 'customers.state as customer_state', 'customers.state_code as customer_state_code', 'customers.pincode as customer_pincode', 'customers.phone as customer_phone').first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    const items = await db('invoice_items').where({ invoice_id: invoice.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const layout = req.query.layout || 'pro';
    const html = layout === 'pro' ? generateProInvoiceHTML(invoice, items, org) : generateClassicInvoiceHTML(invoice, items, org);
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
      res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.html"`);
      res.send(html);
    }
  } catch (err) { console.error('PDF error:', err); res.status(500).json({ success: false, msg: 'PDF generation failed: ' + err.message }); }
});

// Email share
router.post('/:id/share-email', pdfAuth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, msg: 'Email address required' });
    const db = getDb();
    const invoice = await db('invoices').where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.*', db.raw("COALESCE(customers.name, '(No Customer)') as customer_name"), 'customers.gstin as customer_gstin', 'customers.address as customer_address', 'customers.city as customer_city', 'customers.state as customer_state', 'customers.state_code as customer_state_code', 'customers.pincode as customer_pincode', 'customers.phone as customer_phone').first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Invoice not found' });
    const items = await db('invoice_items').where({ invoice_id: invoice.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const invNum = (invoice.invoice_number || '').split('/')[0];
    const total = formatIndian(invoice.total_amount);
    try {
      const nodemailer = require('nodemailer');
      const smtpHost = process.env.SMTP_HOST;
      if (!smtpHost) throw new Error('SMTP not configured');
      const transporter = nodemailer.createTransport({ host: smtpHost, port: parseInt(process.env.SMTP_PORT) || 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      const html = generateProInvoiceHTML(invoice, items, org);
      await transporter.sendMail({ from: `"${org.name || 'Glob ERP'}" <${process.env.SMTP_USER}>`, to, subject: `Tax Invoice ${invNum} - ${org.name || 'Our Company'}`, html: `<p>Dear ${invoice.customer_name || 'Customer'},</p><p>Please find your tax invoice attached:</p><p>Invoice No: ${invNum}<br>Total Amount: ₹${total}</p><p>Thank you for your business.</p><p>Best regards,<br>${org.name || 'Our Company'}</p>`, attachments: [{ filename: `Invoice_${invNum.replace(/\//g, '-')}.html`, content: html, contentType: 'text/html' }] });
      return res.json({ success: true, msg: 'Invoice sent via email!' });
    } catch (smtpErr) { return res.json({ success: false, msg: 'SMTP not configured. Use mailto fallback.' }); }
  } catch (err) { console.error('Share email error:', err); res.status(500).json({ success: false, msg: 'Failed: ' + err.message }); }
});

function formatIndian(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(num));
}

const STATE_NAMES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
  '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
  '36':'Telangana','37':'Ladakh','38':'Other Territory'
};

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
  let result = inW(rupees) + ' RUPEES';
  if (paise > 0) result += ' AND ' + inW(paise) + ' PAISE';
  return result + ' ONLY';
}

function buildSharedData(invoice, items, org) {
  const invNum = (invoice.invoice_number || '').split('/')[0];
  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27');
  const custGstin = invoice.customer_gstin || '';
  const custStateCode = invoice.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '');
  const isIntraState = custStateCode && custStateCode === orgStateCode;
  const hasCGST = isIntraState || parseFloat(invoice.cgst_amount) > 0;
  const hasIGST = !isIntraState && custGstin ? true : (parseFloat(invoice.igst_amount) > 0 && !hasCGST);
  const cgstAmount = parseFloat(invoice.cgst_amount || 0);
  const sgstAmount = parseFloat(invoice.sgst_amount || 0);
  const igstAmount = parseFloat(invoice.igst_amount || 0);
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const cgstRate = isIntraState ? (parseFloat(items[0]?.cgst_rate || 9)) : 0;
  const sgstRate = isIntraState ? (parseFloat(items[0]?.sgst_rate || 9)) : 0;
  const igstRate = !isIntraState ? (parseFloat(items[0]?.igst_rate || 18)) : 0;
  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid';
  const custStateName = invoice.customer_state || (custStateCode ? (STATE_NAMES[custStateCode] || '') : '');
  const placeOfSupply = custStateCode ? custStateCode + '-' + custStateName : orgStateCode + ' - ' + (org.state || '');
  const invoiceDate = formatDate(invoice.invoice_date);
  const totalQty = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0);
  const fontFamily = org.invoice_font_family || "'Segoe UI', Arial, sans-serif";

  const upiId = org.upi_id || '';
  const upiName = encodeURIComponent((org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and'));
  const upiAmount = parseFloat(invoice.total_amount || 0).toFixed(2);
  const qrUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent('upi://pay?pa=' + encodeURIComponent(upiId) + '&pn=' + upiName + '&am=' + upiAmount + '&cu=INR&tn=' + encodeURIComponent('Invoice ' + invNum))}` : '';

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

  return { invNum, orgStateCode, custGstin, custStateCode, isIntraState, hasCGST, hasIGST, cgstAmount, sgstAmount, igstAmount, totalTax, cgstRate, sgstRate, igstRate, isPaid, placeOfSupply, invoiceDate, totalQty, fontFamily, qrUrl, hsnMap };
}

/* ═══════════════════════════════════════════════════════════════
   PRO INVOICE HTML — Dark Navy Header, Accent Stripes
   ═══════════════════════════════════════════════════════════════ */
function generateProInvoiceHTML(invoice, items, org) {
  const d = buildSharedData(invoice, items, org);
  const NAVY = '#0d1b2a';
  const bdr = `1.5px solid ${NAVY}`;
  const div = '1.5px solid #ccc';

  const itemsHTML = items.map((item, i) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxable = qty * rate;
    const taxRate = (parseFloat(item.igst_rate) || 0) > 0 ? parseFloat(item.igst_rate) : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate));
    const rowBg = i % 2 === 1 ? '#fafbfc' : '#fff';
    return `<tr style="border-bottom:1px solid #e8e8e8;background:${rowBg}">
      <td style="padding:8px 10px;font-weight:600;color:#000">${i+1}</td>
      <td style="padding:8px 10px;line-height:1.4;font-weight:600;color:#000">${item.description || ''}</td>
      <td style="padding:8px 10px;font-weight:600;color:#000">${item.hsn_code || '—'}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:#000">${taxRate > 0 ? taxRate + '%' : '—'}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:#000">${qty} ${item.unit || 'NOS'}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:600;color:#000">${formatIndian(rate)}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:600;color:#000">${item.unit || 'NOS'}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;color:#000">${formatIndian(taxable)}</td>
    </tr>`;
  }).join('');

  let summaryRows = '';
  summaryRows += `<tr style="background:#f5f7fa"><td style="border-top:1px solid #e2e8f0;padding:8px 10px"></td><td colspan="6" style="border-top:1px solid #e2e8f0;padding:8px 10px;text-align:right;font-weight:700;color:#000">Taxable Amount</td><td style="border-top:1px solid #e2e8f0;padding:8px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(invoice.subtotal)}</td></tr>`;
  if (d.hasCGST) {
    summaryRows += `<tr style="background:#f5f7fa"><td style="border-top:1px solid #e2e8f0;padding:6px 10px"></td><td colspan="6" style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">CGST ${d.cgstRate.toFixed(1)}%</td><td style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(d.cgstAmount)}</td></tr>`;
    summaryRows += `<tr style="background:#f5f7fa"><td style="border-top:1px solid #e2e8f0;padding:6px 10px"></td><td colspan="6" style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">SGST ${d.sgstRate.toFixed(1)}%</td><td style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(d.sgstAmount)}</td></tr>`;
  }
  if (d.hasIGST || d.igstAmount > 0) {
    summaryRows += `<tr style="background:#f5f7fa"><td style="border-top:1px solid #e2e8f0;padding:6px 10px"></td><td colspan="6" style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">IGST ${d.igstRate.toFixed(1)}%</td><td style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(d.igstAmount)}</td></tr>`;
  }
  if (parseFloat(invoice.discount) > 0) {
    summaryRows += `<tr style="background:#f5f7fa"><td style="border-top:1px solid #e2e8f0;padding:6px 10px"></td><td colspan="6" style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">Discount</td><td style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">-&#8377;${formatIndian(invoice.discount)}</td></tr>`;
  }
  if (parseFloat(invoice.round_off) !== 0) {
    summaryRows += `<tr style="background:#f5f7fa"><td style="border-top:1px solid #e2e8f0;padding:6px 10px"></td><td colspan="6" style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">Round Off</td><td style="border-top:1px solid #e2e8f0;padding:6px 10px;text-align:right;font-weight:700;color:#000">${parseFloat(invoice.round_off) > 0 ? '+' : ''}&#8377;${formatIndian(Math.abs(invoice.round_off))}</td></tr>`;
  }
  summaryRows += `<tr style="border-top:2px solid ${NAVY};background:#f0f2f5"><td style="padding:10px"></td><td colspan="3" style="font-weight:900;font-size:14px;padding:10px;color:#000">Total</td><td style="font-weight:900;font-size:14px;padding:10px;text-align:right;color:#000">${d.totalQty.toFixed(3)}</td><td style="padding:10px"></td><td style="padding:10px"></td><td style="font-weight:900;font-size:14px;padding:10px;text-align:right;color:#000">&#8377;${formatIndian(invoice.total_amount)}</td></tr>`;

  let hsnRows = '';
  Object.entries(d.hsnMap).forEach(([hsn, hsnD]) => {
    hsnRows += `<tr>
      <td style="border:1px solid #ccc;padding:6px 10px;font-weight:700;color:#000">${hsn}</td>
      <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.taxable)}</td>
      ${d.hasCGST ? `
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${hsnD.cgstRate}%</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.cgstAmt)}</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${hsnD.sgstRate}%</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.sgstAmt)}</td>
      ` : `
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${hsnD.igstRate}%</td>
        <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.igstAmt)}</td>
      `}
      <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:800;color:#000">${formatIndian(hsnD.cgstAmt + hsnD.sgstAmt + hsnD.igstAmt)}</td>
    </tr>`;
  });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Tax Invoice</title><style>
  * { box-sizing: border-box; }
  body { font-family: ${d.fontFamily}; background: #f2f2f2; margin: 0; padding: 20px; color: #000; font-weight: 600; }
  .invoice { max-width: 900px; margin: 0 auto; background: #fff; border: 2px solid ${NAVY}; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; }
  @media print { body { background: #fff; padding: 0; } .invoice { border: none; } }
  </style></head><body>
<div class="invoice">
  <div style="background:linear-gradient(135deg,${NAVY} 0%,#1b2a4a 100%);padding:16px 24px;display:flex;align-items:center;gap:16px">
    <div style="width:68px;height:68px;flex-shrink:0;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.3)">
      ${org.logo_url ? `<img src="${org.logo_url}" style="width:60px;height:60px;object-fit:contain;border-radius:4px">` : `<span style="font-size:9px;color:${NAVY};font-weight:800">LOGO</span>`}
    </div>
    <div style="flex:1">
      <h1 style="font-size:20px;font-weight:900;color:#fff;letter-spacing:2px;line-height:1.2;margin:0 0 3px">${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</h1>
      ${org.gstin ? `<span style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;padding:2px 10px;border-radius:3px;font-size:11px;font-weight:700;letter-spacing:0.5px">GSTIN: ${org.gstin}</span>` : ''}
      <div style="font-size:11.5px;color:rgba(255,255,255,0.8);margin-top:2px;line-height:1.4">${[org.address, org.city, org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</div>
      <div style="font-size:11.5px;color:rgba(255,255,255,0.8);margin-top:1px;line-height:1.4">${org.phone ? '&#128222; ' + org.phone : ''}${org.email ? ' &#9993; ' + org.email : ''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:4px">TAX INVOICE</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:1px;font-weight:600;margin-top:2px">ORIGINAL FOR RECIPIENT</div>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6,#06b6d4)"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:${bdr}">
    <div style="padding:12px 20px;border-right:${div}">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:2px">Invoice #</div>
      <div style="font-weight:800;font-size:14px;color:#000">${d.invNum}</div>
    </div>
    <div style="padding:12px 20px;border-right:${div}">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:2px">Invoice Date</div>
      <div style="font-weight:800;font-size:14px;color:#000">${d.invoiceDate}</div>
    </div>
    <div style="padding:12px 20px">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:2px">Place of Supply</div>
      <div style="font-weight:800;font-size:14px;color:#000">${d.placeOfSupply}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:${bdr}">
    <div style="padding:12px 20px;border-right:${div};font-size:12px;line-height:1.5;color:#000">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:4px">Bill To</div>
      <p style="font-weight:800;font-size:14px;color:#000;margin:0 0 2px">${(invoice.customer_name || '').toUpperCase()}</p>
      ${d.custGstin ? `<p style="margin:1px 0;font-weight:700;color:#000"><strong>GSTIN:</strong> ${d.custGstin}</p>` : ''}
      <p style="margin:1px 0;font-weight:600;color:#000">${[invoice.customer_address, invoice.customer_city].filter(Boolean).join(', ')}</p>
      <p style="margin:1px 0;font-weight:600;color:#000">${[invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</p>
      ${invoice.customer_phone ? `<p style="margin:1px 0;font-weight:600;color:#000">Ph: ${invoice.customer_phone}</p>` : ''}
    </div>
    <div style="padding:12px 20px;font-size:12px;line-height:1.5;color:#000">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:4px">Ship To</div>
      <p style="margin:1px 0;font-weight:600;color:#000">${[invoice.customer_address, invoice.customer_city].filter(Boolean).join(', ')}</p>
      <p style="margin:1px 0;font-weight:600;color:#000">${[invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</p>
    </div>
  </div>
  <div style="border-bottom:${bdr}">
    <table style="font-size:12.5px;color:#000">
      <thead><tr>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY}">#</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY}">Item Description</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY}">HSN/SAC</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY};text-align:right">Tax</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY};text-align:right">Qty</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY};text-align:center">Rate/Item</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY};text-align:center">Per</th>
        <th style="padding:10px 10px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#fff;background:${NAVY};text-align:right">Amount</th>
      </tr></thead>
      <tbody>${itemsHTML}${summaryRows}</tbody>
    </table>
  </div>
  <div style="padding:10px 20px;font-size:12.5px;border-bottom:${bdr};line-height:1.5;color:#000;font-weight:600;background:#fafbfc">
    Amount Chargeable (in words): <strong style="font-weight:800">INR ${numberToWords(invoice.total_amount)}</strong> &nbsp;<em style="font-size:11px;color:#666;font-weight:600">E & O.E</em>
  </div>
  <table style="font-size:12px;border-bottom:${bdr};color:#000">
    <thead><tr>
      <th style="border:1px solid #bbb;padding:6px 10px;text-align:left;background:#e8ecf1;font-weight:800;color:${NAVY};font-size:11px;text-transform:uppercase;letter-spacing:0.5px" rowSpan="2">HSN/SAC</th>
      <th style="border:1px solid #bbb;padding:6px 10px;text-align:right;background:#e8ecf1;font-weight:800;color:${NAVY};font-size:11px;text-transform:uppercase;letter-spacing:0.5px" rowSpan="2">Taxable Value</th>
      ${d.hasCGST ? `
        <th style="border:1px solid #bbb;padding:6px 10px;text-align:right;background:#e8ecf1;font-weight:800;color:${NAVY};font-size:11px;text-transform:uppercase;letter-spacing:0.5px" colSpan="2">Central Tax</th>
        <th style="border:1px solid #bbb;padding:6px 10px;text-align:right;background:#e8ecf1;font-weight:800;color:${NAVY};font-size:11px;text-transform:uppercase;letter-spacing:0.5px" colSpan="2">State Tax</th>
      ` : `<th style="border:1px solid #bbb;padding:6px 10px;text-align:right;background:#e8ecf1;font-weight:800;color:${NAVY};font-size:11px;text-transform:uppercase;letter-spacing:0.5px" colSpan="2">Integrated Tax</th>`}
      <th style="border:1px solid #bbb;padding:6px 10px;text-align:right;background:#e8ecf1;font-weight:800;color:${NAVY};font-size:11px;text-transform:uppercase;letter-spacing:0.5px" rowSpan="2">Total Tax</th>
    </tr><tr>
      <th style="border:1px solid #bbb;padding:4px 10px;text-align:right;background:#e8ecf1;font-weight:700;color:${NAVY}">Rate</th>
      <th style="border:1px solid #bbb;padding:4px 10px;text-align:right;background:#e8ecf1;font-weight:700;color:${NAVY}">Amount</th>
      ${d.hasCGST ? `<th style="border:1px solid #bbb;padding:4px 10px;text-align:right;background:#e8ecf1;font-weight:700;color:${NAVY}">Rate</th><th style="border:1px solid #bbb;padding:4px 10px;text-align:right;background:#e8ecf1;font-weight:700;color:${NAVY}">Amount</th>` : ''}
    </tr></thead>
    <tbody>
      ${hsnRows}
      <tr style="font-weight:800;background:#e8ecf1">
        <td style="border:1px solid #bbb;padding:6px 10px;color:#000">TOTAL</td>
        <td style="border:1px solid #bbb;padding:6px 10px;text-align:right;color:#000">${formatIndian(invoice.subtotal)}</td>
        ${d.hasCGST ? `
          <td style="border:1px solid #bbb;padding:6px 10px"></td>
          <td style="border:1px solid #bbb;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.cgstAmount)}</td>
          <td style="border:1px solid #bbb;padding:6px 10px"></td>
          <td style="border:1px solid #bbb;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.sgstAmount)}</td>
        ` : `<td style="border:1px solid #bbb;padding:6px 10px"></td><td style="border:1px solid #bbb;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.igstAmount)}</td>`}
        <td style="border:1px solid #bbb;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.totalTax)}</td>
      </tr>
    </tbody>
  </table>
  ${d.isPaid ? `<div style="text-align:right;padding:10px 20px;border-bottom:${bdr};font-size:13px;color:#000;font-weight:800;background:#f0fdf4"><span style="color:#15803d;font-weight:900">&#10004; Amount Paid</span><br>&#8377;${formatIndian(invoice.total_amount)} Paid</div>` : ''}
  <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;border-bottom:${bdr}">
    <div style="padding:14px 20px;border-right:${div};font-size:12.5px;color:#000">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:6px">Bank Details</div>
      ${org.bank_name ? `<p style="margin:2px 0;color:#000;font-weight:600"><strong>Bank:</strong> ${org.bank_name}</p>` : ''}
      ${org.account_no ? `<p style="margin:2px 0;color:#000;font-weight:600"><strong>A/C #:</strong> ${org.account_no}</p>` : ''}
      ${org.ifsc ? `<p style="margin:2px 0;color:#000;font-weight:600"><strong>IFSC:</strong> ${org.ifsc}</p>` : ''}
      ${org.branch ? `<p style="margin:2px 0;color:#000;font-weight:600"><strong>Branch:</strong> ${org.branch}</p>` : ''}
      ${org.upi_id ? `<p style="margin:2px 0;color:#000;font-weight:600"><strong>UPI ID:</strong> ${org.upi_id}</p>` : ''}
    </div>
    <div style="padding:14px 20px;border-right:${div};font-size:12.5px;color:#000">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:6px">Pay using UPI</div>
      ${d.qrUrl ? `<img src="${d.qrUrl}" style="width:120px;height:120px;margin-top:4px;border-radius:4px">` : `<div style="width:120px;height:120px;border:1px solid #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;font-weight:600;margin-top:4px;background:#fafbfc">QR CODE</div>`}
    </div>
    <div style="padding:14px 20px;font-size:12.5px;text-align:right;color:#000">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:6px">For ${(org.name || '').toUpperCase()}</div>
      <div style="width:130px;height:70px;display:inline-block;position:relative;margin-top:8px">
        ${org.stamp_url ? `<img src="${org.stamp_url}" style="position:absolute;width:130px;height:70px;object-fit:contain;opacity:0.85">` : ''}
        ${org.signature_url ? `<img src="${org.signature_url}" style="position:relative;z-index:1;max-height:50px;max-width:100px;object-fit:contain">` : ''}
      </div>
      <div style="border-top:1.5px solid #000;display:inline-block;padding-top:4px;font-weight:800;font-size:11px;margin-top:6px;color:#000">Authorized Signatory</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr">
    <div style="padding:12px 20px;border-right:${div};font-size:12px;line-height:1.6;color:#000;font-weight:600">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:4px">Notes</div>
      <p style="margin:0;color:#000">${invoice.notes || 'Thank you for the Business'}</p>
    </div>
    <div style="padding:12px 20px;font-size:12px;line-height:1.6;color:#000;font-weight:600">
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin-bottom:4px">Terms and Conditions</div>
      <ol style="margin:0;padding-left:16px;color:#000">
        <li>Goods once sold cannot be taken back or exchanged.</li>
        <li>Interest @18% p.a. will be charged for uncleared bills beyond 15 days.</li>
        <li>Subject to Maharashtra jurisdiction only.</li>
      </ol>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,#06b6d4,#3b82f6,#8b5cf6,#06b6d4)"></div>
  <div style="text-align:center;padding:8px 20px;font-size:10px;color:#999;border-top:${bdr};font-weight:600;letter-spacing:0.5px">PAGE 1 / 1 &nbsp;&#8226;&nbsp; This is a computer generated invoice.</div>
</div>
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════
   CLASSIC INVOICE HTML — Original HUL/ITC style
   ═══════════════════════════════════════════════════════════════ */
function generateClassicInvoiceHTML(invoice, items, org) {
  const d = buildSharedData(invoice, items, org);
  const bdr = '1.5px solid #1a1a1a';

  const itemsHTML = items.map((item, i) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const taxable = qty * rate;
    const taxRate = (parseFloat(item.igst_rate) || 0) > 0 ? parseFloat(item.igst_rate) : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate));
    return `<tr style="border-bottom:1px solid #e0e0e0">
      <td style="padding:8px 10px;font-weight:600;color:#000">${i+1}</td>
      <td style="padding:8px 10px;line-height:1.4;font-weight:600;color:#000">${item.description || ''}</td>
      <td style="padding:8px 10px;font-weight:600;color:#000">${item.hsn_code || '—'}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:#000">${taxRate > 0 ? taxRate + '%' : '—'}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:600;color:#000">${qty} ${item.unit || 'NOS'}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:600;color:#000">${formatIndian(rate)}</td>
      <td style="padding:8px 10px;text-align:center;font-weight:600;color:#000">${item.unit || 'NOS'}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;color:#000">${formatIndian(taxable)}</td>
    </tr>`;
  }).join('');

  let summaryRows = '';
  summaryRows += `<tr style="font-style:italic"><td style="border-top:1px solid #ddd;padding:8px 10px;font-weight:700;color:#000"></td><td colspan="6" style="border-top:1px solid #ddd;padding:8px 10px;text-align:right;font-weight:700;color:#000">Taxable Amount</td><td style="border-top:1px solid #ddd;padding:8px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(invoice.subtotal)}</td></tr>`;
  if (d.hasCGST) {
    summaryRows += `<tr style="font-style:italic"><td style="border-top:1px solid #ddd;padding:6px 10px;color:#000"></td><td colspan="6" style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">CGST ${d.cgstRate.toFixed(1)}%</td><td style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(d.cgstAmount)}</td></tr>`;
    summaryRows += `<tr style="font-style:italic"><td style="border-top:1px solid #ddd;padding:6px 10px;color:#000"></td><td colspan="6" style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">SGST ${d.sgstRate.toFixed(1)}%</td><td style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(d.sgstAmount)}</td></tr>`;
  }
  if (d.hasIGST || d.igstAmount > 0) {
    summaryRows += `<tr style="font-style:italic"><td style="border-top:1px solid #ddd;padding:6px 10px;color:#000"></td><td colspan="6" style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">IGST ${d.igstRate.toFixed(1)}%</td><td style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">&#8377;${formatIndian(d.igstAmount)}</td></tr>`;
  }
  if (parseFloat(invoice.discount) > 0) {
    summaryRows += `<tr style="font-style:italic"><td style="border-top:1px solid #ddd;padding:6px 10px;color:#000"></td><td colspan="6" style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">Discount</td><td style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">-&#8377;${formatIndian(invoice.discount)}</td></tr>`;
  }
  if (parseFloat(invoice.round_off) !== 0) {
    summaryRows += `<tr style="font-style:italic"><td style="border-top:1px solid #ddd;padding:6px 10px;color:#000"></td><td colspan="6" style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">Round Off</td><td style="border-top:1px solid #ddd;padding:6px 10px;text-align:right;font-weight:700;color:#000">${parseFloat(invoice.round_off) > 0 ? '+' : ''}&#8377;${formatIndian(Math.abs(invoice.round_off))}</td></tr>`;
  }
  summaryRows += `<tr style="border-top:${bdr}"><td style="padding:10px;color:#000"></td><td colspan="3" style="font-weight:900;font-size:15px;padding:10px;color:#000">Total</td><td style="font-weight:900;font-size:15px;padding:10px;text-align:right;color:#000">${d.totalQty.toFixed(3)}</td><td style="padding:10px"></td><td style="padding:10px"></td><td style="font-weight:900;font-size:15px;padding:10px;text-align:right;color:#000">&#8377;${formatIndian(invoice.total_amount)}</td></tr>`;

  let hsnRows = '';
  Object.entries(d.hsnMap).forEach(([hsn, hsnD]) => {
    hsnRows += `<tr>
      <td style="border:1px solid #999;padding:6px 10px;font-weight:700;color:#000">${hsn}</td>
      <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.taxable)}</td>
      ${d.hasCGST ? `
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${hsnD.cgstRate}%</td>
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.cgstAmt)}</td>
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${hsnD.sgstRate}%</td>
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.sgstAmt)}</td>
      ` : `
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${hsnD.igstRate}%</td>
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:600;color:#000">${formatIndian(hsnD.igstAmt)}</td>
      `}
      <td style="border:1px solid #999;padding:6px 10px;text-align:right;font-weight:800;color:#000">${formatIndian(hsnD.cgstAmt + hsnD.sgstAmt + hsnD.igstAmt)}</td>
    </tr>`;
  });

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Tax Invoice</title><style>
  * { box-sizing: border-box; }
  body { font-family: ${d.fontFamily}; background: #f2f2f2; margin: 0; padding: 20px; color: #000; font-weight: 600; }
  .invoice { max-width: 900px; margin: 0 auto; background: #fff; border: 1.5px solid #1a1a1a; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; }
  @media print { body { background: #fff; padding: 0; } .invoice { border: none; } }
  </style></head><body>
<div class="invoice">
  <div style="text-align:center;padding:14px 0 8px;position:relative;border-bottom:${bdr}">
    <h1 style="font-size:22px;letter-spacing:6px;margin:0;font-weight:900;color:#000">TAX INVOICE</h1>
    <span style="position:absolute;right:20px;top:16px;font-size:12px;color:#000;letter-spacing:1px;font-weight:700">ORIGINAL FOR RECIPIENT</span>
  </div>
  <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr;border-bottom:${bdr}">
    <div style="padding:16px 20px;border-right:${bdr};display:flex;gap:14px;align-items:flex-start">
      <div style="width:70px;height:70px;flex-shrink:0">
        ${org.logo_url ? `<img src="${org.logo_url}" style="width:70px;height:70px;object-fit:contain">` : '<div style="width:70px;height:70px;border:1.5px solid #333;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:800">LOGO</div>'}
      </div>
      <div>
        <p style="font-size:20px;font-weight:900;margin:0 0 4px;line-height:1.2;color:#000">${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</p>
        ${org.gstin ? `<p style="margin:2px 0;font-size:12.5px;color:#000;line-height:1.4;font-weight:700">GSTIN ${org.gstin}</p>` : ''}
        <p style="margin:2px 0;font-size:12.5px;color:#000;line-height:1.4">${[org.address, org.city].filter(Boolean).join(', ')}</p>
        <p style="margin:2px 0;font-size:12.5px;color:#000;line-height:1.4">${[org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</p>
        ${org.phone ? `<p style="margin:2px 0;font-size:12.5px;color:#000;line-height:1.4">Mobile ${org.phone}</p>` : ''}
      </div>
    </div>
    <div style="padding:16px 18px;border-right:${bdr}">
      <div style="font-size:13px;color:#000;margin-bottom:2px;font-weight:700">Invoice #:</div>
      <div style="font-weight:800;font-size:14px;margin-bottom:16px;line-height:1.3;color:#000">${d.invNum}</div>
      <div style="font-size:13px;color:#000;margin-bottom:2px;font-weight:700">Place of Supply:</div>
      <div style="font-weight:800;font-size:14px;line-height:1.3;color:#000">${d.placeOfSupply}</div>
    </div>
    <div style="padding:16px 18px">
      <div style="font-size:13px;color:#000;margin-bottom:2px;font-weight:700">Invoice Date:</div>
      <div style="font-weight:800;font-size:14px;line-height:1.3;color:#000">${d.invoiceDate}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:${bdr}">
    <div style="padding:14px 20px;border-right:${bdr};font-size:12.5px;line-height:1.5;color:#000">
      <h3 style="margin:0 0 6px;font-size:13px;font-weight:800;color:#000">Customer Details:</h3>
      <p style="font-weight:800;margin:0 0 2px;font-size:13px;color:#000">${(invoice.customer_name || '').toUpperCase()}</p>
      ${d.custGstin ? `<p style="margin:2px 0;font-weight:700;color:#000">GSTIN: ${d.custGstin}</p>` : ''}
      <p style="margin:2px 0;font-weight:700;color:#000">Billing address:</p>
      <p style="margin:2px 0;color:#000">${[invoice.customer_address, invoice.customer_city].filter(Boolean).join(', ')}</p>
      <p style="margin:2px 0;color:#000">${[invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</p>
      ${invoice.customer_phone ? `<p style="margin:2px 0;color:#000">Ph: ${invoice.customer_phone}</p>` : ''}
    </div>
    <div style="padding:14px 20px;font-size:12.5px;line-height:1.5;color:#000">
      <h3 style="margin:0 0 6px;font-size:13px;font-weight:800;color:#000">Shipping address:</h3>
      <p style="margin:2px 0;color:#000">${[invoice.customer_address, invoice.customer_city].filter(Boolean).join(', ')}</p>
      <p style="margin:2px 0;color:#000">${[invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</p>
    </div>
  </div>
  <div style="border-bottom:${bdr}">
    <table style="font-size:13px;color:#000">
      <thead><tr style="border-bottom:${bdr}">
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};white-space:nowrap;color:#000">#</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};color:#000">Item</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};color:#000">HSN/SAC</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};text-align:right;white-space:nowrap;color:#000">Tax</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};text-align:right;white-space:nowrap;color:#000">Qty</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};text-align:center;white-space:nowrap;color:#000">Rate/Item</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};text-align:center;color:#000">Per</th>
        <th style="padding:10px 10px;font-size:12.5px;font-weight:800;border-bottom:${bdr};text-align:right;color:#000">Amount</th>
      </tr></thead>
      <tbody>${itemsHTML}${summaryRows}</tbody>
    </table>
  </div>
  <div style="padding:10px 20px;font-size:13px;border-bottom:${bdr};line-height:1.5;color:#000;font-weight:700">
    Amount Chargeable (in words): <strong>INR ${numberToWords(invoice.total_amount)}</strong> &nbsp;<em style="font-size:12px;color:#333;font-weight:600">E & O.E</em>
  </div>
  <table style="font-size:12.5px;border-bottom:${bdr};color:#000">
    <thead><tr>
      <th style="border:1px solid #999;padding:6px 10px;text-align:left;background:#f0f0f0;font-weight:800;color:#000" rowSpan="2">HSN/SAC</th>
      <th style="border:1px solid #999;padding:6px 10px;text-align:right;background:#f0f0f0;font-weight:800;color:#000" rowSpan="2">Taxable Value</th>
      ${d.hasCGST ? `
        <th style="border:1px solid #999;padding:6px 10px;text-align:right;background:#f0f0f0;font-weight:800;color:#000" colSpan="2">Central Tax</th>
        <th style="border:1px solid #999;padding:6px 10px;text-align:right;background:#f0f0f0;font-weight:800;color:#000" colSpan="2">State Tax</th>
      ` : `<th style="border:1px solid #999;padding:6px 10px;text-align:right;background:#f0f0f0;font-weight:800;color:#000" colSpan="2">Integrated Tax</th>`}
      <th style="border:1px solid #999;padding:6px 10px;text-align:right;background:#f0f0f0;font-weight:800;color:#000" rowSpan="2">Total Tax Amount</th>
    </tr><tr>
      <th style="border:1px solid #999;padding:4px 10px;text-align:right;background:#f0f0f0;font-weight:700;color:#000">Rate</th>
      <th style="border:1px solid #999;padding:4px 10px;text-align:right;background:#f0f0f0;font-weight:700;color:#000">Amount</th>
      ${d.hasCGST ? `<th style="border:1px solid #999;padding:4px 10px;text-align:right;background:#f0f0f0;font-weight:700;color:#000">Rate</th><th style="border:1px solid #999;padding:4px 10px;text-align:right;background:#f0f0f0;font-weight:700;color:#000">Amount</th>` : ''}
    </tr></thead>
    <tbody>
      ${hsnRows}
      <tr style="font-weight:800;background:#f0f0f0;color:#000">
        <td style="border:1px solid #999;padding:6px 10px;color:#000">TOTAL</td>
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;color:#000">${formatIndian(invoice.subtotal)}</td>
        ${d.hasCGST ? `
          <td style="border:1px solid #999;padding:6px 10px;color:#000"></td>
          <td style="border:1px solid #999;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.cgstAmount)}</td>
          <td style="border:1px solid #999;padding:6px 10px;color:#000"></td>
          <td style="border:1px solid #999;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.sgstAmount)}</td>
        ` : `<td style="border:1px solid #999;padding:6px 10px;color:#000"></td><td style="border:1px solid #999;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.igstAmount)}</td>`}
        <td style="border:1px solid #999;padding:6px 10px;text-align:right;color:#000">${formatIndian(d.totalTax)}</td>
      </tr>
    </tbody>
  </table>
  ${d.isPaid ? `<div style="text-align:right;padding:10px 20px;border-bottom:${bdr};font-size:13px;color:#000;font-weight:800"><span style="color:#1a7d3a;font-weight:900">&#10004; Amount Paid</span><br>&#8377;${formatIndian(invoice.total_amount)} Paid</div>` : ''}
  <div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;border-bottom:${bdr}">
    <div style="padding:16px 20px;border-right:${bdr};font-size:13px;color:#000">
      <h4 style="margin:0 0 8px;font-weight:800;color:#000">Bank Details:</h4>
      ${org.bank_name ? `<p style="margin:3px 0;color:#000"><strong>Bank:</strong> ${org.bank_name}</p>` : ''}
      ${org.account_no ? `<p style="margin:3px 0;color:#000"><strong>Account #:</strong> ${org.account_no}</p>` : ''}
      ${org.ifsc ? `<p style="margin:3px 0;color:#000"><strong>IFSC:</strong> ${org.ifsc}</p>` : ''}
      ${org.branch ? `<p style="margin:3px 0;color:#000"><strong>Branch:</strong> ${org.branch}</p>` : ''}
      ${org.upi_id ? `<p style="margin:3px 0;color:#000"><strong>UPI ID:</strong> ${org.upi_id}</p>` : ''}
    </div>
    <div style="padding:16px 20px;border-right:${bdr};font-size:13px;color:#000">
      <h4 style="margin:0 0 8px;font-weight:800;color:#000">Pay using UPI:</h4>
      ${d.qrUrl ? `<img src="${d.qrUrl}" style="width:130px;height:130px;margin-top:6px">` : '<div style="width:130px;height:130px;border:1px solid #333;display:flex;align-items:center;justify-content:center;font-size:11px;color:#000;font-weight:700;margin-top:6px">QR CODE</div>'}
    </div>
    <div style="padding:16px 20px;font-size:13px;text-align:right;color:#000">
      <h4 style="margin:0 0 8px;font-weight:800;color:#000">For ${(org.name || '').toUpperCase()}</h4>
      <div style="width:140px;height:80px;display:inline-block;position:relative;margin-top:10px">
        ${org.stamp_url ? `<img src="${org.stamp_url}" style="position:absolute;width:140px;height:80px;object-fit:contain;opacity:0.85">` : ''}
        ${org.signature_url ? `<img src="${org.signature_url}" style="position:relative;z-index:1;max-height:55px;max-width:110px;object-fit:contain">` : ''}
      </div>
      <div style="border-top:1px solid #000;display:inline-block;padding-top:4px;font-weight:800;font-size:12px;margin-top:8px;color:#000">Authorized Signatory</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr">
    <div style="padding:14px 20px;border-right:${bdr};font-size:12.5px;line-height:1.6;color:#000;font-weight:600">
      <h4 style="margin:0 0 6px;font-weight:800;color:#000">Notes:</h4>
      <p style="margin:0;color:#000">${invoice.notes || 'Thank you for the Business'}</p>
    </div>
    <div style="padding:14px 20px;font-size:12.5px;line-height:1.6;color:#000;font-weight:600">
      <h4 style="margin:0 0 6px;font-weight:800;color:#000">Terms and Conditions:</h4>
      <ol style="margin:0;padding-left:18px;color:#000">
        <li>Goods once sold cannot be taken back or exchanged.</li>
        <li>Interest @18% p.a. will be charged for uncleared bills beyond 15 days.</li>
        <li>Subject to Maharashtra jurisdiction only.</li>
      </ol>
    </div>
  </div>
  <div style="text-align:left;padding:8px 20px;font-size:11.5px;color:#000;border-top:${bdr};font-weight:600">Page 1 / 1 &nbsp; This is a computer generated invoice.</div>
</div>
</body></html>`;
}

module.exports = router;
