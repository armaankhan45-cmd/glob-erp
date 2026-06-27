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

// List quotations
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const quotations = await db('quotations')
      .where({ organization_id: req.user.organization_id })
      .orderBy('created_at', 'desc');
    
    // Parse customer name from notes
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
    
    res.json({ 
      success: true, 
      quotation: { 
        ...quotation, 
        customer_name: parts[0] || '', 
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
    const { items, customer_name, additional_info, actual_notes, ...qData } = req.body;
    const orgId = req.user.organization_id;

    const org = await db('organizations').where({ id: orgId }).first();
    const settings = await db('settings').where({ organization_id: orgId, key: 'quotation_prefix' }).first();
    const prefix = settings?.value || org.quotation_prefix || 'Q-';
    
    const last = await db('quotations').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY(new Date(qData.quotation_date));
    const quotationNumber = `${prefix}${String(nextNo).padStart(4, '0')}/${fy}`;

    // Store customer in notes field
    const notes = `${customer_name || ''}|||${additional_info || ''}|||${actual_notes || ''}`;

    const data = {
      ...qData,
      organization_id: orgId,
      quotation_number: quotationNumber,
      notes
    };

    const [quotation] = await db('quotations').insert(data).returning('id');
    const qId = quotation.id || quotation;

    if (items && items.length > 0) {
      const itemRows = items.map(item => ({ ...item, quotation_id: qId }));
      await db('quotation_items').insert(itemRows);
    }

    await auditLog(req.user.id, orgId, 'CREATE', 'quotations', qId, null, data, req.ip);

    res.status(201).json({ success: true, quotation: { id: qId, quotation_number: quotationNumber } });
  } catch (err) {
    console.error('Create quotation error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

// Update quotation
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const { items, customer_name, additional_info, actual_notes, ...qData } = req.body;
    const orgId = req.user.organization_id;

    const old = await db('quotations').where({ id: req.params.id, organization_id: orgId }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Not found' });

    const notes = `${customer_name || ''}|||${additional_info || ''}|||${actual_notes || ''}`;
    await db('quotations').where({ id: req.params.id }).update({ ...qData, notes });

    await db('quotation_items').where({ quotation_id: req.params.id }).del();
    if (items && items.length > 0) {
      const itemRows = items.map(item => ({ ...item, quotation_id: req.params.id }));
      await db('quotation_items').insert(itemRows);
    }

    await auditLog(req.user.id, orgId, 'UPDATE', 'quotations', req.params.id, old, qData, req.ip);

    res.json({ success: true, msg: 'Quotation updated' });
  } catch (err) {
    console.error('Update quotation error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
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
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'quotations', req.params.id, quotation, null, req.ip);

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
    
    // Create invoice
    const org = await db('organizations').where({ id: orgId }).first();
    const last = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY();
    const invoiceNumber = `${org.invoice_prefix || 'GST-'}${String(nextNo).padStart(4, '0')}/${fy}`;

    const invoiceData = {
      organization_id: orgId,
      invoice_number: invoiceNumber,
      customer_id: quotation.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
      subtotal: quotation.subtotal,
      cgst_amount: quotation.cgst_amount,
      sgst_amount: quotation.sgst_amount,
      igst_amount: quotation.igst_amount,
      total_amount: quotation.total_amount,
      status: 'Pending',
      payment_status: 'Unpaid',
      notes: quotation.notes
    };

    const [invoice] = await db('invoices').insert(invoiceData).returning('id');
    const invoiceId = invoice.id || invoice;

    // Convert items
    if (qItems.length > 0) {
      const invItems = qItems.map(item => ({
        invoice_id: invoiceId,
        description: item.description,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        cgst_rate: 0,
        sgst_rate: 0,
        igst_rate: item.igst_rate,
        amount: item.amount
      }));
      await db('invoice_items').insert(invItems);
    }

    // Mark quotation as converted
    await db('quotations').where({ id: req.params.id }).update({
      status: 'Converted',
      converted_invoice_id: invoiceId
    });

    await auditLog(req.user.id, orgId, 'CONVERT', 'quotations', req.params.id, quotation, { invoiceId }, req.ip);

    res.json({ success: true, invoiceId, invoice_number: invoiceNumber });
  } catch (err) {
    console.error('Convert quotation error:', err);
    res.status(500).json({ success: false, msg: 'Conversion failed: ' + err.message });
  }
});

// Quotation PDF
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const db = getDb();
    const quotation = await db('quotations').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!quotation) return res.status(404).json({ success: false, msg: 'Not found' });
    
    const items = await db('quotation_items').where({ quotation_id: quotation.id });
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const parts = (quotation.notes || '').split('|||');

    const html = generateQuotationHTML(quotation, items, org, parts[0]||'', parts[1]||'');

    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 }, printBackground: true });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${quotation.quotation_number}.pdf"`);
      res.send(pdf);
    } catch (puppeteerErr) {
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }
  } catch (err) {
    console.error('Quotation PDF error:', err);
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

function generateQuotationHTML(quotation, items, org, customerName, additionalInfo) {
  const letterheadMm = org.print_letterhead_mm || 65;

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
    return inW(Math.floor(num)) + ' Rupees Only';
  }
  function numberToWordsCaps(num) {
    return numberToWords(num).toUpperCase().replace('RUPEES ', '').replace(' RUPEES', '');
  }

  const qNum = (quotation.quotation_number || '').split('/')[0];
  const hasCGST = parseFloat(quotation.cgst_amount) > 0;
  const hasIGST = parseFloat(quotation.igst_amount) > 0;
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 0);
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount);

  const itemsHTML = items.map((item, i) => `
    <tr>
      <td style="border:1.5px solid #000;padding:3px 4px;text-align:center;vertical-align:top;width:7%">${i+1}</td>
      <td style="border:1.5px solid #000;padding:3px 4px;width:47%;font-size:9pt;line-height:1.35;white-space:pre-line">${item.description || ''}</td>
      <td style="border:1.5px solid #000;padding:3px 4px;text-align:center;vertical-align:top;width:12%">${item.quantity}${item.unit && item.unit !== 'Unit' ? ' ' + item.unit : ''}</td>
      <td style="border:1.5px solid #000;padding:3px 4px;text-align:right;vertical-align:top;width:17%">${formatIndian(item.rate)}</td>
      <td style="border:1.5px solid #000;padding:3px 4px;text-align:right;font-weight:bold;vertical-align:top;width:17%">${formatIndian(item.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 10pt; }
    .letterhead-space { height: ${letterheadMm}mm; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1.5px solid #000; padding: 5px 4px; background: #e8e8e8; text-align: center; }
  </style></head><body>
    <div class="letterhead-space"></div>
    <div style="padding:0 12mm 6mm">
      <h2 style="text-align:center;font-size:22pt;font-family:Georgia,serif;margin-bottom:2px">Quotation <u>No</u> :- ${qNum}</h2>
      <p style="text-align:center;font-size:12pt;font-weight:bold;text-transform:uppercase;margin-bottom:2px">${(customerName||'').toUpperCase()}</p>
      ${additionalInfo ? `<p style="text-align:center;font-size:10pt;margin-bottom:2px">${additionalInfo}</p>` : ''}
      <p style="text-align:center;font-size:9pt;margin-bottom:8px;color:#555">Date: ${quotation.quotation_date}${quotation.validity_date ? ' | Valid till: ' + quotation.validity_date : ''}</p>
      <table style="font-size:9.5pt">
        <thead><tr><th style="width:7%">SR No.</th><th style="width:47%">Particulars</th><th style="width:12%">Quantity</th><th style="width:17%">Rate (INR)</th><th style="width:17%">Amount (INR)</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <table style="font-size:9.5pt;margin-top:0">
        ${gstRate > 0 ? `<tr><td style="border-left:1.5px solid #000;border-bottom:1.5px solid #000;padding:4px 6px;text-align:right;width:78%">GST: ${gstRate}%</td><td style="border:1.5px solid #000;padding:4px 6px;text-align:right;font-weight:bold">${formatIndian(totalGST)}</td></tr>` : ''}
        <tr style="background:#f0f0f0"><td style="border-left:1.5px solid #000;border-bottom:1.5px solid #000;padding:5px 6px;text-align:right;font-size:11pt;width:78%"><strong>Total :</strong></td><td style="border:1.5px solid #000;padding:5px 6px;text-align:right;font-size:11pt;font-weight:bold">₹${formatIndian(quotation.total_amount)}</td></tr>
      </table>
      <p style="margin-top:8px;font-size:10pt;font-weight:bold">${numberToWordsCaps(quotation.total_amount)}</p>
      <div style="margin-top:8px;font-size:8.5pt;color:#444;border-top:1px solid #ddd;padding-top:4px"><strong>GSTIN:</strong> ${org.gstin || ''} | <strong>State:</strong> ${org.state || ''} (${org.state_code || ''})</div>
      ${org.bank_name ? `<div style="margin-top:3px;font-size:8.5pt;color:#444"><strong>Bank:</strong> ${org.bank_name} | <strong>A/C:</strong> ${org.account_no || ''} | <strong>IFSC:</strong> ${org.ifsc || ''}</div>` : ''}
    </div>
  </body></html>`;
}

module.exports = router;
