const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

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
  dateFields.forEach(f => { if (clean[f] === '' || clean[f] === undefined) clean[f] = null; });
  return clean;
}

function sanitizeItem(item, invoiceId) {
  const hasTaxRate = item.tax_rate !== undefined && item.tax_rate !== null;
  const hasCgstRate = item.cgst_rate !== undefined && item.cgst_rate !== null;
  let cgstRate = parseFloat(item.cgst_rate) || 0;
  let sgstRate = parseFloat(item.sgst_rate) || 0;
  let igstRate = parseFloat(item.igst_rate) || 0;
  if (hasTaxRate && !hasCgstRate) {
    const tr = parseFloat(item.tax_rate) || 0;
    if (igstRate > 0) { igstRate = tr; cgstRate = 0; sgstRate = 0; }
    else { cgstRate = tr / 2; sgstRate = tr / 2; igstRate = 0; }
  }
  const qty = parseFloat(item.quantity) || 0;
  const rate = parseFloat(item.rate) || 0;
  return { invoice_id: invoiceId, description: item.description || '', hsn_code: item.hsn_code || '', quantity: qty, unit: item.unit || 'NOS', rate, cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate, amount: parseFloat(item.amount) || (qty * rate) };
}

const VALID_INVOICE_COLUMNS = ['organization_id','invoice_number','customer_id','invoice_date','due_date','subtotal','cgst_amount','sgst_amount','igst_amount','discount','round_off','total_amount','status','payment_status','notes','irn_number','ack_no','ack_date'];
function sanitizeInvoiceData(data) { const clean = {}; VALID_INVOICE_COLUMNS.forEach(col => { if (data[col] !== undefined) clean[col] = data[col]; }); return clean; }

// ═══ GET NEXT INVOICE NUMBER — FORMAT: 26270014 → 26270015 ═══
// Format = YY + nextYY + 4-digit sequential (e.g. 2627 + 0014 = 26270014)
router.get('/next-number', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const now = new Date();
    const m = now.getMonth(); const y = now.getFullYear();
    const fyStart = m >= 3 ? y : y - 1;
    const prefix = String(fyStart % 100) + String((fyStart + 1) % 100); // e.g. "2627"

    // Find all invoice numbers for this org
    const allInvoices = await db('invoices').where({ organization_id: orgId }).select('invoice_number');
    const existingNumbers = new Set(allInvoices.map(i => i.invoice_number));

    // Find max numeric part for this FY prefix
    let maxSeq = 0;
    allInvoices.forEach(inv => {
      if (!inv.invoice_number) return;
      const num = inv.invoice_number;
      // Check if it starts with our FY prefix (e.g. "2627")
      if (num.startsWith(prefix)) {
        const seqPart = num.substring(prefix.length);
        const parsed = parseInt(seqPart);
        if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
      }
      // Also check pure numeric format
      const pureNum = parseInt(num);
      if (!isNaN(pureNum) && num.length >= 8) {
        const numPrefix = num.substring(0, 4);
        if (numPrefix === prefix) {
          const seq = parseInt(num.substring(4));
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    let nextSeq = maxSeq + 1;
    let nextNumber = prefix + String(nextSeq).padStart(4, '0');

    // Double-check no duplicate
    let attempts = 0;
    while (existingNumbers.has(nextNumber) && attempts < 100) {
      nextSeq++;
      nextNumber = prefix + String(nextSeq).padStart(4, '0');
      attempts++;
    }

    res.json({ success: true, nextNumber, nextNumeric: nextSeq, prefix, fy: prefix });
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
  } catch (err) { console.error('List invoices error:', err); res.status(500).json({ success: false, msg: 'Failed', invoices: [], stats: {} }); }
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
    if (invoiceData.invoice_number && invoiceData.invoice_number.trim()) {
      invoiceNumber = invoiceData.invoice_number.trim();
    } else {
      const now = new Date(); const m = now.getMonth(); const y = now.getFullYear();
      const fyStart = m >= 3 ? y : y - 1;
      const prefix = String(fyStart % 100) + String((fyStart + 1) % 100);
      const allInvoices = await db('invoices').where({ organization_id: orgId }).select('invoice_number');
      let maxSeq = 0;
      allInvoices.forEach(inv => { if (inv.invoice_number && inv.invoice_number.startsWith(prefix)) { const s = parseInt(inv.invoice_number.substring(prefix.length)); if (!isNaN(s) && s > maxSeq) maxSeq = s; } });
      invoiceNumber = prefix + String(maxSeq + 1).padStart(4, '0');
    }

    // Duplicate check — auto-increment if exists
    const existing = await db('invoices').where({ organization_id: orgId, invoice_number: invoiceNumber }).first('id');
    if (existing) {
      const now = new Date(); const m = now.getMonth(); const y = now.getFullYear();
      const fyStart = m >= 3 ? y : y - 1;
      const prefix = String(fyStart % 100) + String((fyStart + 1) % 100);
      const allInvoices = await db('invoices').where({ organization_id: orgId }).select('invoice_number');
      const existingSet = new Set(allInvoices.map(i => i.invoice_number));
      let maxSeq = 0;
      allInvoices.forEach(inv => { if (inv.invoice_number && inv.invoice_number.startsWith(prefix)) { const s = parseInt(inv.invoice_number.substring(prefix.length)); if (!isNaN(s) && s > maxSeq) maxSeq = s; } });
      let nextSeq = maxSeq + 1;
      let newNum = prefix + String(nextSeq).padStart(4, '0');
      let att = 0;
      while (existingSet.has(newNum) && att < 100) { nextSeq++; newNum = prefix + String(nextSeq).padStart(4, '0'); att++; }
      invoiceNumber = newNum;
    }

    const data = sanitizeDates(sanitizeInvoiceData({ ...invoiceData, organization_id: orgId, invoice_number: invoiceNumber }));
    const [invoice] = await db('invoices').insert(data).returning('id');
    const invoiceId = invoice.id || invoice;
    if (items && items.length > 0) { await db('invoice_items').insert(items.map(item => sanitizeItem(item, invoiceId))); }
    await auditLog(req.user.id, orgId, 'CREATE', 'invoices', invoiceId, null, data, req.ip);
    res.status(201).json({ success: true, invoice: { id: invoiceId, invoice_number: invoiceNumber } });
  } catch (err) { console.error('Create invoice error:', err); res.status(500).json({ success: false, msg: 'Failed: ' + err.message }); }
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
  } catch (err) { console.error('Update error:', err); res.status(500).json({ success: false, msg: 'Failed: ' + err.message }); }
});

