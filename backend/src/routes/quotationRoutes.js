const express = require('express');
const router = express.Router();

// Lazy-load dependencies to prevent require() crashes
function getDb() { return require('../config/db')(); }
function auth(req, res, next) { return require('../middleware/auth').auth(req, res, next); }

function getFY(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  if (m < 3) return `${(y - 1) % 100}-${y % 100}`;
  return `${y % 100}-${(y + 1) % 100}`;
}

// Sanitize empty date strings to null
function sanitizeDates(data) {
  const dateFields = ['quotation_date', 'validity_date'];
  const clean = { ...data };
  dateFields.forEach(f => {
    if (clean[f] === '' || clean[f] === undefined) clean[f] = null;
  });
  return clean;
}

// Columns that exist in quotations table — quotation_number included for manual override
const QUOTATION_COLUMNS = [
  'organization_id', 'quotation_number', 'customer_id',
  'quotation_date', 'validity_date',
  'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount',
  'status', 'converted_invoice_id', 'notes'
];

// Columns that are NOT in the table (must be stripped before SQL insert)
const VIRTUAL_COLUMNS = ['customer_name', 'additional_info', 'actual_notes', 'quotation_number_override'];

// Columns that exist in quotation_items table
const ITEM_COLUMNS = [
  'quotation_id', 'description', 'hsn_code',
  'quantity', 'unit', 'rate', 'igst_rate', 'amount'
];

// Strip out any keys that don't belong in the table
function cleanForTable(data, allowedColumns) {
  const clean = {};
  for (const key of Object.keys(data)) {
    if (allowedColumns.includes(key)) {
      clean[key] = data[key];
    }
  }
  return clean;
}

// List quotations
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const quotations = await db('quotations')
      .where({ organization_id: req.user.organization_id })
      .orderBy('created_at', 'desc');
    
    const parsed = quotations.map(q => {
      const parts = (q.notes || '').split('|||');
      return { ...q, customer_name: parts[0] || '', additional_info: parts[1] || '', actual_notes: parts[2] || '' };
    });
    
    res.json({ success: true, quotations: parsed });
  } catch (err) {
    console.error('List quotations error:', err);
    res.status(500).json({ success: false, msg: 'Failed', quotations: [] });
  }
});

