const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/suggest', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const q = (req.query.q || '').trim();
    if (!q || q.length < 1) { return res.json({ success: true, items: [] }); }
    const likeQ = `%${q}%`;
    let purchaseItems = [];
    try { purchaseItems = await db('purchase_bill_items').join('purchase_bills', 'purchase_bill_items.purchase_id', 'purchase_bills.id').where('purchase_bills.organization_id', orgId).where('purchase_bill_items.description', 'ilike', likeQ).select('purchase_bill_items.description', 'purchase_bill_items.hsn_code', 'purchase_bill_items.unit', 'purchase_bill_items.rate', 'purchase_bill_items.cgst_rate', 'purchase_bill_items.sgst_rate', 'purchase_bill_items.igst_rate'); } catch (e) {}
    let invoiceItems = [];
    try { invoiceItems = await db('invoice_items').join('invoices', 'invoice_items.invoice_id', 'invoices.id').where('invoices.organization_id', orgId).where('invoice_items.description', 'ilike', likeQ).select('invoice_items.description', 'invoice_items.hsn_code', 'invoice_items.unit', 'invoice_items.rate', 'invoice_items.cgst_rate', 'invoice_items.sgst_rate', 'invoice_items.igst_rate'); } catch (e) {}
    let quotationItems = [];
    try { quotationItems = await db('quotation_items').join('quotations', 'quotation_items.quotation_id', 'quotations.id').where('quotations.organization_id', orgId).where('quotation_items.description', 'ilike', likeQ).select('quotation_items.description', 'quotation_items.hsn_code', 'quotation_items.unit', 'quotation_items.rate', 'quotation_items.cgst_rate as cgst_rate', 'quotation_items.sgst_rate as sgst_rate', 'quotation_items.igst_rate as igst_rate'); } catch (e) {}
    const allItems = [...purchaseItems, ...invoiceItems, ...quotationItems];
    const freqMap = new Map();
    for (const item of allItems) {
      if (!item.description || !item.description.trim()) continue;
      const descNorm = item.description.trim().toUpperCase();
      const key = descNorm + '|' + (item.hsn_code || '');
      if (freqMap.has(key)) { freqMap.get(key).count += 1; } else { freqMap.set(key, { description: item.description.trim(), hsn_code: item.hsn_code || '', unit: item.unit || 'NOS', rate: parseFloat(item.rate) || 0, cgst_rate: parseFloat(item.cgst_rate) || 0, sgst_rate: parseFloat(item.sgst_rate) || 0, igst_rate: parseFloat(item.igst_rate) || 0, count: 1 }); }
    }
    const results = Array.from(freqMap.values()).sort((a, b) => b.count - a.count || a.description.localeCompare(b.description)).slice(0, 20);
    res.json({ success: true, items: results });
  } catch (err) { console.error('Item suggest error:', err); res.status(500).json({ success: false, msg: 'Failed', items: [] }); }
});

router.get('/recent', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    let purchaseItems = [];
    try { purchaseItems = await db('purchase_bill_items').join('purchase_bills', 'purchase_bill_items.purchase_id', 'purchase_bills.id').where('purchase_bills.organization_id', orgId).whereNotNull('purchase_bill_items.description').where('purchase_bill_items.description', '!=', '').orderBy('purchase_bills.created_at', 'desc').limit(50).select('purchase_bill_items.description', 'purchase_bill_items.hsn_code', 'purchase_bill_items.unit', 'purchase_bill_items.rate', 'purchase_bill_items.cgst_rate', 'purchase_bill_items.sgst_rate', 'purchase_bill_items.igst_rate'); } catch (e) {}
    const seen = new Set();
    const results = [];
    for (const item of purchaseItems) {
      const key = item.description.trim().toUpperCase() + '|' + (item.hsn_code || '');
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ description: item.description.trim(), hsn_code: item.hsn_code || '', unit: item.unit || 'NOS', rate: parseFloat(item.rate) || 0, cgst_rate: parseFloat(item.cgst_rate) || 0, sgst_rate: parseFloat(item.sgst_rate) || 0, igst_rate: parseFloat(item.igst_rate) || 0 });
      if (results.length >= 15) break;
    }
    res.json({ success: true, items: results });
  } catch (err) { console.error('Item recent error:', err); res.status(500).json({ success: false, msg: 'Failed', items: [] }); }
});

module.exports = router;