// Simple update
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const old = await db('invoices').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Not found' });
    const cleanData = sanitizeInvoiceData(req.body);
    await db('invoices').where({ id: req.params.id }).update(cleanData);
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'invoices', req.params.id, old, cleanData, req.ip);
    res.json({ success: true, msg: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

// Delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Not found' });
    await db('invoice_items').where({ invoice_id: req.params.id }).del();
    await db('invoices').where({ id: req.params.id }).del();
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'invoices', req.params.id, invoice, null, req.ip);
    res.json({ success: true, msg: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

function pdfAuth(req, res, next) {
  const jwt = require('jsonwebtoken'); const config = require('../config/env');
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) token = req.query.token;
  if (!token) return res.status(401).json({ success: false, msg: 'Login required' });
  try { req.user = jwt.verify(token, config.JWT_SECRET); next(); } catch { return res.status(401).json({ success: false, msg: 'Invalid token' }); }
}

router.get('/:id/pdf', pdfAuth, async (req, res) => {
  try {
    const db = getDb();
    const invoice = await db('invoices').where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.*', db.raw("COALESCE(customers.name, '(No Customer)') as customer_name"), 'customers.gstin as customer_gstin', 'customers.address as customer_address', 'customers.city as customer_city', 'customers.state as customer_state', 'customers.state_code as customer_state_code', 'customers.pincode as customer_pincode', 'customers.phone as customer_phone').first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Not found' });
    const items = await db('invoice_items').where({ invoice_id: invoice.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const html = generateInvoiceHTML(invoice, items, org);
    try { const puppeteer = require('puppeteer'); const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] }); const page = await browser.newPage(); await page.setContent(html, { waitUntil: 'networkidle0' }); const pdf = await page.pdf({ format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true }); await browser.close(); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`); res.send(pdf); } catch (e) { res.setHeader('Content-Type', 'text/html'); res.send(html); }
  } catch (err) { res.status(500).json({ success: false, msg: 'PDF failed: ' + err.message }); }
});

router.post('/:id/share-email', pdfAuth, async (req, res) => {
  try {
    const { to } = req.body; if (!to) return res.status(400).json({ success: false, msg: 'Email required' });
    const db = getDb(); const invoice = await db('invoices').where({ 'invoices.id': req.params.id, 'invoices.organization_id': req.user.organization_id }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.*', db.raw("COALESCE(customers.name, '(No Customer)') as customer_name"), 'customers.gstin as customer_gstin', 'customers.address as customer_address', 'customers.city as customer_city', 'customers.state as customer_state', 'customers.state_code as customer_state_code', 'customers.pincode as customer_pincode', 'customers.phone as customer_phone').first();
    if (!invoice) return res.status(404).json({ success: false, msg: 'Not found' });
    const items = await db('invoice_items').where({ invoice_id: invoice.id }); const org = await db('organizations').where({ id: req.user.organization_id }).first();
    try { const nodemailer = require('nodemailer'); if (!process.env.SMTP_HOST) throw new Error('No SMTP'); const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT) || 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }); await transporter.sendMail({ from: `"${org.name}" <${process.env.SMTP_USER}>`, to, subject: `Tax Invoice ${invoice.invoice_number}`, html: `<p>Invoice ${invoice.invoice_number}, Total: ₹${formatIndian(invoice.total_amount)}</p>`, attachments: [{ filename: `Invoice_${invoice.invoice_number}.html`, content: generateInvoiceHTML(invoice, items, org), contentType: 'text/html' }] }); return res.json({ success: true, msg: 'Sent!' }); } catch (e) { return res.json({ success: false, msg: 'SMTP not configured' }); }
  } catch (err) { res.status(500).json({ success: false, msg: 'Failed' }); }
});

function formatIndian(num) { if (num == null || isNaN(num)) return '0.00'; return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(num)); }

const STATE_NAMES = { '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar','36':'Telangana','37':'Ladakh','38':'Other Territory' };

function generateInvoiceHTML(invoice, items, org) {
  function numberToWords(num) { const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']; const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']; function inW(n) { if (n < 20) return a[n]; if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : ''); if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+inW(n%100) : ''); if (n < 100000) return inW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+inW(n%1000) : ''); if (n < 10000000) return inW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+inW(n%100000) : ''); return inW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+inW(n%10000000) : ''); } const rupees = Math.round(Math.floor(num)); const paise = Math.round((num - Math.floor(num)) * 100); let result = inW(rupees) + ' Rupees'; if (paise > 0) result += ' and ' + inW(paise) + ' Paise'; return result + ' Only'; }

  const invNum = invoice.invoice_number || '';
  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27');
  const custGstin = invoice.customer_gstin || '';
  const custStateCode = invoice.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '');
  const isIntraState = custStateCode && custStateCode === orgStateCode;
  const hasCGST = isIntraState || parseFloat(invoice.cgst_amount) > 0;
  const totalTax = parseFloat(invoice.cgst_amount || 0) + parseFloat(invoice.sgst_amount || 0) + parseFloat(invoice.igst_amount || 0);
  const cgstAmount = parseFloat(invoice.cgst_amount || 0); const sgstAmount = parseFloat(invoice.sgst_amount || 0); const igstAmount = parseFloat(invoice.igst_amount || 0);
  const cgstRate = isIntraState ? (parseFloat(items[0]?.igst_rate || 18) / 2) : (parseFloat(items[0]?.cgst_rate || 0));
  const sgstRate = isIntraState ? (parseFloat(items[0]?.igst_rate || 18) / 2) : (parseFloat(items[0]?.sgst_rate || 0));
  const igstRate = !isIntraState ? (parseFloat(items[0]?.igst_rate || 18)) : 0;
  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid';
  const custStateName = invoice.customer_state || (custStateCode ? (STATE_NAMES[custStateCode] || '') : '');
  const placeOfSupply = custStateCode ? custStateCode + ' - ' + custStateName : orgStateCode + ' - ' + (org.state || '');
  const invoiceDate = formatDate(invoice.invoice_date);
  const upiId = org.upi_id || '';
  const upiName = encodeURIComponent((org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and'));
  const upiAmount = parseFloat(invoice.total_amount || 0).toFixed(2);
  const qrUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${upiName}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invNum)}`)}` : '';
  const hsnMap = {};
  items.forEach(item => { const hsn = item.hsn_code || 'Others'; if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }; const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate; hsnMap[hsn].taxable += taxable; hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0; hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0; hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0; hsnMap[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100; hsnMap[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100; hsnMap[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100; });
  const itemsHTML = items.map((item, i) => { const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate; const taxRate = (parseFloat(item.igst_rate) || 0) > 0 ? parseFloat(item.igst_rate) : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate)); const taxAmt = taxable * taxRate / 100; const total = taxable + taxAmt; return `<tr><td style="border:1px solid #000;padding:3px 4px;text-align:center">${i+1}</td><td style="border:1px solid #000;padding:3px 4px;line-height:1.3;white-space:pre-line">${item.description || ''}</td><td style="border:1px solid #000;padding:3px 4px;text-align:center">${item.hsn_code || '—'}</td><td style="border:1px solid #000;padding:3px 4px;text-align:right">${formatIndian(rate)}</td><td style="border:1px solid #000;padding:3px 4px;text-align:center">${qty} ${item.unit || 'NOS'}</td><td style="border:1px solid #000;padding:3px 4px;text-align:right">${formatIndian(taxable)}</td><td style="border:1px solid #000;padding:3px 4px;text-align:center">${taxRate > 0 ? taxRate + '%' : '—'}</td><td style="border:1px solid #000;padding:3px 4px;text-align:right">${formatIndian(taxAmt)}</td><td style="border:1px solid #000;padding:3px 4px;text-align:right;font-weight:bold">${formatIndian(total)}</td></tr>`; }).join('');
  const emptyRows = items.length < 12 ? Array.from({length: 12 - items.length}).map(() => `<tr style="height:20px"><td style="border:1px solid #000;padding:2px">&nbsp;</td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td><td style="border:1px solid #000;padding:2px"></td></tr>`).join('') : '';
  let hsnRows = ''; Object.entries(hsnMap).forEach(([hsn, data]) => { hsnRows += `<tr><td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${hsn}</td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.taxable)}</td>${hasCGST ? `<td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${data.cgstRate}%</td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.cgstAmt)}</td><td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${data.sgstRate}%</td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.sgstAmt)}</td>` : `<td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">${data.igstRate}%</td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">${formatIndian(data.igstAmt)}</td>`}<td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt;font-weight:bold">${formatIndian(data.cgstAmt + data.sgstAmt + data.igstAmt)}</td></tr>`; });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;color:#1a1a1a}.page{width:210mm;min-height:297mm;display:flex;flex-direction:column;overflow:hidden}table{width:100%;border-collapse:collapse}th{border:1px solid #000;padding:4px 3px;background:#e8e8e8;text-align:center;font-size:7.5pt;font-weight:700}</style></head><body><div class="page">
    <div style="display:flex;border-bottom:3px solid #000;padding:10px 14px;flex-shrink:0"><div style="width:72px;height:72px;border:2px solid #000;border-radius:4px;display:flex;align-items:center;justify-content:center;margin-right:14px;flex-shrink:0;background:#fafafa">${org.logo_url ? `<img src="${org.logo_url}" style="max-width:62px;max-height:62px;object-fit:contain">` : '<span style="font-size:6px;color:#aaa">LOGO</span>'}</div><div style="flex:1"><div style="font-size:17pt;font-weight:900;letter-spacing:1px;color:#111">${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div><div style="font-size:8pt;color:#333;margin-top:2px">${[org.address, org.city, org.state, org.pincode ? 'PIN: '+org.pincode : ''].filter(Boolean).join(', ')}</div><div style="display:flex;gap:16px;margin-top:3px;font-size:8pt;color:#444;flex-wrap:wrap">${org.gstin ? `<span><b>GSTIN:</b> ${org.gstin}</span>` : ''}${org.phone ? `<span><b>Mobile:</b> ${org.phone}</span>` : ''}${org.email ? `<span><b>Email:</b> ${org.email}</span>` : ''}</div></div></div>
    <div style="text-align:center;padding:5px 0;border-bottom:3px solid #000;flex-shrink:0;background:#f0f0f0"><div style="font-size:14pt;font-weight:900;letter-spacing:3px;color:#111">TAX INVOICE</div><div style="font-size:7pt;font-weight:700;color:#555">ORIGINAL FOR RECIPIENT</div></div>
    <div style="display:flex;border-bottom:2px solid #000;flex-shrink:0"><div style="flex:1;padding:8px 12px;border-right:2px solid #000"><div style="font-size:9pt;font-weight:700;color:#0a3d6b;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:6px">Customer Details</div><div style="font-size:12pt;font-weight:700;text-transform:uppercase;margin-bottom:3px">${(invoice.customer_name || '').toUpperCase()}</div>${invoice.customer_gstin ? `<div style="font-size:9pt;margin-bottom:2px"><span style="color:#555">GSTIN:</span> <b>${invoice.customer_gstin}</b></div>` : ''}<div style="font-size:9pt;color:#333;line-height:1.5"><span style="color:#555">Billing address:</span><br/>${[invoice.customer_address, invoice.customer_city, invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</div>${invoice.customer_phone ? `<div style="font-size:9pt;color:#333;margin-top:2px">Ph: ${invoice.customer_phone}</div>` : ''}</div><div style="width:240px;flex-shrink:0;display:flex;flex-direction:column;font-size:9pt"><div style="display:flex;border-bottom:1px solid #000"><div style="flex:1;padding:5px 8px;border-right:1px solid #000"><div style="color:#555;font-weight:600">Invoice #:</div><div style="font-weight:800">${invNum}</div></div><div style="flex:1;padding:5px 8px"><div style="color:#555;font-weight:600">Date:</div><div style="font-weight:800">${invoiceDate}</div></div></div><div style="display:flex;border-bottom:1px solid #000"><div style="flex:1;padding:5px 8px;border-right:1px solid #000"><div style="color:#555;font-weight:600">Place of Supply:</div><div style="font-weight:800">${placeOfSupply}</div></div><div style="flex:1;padding:5px 8px"><div style="color:#555;font-weight:600">Reverse Charge:</div><div style="font-weight:800">No</div></div></div><div style="display:flex"><div style="flex:1;padding:5px 8px;border-right:1px solid #000"><div style="color:#555;font-weight:600">Payment:</div><div style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:8pt;font-weight:700;${isPaid ? 'background:#d4edda;color:#155724' : 'background:#fff3cd;color:#856404'}">${isPaid ? '✓ PAID' : '● UNPAID'}</div></div><div style="flex:1;padding:5px 8px"><div style="color:#555;font-weight:600">State:</div><div style="font-weight:800">${isIntraState ? 'Intra' : 'Inter'}</div></div></div></div></div>
    <div style="flex:1;display:flex;flex-direction:column"><table style="font-size:8pt;flex:1"><thead><tr><th style="width:4%">#</th><th style="width:24%">Item Description</th><th style="width:8%">HSN/SAC</th><th style="width:10%">Rate (₹)</th><th style="width:6%">Qty</th><th style="width:12%">Taxable (₹)</th><th style="width:8%">GST %</th><th style="width:12%">Tax Amt (₹)</th><th style="width:14%">Total (₹)</th></tr></thead><tbody>${itemsHTML}${emptyRows}</tbody></table>
    <table style="font-size:8.5pt;flex-shrink:0"><tbody><tr><td style="border:1px solid #000;padding:4px 8px;text-align:right;width:74%;background:#fafafa">Taxable Amount</td><td style="border:1px solid #000;padding:4px 8px;text-align:right">₹${formatIndian(invoice.subtotal)}</td></tr>${cgstAmount > 0 ? `<tr style="background:#f0f0ff"><td style="border:1px solid #000;padding:3px 6px;text-align:right">CGST @ ${cgstRate.toFixed(1)}%</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">₹${formatIndian(cgstAmount)}</td></tr><tr style="background:#f0f0ff"><td style="border:1px solid #000;padding:3px 6px;text-align:right">SGST @ ${sgstRate.toFixed(1)}%</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">₹${formatIndian(sgstAmount)}</td></tr>` : ''}${igstAmount > 0 ? `<tr style="background:#fff8f0"><td style="border:1px solid #000;padding:3px 6px;text-align:right">IGST @ ${igstRate.toFixed(1)}%</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">₹${formatIndian(igstAmount)}</td></tr>` : ''}${parseFloat(invoice.round_off) !== 0 ? `<tr><td style="border:1px solid #000;padding:3px 6px;text-align:right">Round Off</td><td style="border:1px solid #000;padding:3px 6px;text-align:right">${parseFloat(invoice.round_off) > 0 ? '+' : ''} ₹${formatIndian(invoice.round_off)}</td></tr>` : ''}<tr style="background:#e8e8e8"><td style="border:2px solid #000;padding:5px 6px;text-align:right;font-size:10.5pt"><b>GRAND TOTAL</b></td><td style="border:2px solid #000;padding:5px 6px;text-align:right;font-size:10.5pt;font-weight:800">₹${formatIndian(invoice.total_amount)}</td></tr></tbody></table></div>
    <div style="padding:5px 10px;font-size:8.5pt;border-top:2px solid #000;flex-shrink:0;display:flex;justify-content:space-between;background:#f8f8f8"><div><b>Total amount (in words):</b> INR ${numberToWords(invoice.total_amount)}</div><div style="font-size:7pt;color:#666">E & O.E</div></div>
    <div style="flex-shrink:0"><div style="font-size:7.5pt;font-weight:700;padding:3px 4px 0;color:#333">HSN/SAC Wise Tax Summary</div><table style="font-size:7pt"><thead><tr><th>HSN</th><th>Taxable</th>${hasCGST ? '<th colspan="2">Central Tax</th><th colspan="2">State Tax</th>' : '<th colspan="2">Integrated Tax</th>'}<th>Total Tax</th></tr></thead><tbody>${hsnRows}<tr style="font-weight:700;background:#f0f0f0"><td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt">TOTAL</td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">₹${formatIndian(invoice.subtotal)}</td>${hasCGST ? `<td style="border:1px solid #000;padding:1px 2px;font-size:7pt"></td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">₹${formatIndian(invoice.cgst_amount)}</td><td style="border:1px solid #000;padding:1px 2px;font-size:7pt"></td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">₹${formatIndian(invoice.sgst_amount)}</td>` : `<td style="border:1px solid #000;padding:1px 2px;font-size:7pt"></td><td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">₹${formatIndian(invoice.igst_amount)}</td>`}<td style="border:1px solid #000;padding:1px 2px;text-align:right;font-size:7pt">₹${formatIndian(totalTax)}</td></tr></tbody></table></div>
    <div style="display:flex;border-top:2px solid #000;margin-top:auto;flex-shrink:0"><div style="width:40%;padding:6px 10px;font-size:8pt;line-height:1.6;border-right:1px solid #000"><div style="font-weight:700;border-bottom:1px solid #ccc;padding-bottom:2px;margin-bottom:3px;font-size:7.5pt">Bank Details:</div>${org.bank_name ? `<div><b>Bank:</b> ${org.bank_name}</div>` : ''}${org.account_no ? `<div><b>A/C No:</b> ${org.account_no}</div>` : ''}${org.ifsc ? `<div><b>IFSC:</b> ${org.ifsc}</div>` : ''}${org.branch ? `<div><b>Branch:</b> ${org.branch}</div>` : ''}${org.upi_id ? `<div><b>UPI ID:</b> ${org.upi_id}</div>` : ''}</div><div style="width:18%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;border-right:1px solid #000">${qrUrl ? `<img src="${qrUrl}" style="width:72px;height:72px"><div style="font-size:5.5pt;color:#666;margin-top:2px">Scan to Pay</div>` : '<div style="font-size:7pt;color:#aaa">QR</div>'}</div><div style="width:42%;padding:6px 10px;font-size:8pt;display:flex;flex-direction:column;justify-content:flex-end;text-align:right"><div style="margin-bottom:4px">For <b>${(org.name || '').toUpperCase()}</b></div><div style="width:100px;height:80px;position:relative;display:inline-block;margin-bottom:4px">${org.stamp_url ? `<img src="${org.stamp_url}" style="position:absolute;width:100px;height:80px;object-fit:contain;opacity:0.85">` : ''}${org.signature_url ? `<img src="${org.signature_url}" style="position:relative;z-index:1;max-height:50px;max-width:90px;object-fit:contain">` : ''}</div><div style="border-top:1px solid #000;display:inline-block;padding-top:2px;font-weight:600;font-size:8pt">Authorized Signatory</div></div></div>
    ${invoice.notes ? `<div style="padding:4px 10px;font-size:7.5pt;border-top:1px solid #000;flex-shrink:0;color:#444"><b>Notes:</b> ${invoice.notes}</div>` : ''}
    <div style="padding:3px 10px;font-size:7pt;border-top:1px solid #ccc;flex-shrink:0;color:#777"><b>Terms:</b> 1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. on delayed payments. 3. Subject to Maharashtra jurisdiction.</div>
    <div style="text-align:center;font-size:6.5pt;color:#999;padding:3px 0;border-top:1px solid #ddd;flex-shrink:0">Computer Generated Invoice | ${(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()} | Page 1 of 1</div>
  </div></body></html>`;
}

module.exports = router;