// Get single quotation
router.get('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const quotation = await db('quotations')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .first();
    
    if (!quotation) return res.status(404).json({ success: false, msg: 'Quotation not found' });
    
    const items = await db('quotation_items').where({ quotation_id: quotation.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const parts = (quotation.notes || '').split('|||');
    
    let customerName = parts[0] || '';
    let customerStateCode = '';
    if (quotation.customer_id) {
      try {
        const customer = await db('customers').where({ id: quotation.customer_id }).first();
        if (customer) {
          customerName = customer.name || customerName;
          customerStateCode = customer.state_code || (customer.gstin ? customer.gstin.substring(0,2) : '');
        }
      } catch(e) {}
    }
    
    res.json({ 
      success: true, 
      quotation: { 
        ...quotation, 
        customer_name: customerName,
        customer_state_code: customerStateCode,
        additional_info: parts[1] || '', 
        actual_notes: parts[2] || '' 
      }, 
      items, 
      organization: org 
    });
  } catch (err) {
    console.error('Get quotation error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Create quotation
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const body = req.body || {};

    // Extract custom fields (stored in notes, not in table)
    const customer_name = body.customer_name || '';
    const additional_info = body.additional_info || '';
    const actual_notes = body.actual_notes || '';
    const items = body.items || [];

    // Build notes field from custom fields
    const notes = `${customer_name}|||${additional_info}|||${actual_notes}`;

    // Get quotation number — manual override or auto-generate
    const org = await db('organizations').where({ id: orgId }).first();
    const prefix = org.quotation_prefix || 'Q-';
    const fy = getFY(new Date(body.quotation_date || Date.now()));
    
    let quotationNumber;
    if (body.quotation_number && String(body.quotation_number).trim() !== '') {
      // User provided a manual number — use it directly with prefix + FY
      const manualNum = String(body.quotation_number).trim().replace(/[^0-9]/g, '');
      quotationNumber = `${prefix}${manualNum}/${fy}`;
    } else {
      // Auto-generate from last ID
      const last = await db('quotations').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
      const nextNo = (last?.id || 0) + 1;
      quotationNumber = `${prefix}${nextNo}/${fy}`;
    }

    // Build ONLY valid columns for quotations table
    const insertData = sanitizeDates(cleanForTable({
      organization_id: orgId,
      quotation_number: quotationNumber,
      customer_id: body.customer_id || null,
      quotation_date: body.quotation_date || null,
      validity_date: body.validity_date || null,
      subtotal: parseFloat(body.subtotal) || 0,
      cgst_amount: parseFloat(body.cgst_amount) || 0,
      sgst_amount: parseFloat(body.sgst_amount) || 0,
      igst_amount: parseFloat(body.igst_amount) || 0,
      total_amount: parseFloat(body.total_amount) || 0,
      status: body.status || 'Sent',
      notes
    }, QUOTATION_COLUMNS));

    console.log('Creating quotation with data:', JSON.stringify(Object.keys(insertData)));

    const [quotation] = await db('quotations').insert(insertData).returning('id');
    const qId = quotation.id || quotation;

    // Insert items — only valid columns
    if (items.length > 0) {
      const itemRows = items.map(item => cleanForTable({
        quotation_id: qId,
        description: item.description || '',
        hsn_code: item.hsn_code || '',
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'Unit',
        rate: parseFloat(item.rate) || 0,
        igst_rate: parseFloat(item.igst_rate) || 18,
        amount: parseFloat(item.amount) || 0
      }, ITEM_COLUMNS));
      await db('quotation_items').insert(itemRows);
    }

    // Audit log — wrap in try/catch so it never crashes
    try {
      const auditLog = require('../middleware/auditLog');
      await auditLog(req.user.id, orgId, 'CREATE', 'quotations', qId, null, insertData, req.ip);
    } catch(e) { console.error('Audit log error:', e.message); }

    res.status(201).json({ success: true, quotation: { id: qId, quotation_number: quotationNumber } });
  } catch (err) {
    console.error('Create quotation error:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

// Update quotation
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const body = req.body || {};

    const old = await db('quotations').where({ id: req.params.id, organization_id: orgId }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Not found' });

    const customer_name = body.customer_name || '';
    const additional_info = body.additional_info || '';
    const actual_notes = body.actual_notes || '';
    const items = body.items || [];
    const notes = `${customer_name}|||${additional_info}|||${actual_notes}`;

    const updateData = sanitizeDates(cleanForTable({
      customer_id: body.customer_id || null,
      quotation_date: body.quotation_date || null,
      validity_date: body.validity_date || null,
      subtotal: parseFloat(body.subtotal) || 0,
      cgst_amount: parseFloat(body.cgst_amount) || 0,
      sgst_amount: parseFloat(body.sgst_amount) || 0,
      igst_amount: parseFloat(body.igst_amount) || 0,
      total_amount: parseFloat(body.total_amount) || 0,
      status: body.status || 'Sent',
      notes
    }, QUOTATION_COLUMNS));

    await db('quotations').where({ id: req.params.id }).update(updateData);

    await db('quotation_items').where({ quotation_id: req.params.id }).del();
    if (items.length > 0) {
      const itemRows = items.map(item => cleanForTable({
        quotation_id: req.params.id,
        description: item.description || '',
        hsn_code: item.hsn_code || '',
        quantity: parseFloat(item.quantity) || 0,
        unit: item.unit || 'Unit',
        rate: parseFloat(item.rate) || 0,
        igst_rate: parseFloat(item.igst_rate) || 18,
        amount: parseFloat(item.amount) || 0
      }, ITEM_COLUMNS));
      await db('quotation_items').insert(itemRows);
    }

    try {
      const auditLog = require('../middleware/auditLog');
      await auditLog(req.user.id, orgId, 'UPDATE', 'quotations', req.params.id, old, updateData, req.ip);
    } catch(e) { console.error('Audit log error:', e.message); }

    res.json({ success: true, msg: 'Quotation updated' });
  } catch (err) {
    console.error('Update quotation error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

// Delete quotation
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const quotation = await db('quotations').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!quotation) return res.status(404).json({ success: false, msg: 'Not found' });

    await db('quotation_items').where({ quotation_id: req.params.id }).del();
    await db('quotations').where({ id: req.params.id }).del();

    try {
      const auditLog = require('../middleware/auditLog');
      await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'quotations', req.params.id, quotation, null, req.ip);
    } catch(e) { console.error('Audit log error:', e.message); }

    res.json({ success: true, msg: 'Quotation deleted' });
  } catch (err) {
    console.error('Delete quotation error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Convert quotation to invoice
router.post('/:id/convert', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    
    const quotation = await db('quotations').where({ id: req.params.id, organization_id: orgId }).first();
    if (!quotation) return res.status(404).json({ success: false, msg: 'Quotation not found' });
    
    const qItems = await db('quotation_items').where({ quotation_id: quotation.id });
    
    // Get customer state code for proper GST split
    let custStateCode = '';
    let customer = null;
    if (quotation.customer_id) {
      try {
        customer = await db('customers').where({ id: quotation.customer_id }).first();
        custStateCode = customer?.state_code || (customer?.gstin ? customer.gstin.substring(0,2) : '');
      } catch(e) {}
    }
    const orgStateCode = (await db('organizations').where({ id: orgId }).first())?.state_code || '27';
    const isIntra = custStateCode === orgStateCode;
    
    const org = await db('organizations').where({ id: orgId }).first();
    const last = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY();
    const invoiceNumber = `${org.invoice_prefix || 'GST-'}${String(nextNo).padStart(4, '0')}/${fy}`;

    // Calculate proper CGST/SGST/IGST based on state
    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
    if (isIntra) {
      const totalGst = parseFloat(quotation.igst_amount) || (parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount));
      cgstAmount = totalGst / 2;
      sgstAmount = totalGst / 2;
    } else {
      igstAmount = parseFloat(quotation.igst_amount) || (parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount));
    }

    // Only insert valid invoice columns
    const INVOICE_COLUMNS = [
      'organization_id', 'invoice_number', 'customer_id', 'invoice_date',
      'due_date', 'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount',
      'discount', 'round_off', 'total_amount', 'status', 'payment_status', 'notes'
    ];
    const INVOICE_ITEM_COLUMNS = [
      'invoice_id', 'description', 'hsn_code', 'quantity', 'unit', 'rate',
      'cgst_rate', 'sgst_rate', 'igst_rate', 'amount'
    ];

    const invoiceData = cleanForTable({
      organization_id: orgId,
      invoice_number: invoiceNumber,
      customer_id: quotation.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: null,
      subtotal: quotation.subtotal,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_amount: quotation.total_amount,
      status: 'Pending',
      payment_status: 'Unpaid',
      notes: quotation.notes
    }, INVOICE_COLUMNS);

    const [invoice] = await db('invoices').insert(invoiceData).returning('id');
    const invoiceId = invoice.id || invoice;

    if (qItems.length > 0) {
      const invItems = qItems.map(item => {
        const itemGstRate = parseFloat(item.igst_rate) || 18;
        return cleanForTable({
          invoice_id: invoiceId,
          description: item.description,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          cgst_rate: isIntra ? itemGstRate / 2 : 0,
          sgst_rate: isIntra ? itemGstRate / 2 : 0,
          igst_rate: isIntra ? 0 : itemGstRate,
          amount: item.amount
        }, INVOICE_ITEM_COLUMNS);
      });
      await db('invoice_items').insert(invItems);
    }

    await db('quotations').where({ id: req.params.id }).update({
      status: 'Converted',
      converted_invoice_id: invoiceId
    });

    try {
      const auditLog = require('../middleware/auditLog');
      await auditLog(req.user.id, orgId, 'CONVERT', 'quotations', req.params.id, quotation, { invoiceId }, req.ip);
    } catch(e) { console.error('Audit log error:', e.message); }

    res.json({ success: true, invoiceId, invoice_number: invoiceNumber });
  } catch (err) {
    console.error('Convert quotation error:', err);
    res.status(500).json({ success: false, msg: 'Conversion failed: ' + err.message });
  }
});

// Auth middleware that also accepts ?token= in query string (for PDF new-tab access)
function pdfAuth(req, res, next) {
  const jwt = require('jsonwebtoken');
  const config = require('../config/env');
  let token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) token = req.query.token;
  if (!token) return res.status(401).json({ success: false, msg: 'Login required' });
  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ success: false, msg: 'Invalid token' }); }
}

