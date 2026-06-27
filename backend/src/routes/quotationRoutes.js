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

function generateQuotationHTML(quotation, items, org, customerName, additionalInfo) {
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
    return inW(Math.floor(num)) + ' Rupees Only';
  }

  const itemsHTML = items.map((item, i) => `
    <tr>
      <td style="border:1px solid #000;padding:3px;text-align:center;width:7%">${i+1}</td>
      <td style="border:1px solid #000;padding:3px;width:51%;font-size:9.5pt;line-height:1.35">${item.description || ''}</td>
      <td style="border:1px solid #000;padding:3px;text-align:center;width:10%">${item.quantity}</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;width:16%">${parseFloat(item.rate).toFixed(2)}</td>
      <td style="border:1px solid #000;padding:3px;text-align:right;width:16%">${parseFloat(item.amount).toFixed(2)}</td>
    </tr>
  `).join('');

  const qNum = quotation.quotation_number.split('/')[0];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 10pt; }
    .print-area { width: 210mm; height: 297mm; overflow: hidden; }
    .letterhead-space { height: ${letterheadMm}mm; }
    .content-area { max-height: ${297 - letterheadMm - footerMm}mm; overflow: hidden; padding: 0 14mm; }
    .footer-space { height: ${footerMm}mm; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; padding: 5px; background: #f0f0f0; text-align: center; font-size: 10pt; }
    .right { text-align: right; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
  </style></head><body>
    <div class="print-area">
      <div class="letterhead-space"></div>
      <div class="content-area">
        <h2 class="center" style="font-size:26pt;font-family:Georgia,serif;margin-bottom:4px">Quotation <u>No</u> :- ${qNum}</h2>
        <p class="center" style="font-size:13pt;font-weight:bold;text-transform:uppercase;margin-bottom:2px">${(customerName||'').toUpperCase()}</p>
        ${additionalInfo ? `<p class="center" style="font-size:10pt;margin-bottom:6px">${additionalInfo}</p>` : ''}
        <table>
          <thead><tr><th style="width:7%">SR.No</th><th style="width:51%">Particulars</th><th style="width:10%">Quantity</th><th style="width:16%">Rate INR</th><th style="width:16%">Amount INR</th></tr></thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <table style="margin-top:2px">
          ${parseFloat(quotation.igst_amount) > 0 ? `<tr><td style="text-align:right;padding:4px;width:83%"><strong>GST @ ${parseFloat(items[0]?.igst_rate||18)}%</strong></td><td style="text-align:right;padding:4px;font-weight:bold">${parseFloat(quotation.igst_amount).toFixed(2)}</td></tr>` : ''}
          <tr style="font-size:11pt"><td style="text-align:right;padding:5px;width:83%"><strong>Total :</strong></td><td style="text-align:right;padding:5px;font-weight:bold">${parseFloat(quotation.total_amount).toFixed(2)}</td></tr>
        </table>
        <p style="margin-top:6px;font-size:9pt"><strong>Amount in Words:</strong> ${numberToWords(quotation.total_amount)}</p>
      </div>
      <div class="footer-space"></div>
    </div>
  </body></html>`;
}

module.exports = router;
