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

// Columns that exist in quotations table
const QUOTATION_COLUMNS = [
  'organization_id', 'quotation_number', 'customer_id',
  'quotation_date', 'validity_date',
  'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount',
  'status', 'converted_invoice_id', 'notes'
];

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

    // Get quotation number
    const org = await db('organizations').where({ id: orgId }).first();
    const prefix = org.quotation_prefix || 'Q-';
    const last = await db('quotations').where({ organization_id: orgId }).orderBy('id', 'desc').first('id');
    const nextNo = (last?.id || 0) + 1;
    const fy = getFY(new Date(body.quotation_date || Date.now()));
    const quotationNumber = `${prefix}${nextNo}/${fy}`;

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

module.exports = router;