// Quotation PDF / HTML — printable view for sharing
router.get('/:id/pdf', pdfAuth, async (req, res) => {
  try {
    const db = getDb();
    const quotation = await db('quotations')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .first();
    if (!quotation) return res.status(404).json({ success: false, msg: 'Not found' });

    const items = await db('quotation_items').where({ quotation_id: quotation.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const parts = (quotation.notes || '').split('|||');
    const customerName = parts[0] || '';
    const additionalInfo = parts[1] || '';

    const html = generateQuotationHTML(quotation, items, org, customerName, additionalInfo);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Quotation PDF error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

// Email sharing endpoint — sends quotation PDF as attachment
router.post('/:id/share-email', pdfAuth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, msg: 'Email address required' });
    
    const db = getDb();
    const quotation = await db('quotations')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .first();
    if (!quotation) return res.status(404).json({ success: false, msg: 'Not found' });

    const items = await db('quotation_items').where({ quotation_id: quotation.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const parts = (quotation.notes || '').split('|||');
    const customerName = parts[0] || '';
    const additionalInfo = parts[1] || '';
    const rawNum = (quotation.quotation_number || '').split('/')[0];
    const qNum = rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '') || rawNum;

    // Try sending via nodemailer — use org SMTP settings first, then env vars
    const html = generateQuotationHTML(quotation, items, org, customerName, additionalInfo);
    const total = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(quotation.total_amount);
      // Use org SMTP settings first, fallback to env vars
      const smtpHost = org.smtp_host || process.env.SMTP_HOST;
      const smtpPort = parseInt(org.smtp_port || process.env.SMTP_PORT || '587');
      const smtpUser = org.smtp_user || process.env.SMTP_USER;
      const smtpPass = org.smtp_pass || process.env.SMTP_PASS;
      if (!smtpHost || !smtpUser || !smtpPass) throw new Error('SMTP not configured. Go to Settings to configure Gmail SMTP.');
      
      const secure = smtpPort === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      });

      await transporter.sendMail({
        from: `"${org.name || 'Glob ERP'}" <${smtpUser}>`,
        to,
        subject: `Quotation ${qNum} - ${org.name || 'Our Company'}`,
        html: `<p>Dear ${customerName},</p><p>Please find our quotation attached:</p><p>Quotation No: ${qNum}<br>Total Amount: ₹${total}</p><p>Thank you for your interest.</p><p>Best regards,<br>${org.name || 'Our Company'}</p>`,
        attachments: [{
          filename: `Quotation_${qNum.replace(/\//g, '-')}.html`,
          content: html,
          contentType: 'text/html'
        }]
      });

      return res.json({ success: true, msg: 'Quotation sent via email!' });
    } catch (smtpErr) {
      // SMTP not configured — return the PDF URL so frontend can fallback to mailto
      return res.json({ success: false, msg: smtpErr.message || 'SMTP not configured. Use mailto fallback.', pdfUrl: `${process.env.CORS_ORIGIN || ''}/api/quotations/${req.params.id}/pdf` });
    }
  } catch (err) {
    console.error('Share email error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

function generateQuotationHTML(quotation, items, org, customerName, additionalInfo) {
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
  function numberToWordsCaps(num) {
    return numberToWords(num).toUpperCase().replace('RUPEES ', '').replace(' RUPEES', '');
  }
  function formatIndian(num) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
  }

  const rawNum = (quotation.quotation_number || '').split('/')[0];
  const qNum = rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '') || rawNum;
  const hasCGST = parseFloat(quotation.cgst_amount) > 0;
  const hasIGST = parseFloat(quotation.igst_amount) > 0;
  const gstRate = hasIGST ? parseFloat(items[0]?.igst_rate || 18) : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 18);
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount);
  const letterheadMm = org.print_letterhead_mm || 65;

  const itemsHTML = items.map((item, i) => `
    <tr>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:center;vertical-align:top;width:6%">${i+1}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;width:50%;font-size:8.5pt;line-height:1.3;white-space:pre-line">${item.description || ''}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:center;vertical-align:top;width:10%">${item.quantity}${item.unit && item.unit !== 'Unit' ? ' ' + item.unit : ''}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:right;vertical-align:top;width:17%">&#8377;${formatIndian(item.rate)}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:right;font-weight:bold;vertical-align:top;width:17%">&#8377;${formatIndian(item.amount)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 10pt; }
    .page { width: 210mm; height: 297mm; display: flex; flex-direction: column; overflow: hidden; }
    .letterhead { height: ${letterheadMm}mm; flex-shrink: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1.5px solid #000; padding: 5px; background: #e8e8e8; text-align: center; font-weight: bold; }
    .sign-space { height: 30mm; flex-shrink: 0; }
  </style></head><body>
    <div class="page">
      <div class="letterhead"></div>
      <div style="margin:0 10mm;text-align:center;padding:6px 0 4px;font-size:16pt;font-weight:bold">
        Quotation <u>No</u> :- ${qNum}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;border:2px solid #000;margin:0 10mm;overflow:hidden">
        <div style="padding:6px 8px 4px;text-align:left;border-bottom:1px solid #000">
          <div style="font-size:14pt;font-weight:bold;text-transform:uppercase;line-height:1.2">${(customerName || '').toUpperCase()}</div>
          ${additionalInfo ? `<div style="font-size:9pt;margin-top:2px;color:#444">${additionalInfo}</div>` : ''}
        </div>
        <div style="flex:1;padding:4px 5px 0;overflow:hidden">
          <table style="font-size:9pt;height:100%">
            <thead><tr><th style="width:6%">SR No.</th><th style="width:50%">Particulars</th><th style="width:10%">Quantity</th><th style="width:17%">Rate (INR)</th><th style="width:17%">Amount (INR)</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
          </table>
        </div>
        <div style="padding:0 5px 6px;flex-shrink:0">
          <table style="font-size:9pt">
            ${gstRate > 0 ? `<tr><td style="border:1.5px solid #000;padding:4px 6px;text-align:right;width:55%">GST: ${gstRate}%</td><td style="border:1.5px solid #000;padding:4px 6px;text-align:right;font-weight:bold;width:45%">&#8377;${formatIndian(totalGST)}</td></tr>` : ''}
            <tr style="background:#f0f0f0">
              <td colspan="2" style="border:1.5px solid #000;padding:6px 8px;font-size:10pt;font-weight:bold">
                Total : ${numberToWordsCaps(quotation.total_amount)}
              </td>
            </tr>
            <tr style="background:#f5f5f5">
              <td style="border:1.5px solid #000;padding:5px 8px;text-align:right;font-size:12pt;font-weight:bold">&#8377;${formatIndian(quotation.total_amount)}</td>
              <td style="border:1.5px solid #000;padding:5px 8px;text-align:center;font-size:9pt;font-weight:bold">Total Amount</td>
            </tr>
          </table>
        </div>
      </div>
      <div class="sign-space"></div>
    </div>
  </body></html>`;
}

module.exports = router;
