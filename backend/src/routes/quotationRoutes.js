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
;

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
    
    // Also get customer name from customers table if linked
    let customerName = parts[0] || '';
    let customerStateCode = '';
    if (quotation.customer_id) {
      const customer = await db('customers').where({ id: quotation.customer_id }).first();
      if (customer) {
        customerName = customer.name || customerName;
        customerStateCode = customer.state_code || (customer.gstin ? customer.gstin.substring(0,2) : '');
      }
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
    const { items, customer_name, additional_info, actual_notes, ...qData } = req.body;
    const orgId = req.user.organization_id;

    const org = await db('organizations').where({ id: orgId }).first();
    const prefix = org.quotation_prefix || 'Q-';
    
    const last = await db('quotations').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY(new Date(qData.quotation_date));
    const quotationNumber = `${prefix}${String(nextNo).padStart(4, '0')}/${fy}`;

    // Store additional info in notes field
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
    
    // Get customer state code for proper GST split
    const customer = quotation.customer_id ? await db('customers').where({ id: quotation.customer_id }).first() : null;
    const custStateCode = customer?.state_code || (customer?.gstin ? customer.gstin.substring(0,2) : '');
    const orgStateCode = (await db('organizations').where({ id: orgId }).first())?.state_code || '27';
    const isIntra = custStateCode === orgStateCode;
    
    // Create invoice
    const org = await db('organizations').where({ id: orgId }).first();
    const last = await db('invoices').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY();
    const invoiceNumber = `${org.invoice_prefix || 'GST-'}${String(nextNo).padStart(4, '0')}/${fy}`;

    // Calculate proper CGST/SGST/IGST based on state
    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
    if (isIntra) {
      // Split IGST into CGST + SGST for intra-state
      const totalGst = parseFloat(quotation.igst_amount) || (parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount));
      cgstAmount = totalGst / 2;
      sgstAmount = totalGst / 2;
      igstAmount = 0;
    } else {
      cgstAmount = parseFloat(quotation.cgst_amount) || 0;
      sgstAmount = parseFloat(quotation.sgst_amount) || 0;
      igstAmount = parseFloat(quotation.igst_amount) || (parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount));
    }

    const invoiceData = {
      organization_id: orgId,
      invoice_number: invoiceNumber,
      customer_id: quotation.customer_id,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
      subtotal: quotation.subtotal,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_amount: quotation.total_amount,
      status: 'Pending',
      payment_status: 'Unpaid',
      notes: quotation.notes
    };

    const [invoice] = await db('invoices').insert(invoiceData).returning('id');
    const invoiceId = invoice.id || invoice;

    // Convert items with proper CGST/SGST/IGST rates
    if (qItems.length > 0) {
      const invItems = qItems.map(item => {
        const itemGstRate = parseFloat(item.igst_rate) || 18;
        return {
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
        };
      });
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
    
    // Get customer name from customers table
    let customerName = parts[0] || '';
    if (quotation.customer_id) {
      const customer = await db('customers').where({ id: quotation.customer_id }).first();
      if (customer) customerName = customer.name || customerName;
    }

    const html = generateQuotationHTML(quotation, items, org, customerName, parts[1]||'');

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
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const n = parseFloat(num);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
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
    const rupees = Math.round(Math.floor(num));
    const paise = Math.round((num - Math.floor(num)) * 100);
    let result = inW(rupees) + ' Rupees';
    if (paise > 0) result += ' and ' + inW(paise) + ' Paise';
    return result + ' Only';
  }
  function numberToWordsCaps(num) {
    return numberToWords(num).toUpperCase().replace('RUPEES ', '').replace(' RUPEES', '');
  }

  const qNum = (quotation.quotation_number || '').split('/')[0];
  const hasCGST = parseFloat(quotation.cgst_amount) > 0;
  const hasIGST = parseFloat(quotation.igst_amount) > 0;
  const gstRate = hasIGST ? parseFloat(items[0]?.igst_rate || 18) : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 18);
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount);

  const itemsHTML = items.map((item, i) => `
    <tr>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:center;vertical-align:top;width:6%">${i+1}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;width:50%;font-size:8.5pt;line-height:1.3;white-space:pre-line">${item.description || ''}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:center;vertical-align:top;width:10%">${item.quantity}${item.unit && item.unit !== 'Unit' ? ' ' + item.unit : ''}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:right;vertical-align:top;width:17%">₹${formatIndian(item.rate)}</td>
      <td style="border:1.5px solid #000;padding:4px 5px;text-align:right;font-weight:bold;vertical-align:top;width:17%">₹${formatIndian(item.amount)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, serif; font-size: 10pt; }
    .page { width: 210mm; height: 297mm; display: flex; flex-direction: column; overflow: hidden; }
    .letterhead { height: ${letterheadMm}mm; flex-shrink: 0; }
    .content { flex: 1; display: flex; flex-direction: column; border: 2px solid #000; margin: 0 10mm; }
    .sign-space { height: 30mm; flex-shrink: 0; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1.5px solid #000; padding: 5px; background: #e8e8e8; text-align: center; font-weight: bold; }
  </style></head><body>
    <div class="page">
      <div class="letterhead"></div>
      <div class="content">
        <div style="text-align:center;padding:8px 0 2px;font-size:20pt;font-weight:bold">Quotation <u>No</u> :- ${qNum}</div>
        <div style="text-align:center;font-size:12pt;font-weight:bold;text-transform:uppercase;padding:2px 8px">${(customerName||'').toUpperCase()}</div>
        ${additionalInfo ? `<div style="text-align:center;font-size:9pt;padding:0 8px 2px">${additionalInfo}</div>` : ''}
        <div style="flex:1;padding:4px 5px 0;overflow:hidden">
          <table style="font-size:9pt">
            <thead><tr><th style="width:6%">SR No.</th><th style="width:50%">Particulars</th><th style="width:10%">Quantity</th><th style="width:17%">Rate (INR)</th><th style="width:17%">Amount (INR)</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
          </table>
        </div>
        <div style="padding:0 5px 6px;flex-shrink:0">
          <table style="font-size:9pt">
            ${gstRate > 0 ? `<tr><td style="border-left:1.5px solid #000;border-bottom:1.5px solid #000;border-top:1.5px solid #000;border-right:1.5px solid #000;padding:4px 6px;text-align:right;width:76%">GST: ${gstRate}%</td><td style="border:1.5px solid #000;padding:4px 6px;text-align:right;font-weight:bold">₹${formatIndian(totalGST)}</td></tr>` : ''}
            <tr style="background:#f0f0f0"><td style="border-left:1.5px solid #000;border-bottom:1.5px solid #000;border-top:1.5px solid #000;border-right:1.5px solid #000;padding:5px 6px;text-align:right;font-size:11pt;width:76%"><strong>Total :</strong></td><td style="border:1.5px solid #000;padding:5px 6px;text-align:right;font-size:11pt;font-weight:bold">₹${formatIndian(quotation.total_amount)}</td></tr>
          </table>
          <div style="border:1.5px solid #000;border-top:none;padding:6px 8px;font-size:10pt;font-weight:bold;text-align:center;background:#fafafa">${numberToWordsCaps(quotation.total_amount)}</div>
        </div>
      </div>
      <div class="sign-space"></div>
    </div>
  </body></html>`;
}

module.exports = router;
