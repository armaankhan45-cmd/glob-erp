const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════
// GLOBAL SEARCH — powers the TopBar search box
// GET /api/search?q=shiv        → { results: [ { type, id, title, subtitle, path } ] }
// Searches: invoices · quotations · purchase bills · customers · vehicle papers
// ═══════════════════════════════════════════════════════════════

function inr(n) {
  const v = parseFloat(n) || 0;
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

// Each source runs on its own — if one table/column is missing, the rest still work.
async function safe(fn) {
  try { return await fn(); } catch (e) { console.error('Search part failed:', e.message); return []; }
}

router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const q = (req.query.q || '').trim();
    const perSource = Math.min(parseInt(req.query.limit) || 4, 10);

    if (q.length < 2) return res.json({ success: true, results: [] });
    const like = `%${q}%`;

    const [invoices, quotations, purchases, customers, papers] = await Promise.all([
      // ── Invoices ──
      safe(async () => (await db('invoices')
        .leftJoin('customers', 'invoices.customer_id', 'customers.id')
        .where('invoices.organization_id', orgId)
        .andWhere(function () {
          this.where('invoices.invoice_number', 'ilike', like)
            .orWhere('customers.name', 'ilike', like)
            .orWhere('customers.gstin', 'ilike', like);
        })
        .select('invoices.id', 'invoices.invoice_number', 'invoices.total_amount', 'invoices.invoice_date', 'customers.name as customer_name')
        .orderBy('invoices.id', 'desc')
        .limit(perSource)).map(r => ({
          type: 'invoice', id: r.id,
          title: r.invoice_number || `Invoice #${r.id}`,
          subtitle: [r.customer_name, inr(r.total_amount), fmtDate(r.invoice_date)].filter(Boolean).join(' · '),
          path: `/app/invoices/${r.id}`,
        }))),

      // ── Quotations ──
      safe(async () => (await db('quotations')
        .leftJoin('customers', 'quotations.customer_id', 'customers.id')
        .where('quotations.organization_id', orgId)
        .andWhere(function () {
          this.where('quotations.quotation_number', 'ilike', like)
            .orWhere('customers.name', 'ilike', like);
        })
        .select('quotations.id', 'quotations.quotation_number', 'quotations.total_amount', 'quotations.quotation_date', 'customers.name as customer_name')
        .orderBy('quotations.id', 'desc')
        .limit(perSource)).map(r => ({
          type: 'quotation', id: r.id,
          title: r.quotation_number || `Quotation #${r.id}`,
          subtitle: [r.customer_name, inr(r.total_amount), fmtDate(r.quotation_date)].filter(Boolean).join(' · '),
          path: `/app/quotations/${r.id}`,
        }))),

      // ── Purchase bills ──
      safe(async () => (await db('purchase_bills')
        .where({ organization_id: orgId })
        .andWhere(function () {
          this.where('bill_number', 'ilike', like)
            .orWhere('supplier_name', 'ilike', like)
            .orWhere('supplier_gstin', 'ilike', like);
        })
        .select('id', 'bill_number', 'supplier_name', 'total_amount', 'bill_date')
        .orderBy('id', 'desc')
        .limit(perSource)).map(r => ({
          type: 'purchase', id: r.id,
          title: r.bill_number || `Bill #${r.id}`,
          subtitle: [r.supplier_name, inr(r.total_amount), fmtDate(r.bill_date)].filter(Boolean).join(' · '),
          path: `/app/purchases/${r.id}`,
        }))),

      // ── Customers ──
      safe(async () => (await db('customers')
        .where({ organization_id: orgId })
        .andWhere(function () {
          this.where('name', 'ilike', like)
            .orWhere('gstin', 'ilike', like)
            .orWhere('phone', 'ilike', like)
            .orWhere('city', 'ilike', like);
        })
        .select('id', 'name', 'gstin', 'phone', 'city')
        .orderBy('name', 'asc')
        .limit(perSource)).map(r => ({
          type: 'customer', id: r.id,
          title: r.name || `Customer #${r.id}`,
          subtitle: [r.gstin, r.phone, r.city].filter(Boolean).join(' · '),
          path: `/app/customers/${r.id}`,
        }))),

      // ── Vehicle papers (Form 17 / Vahan / 22-A / margin money) ──
      safe(async () => (await db('vehicle_papers')
        .where({ organization_id: orgId })
        .andWhere(function () {
          this.where('paper_no', 'ilike', like)
            .orWhere('customer_name', 'ilike', like)
            .orWhere('vehicle_no', 'ilike', like)
            .orWhere('chassis_no', 'ilike', like)
            .orWhere('engine_no', 'ilike', like);
        })
        .select('id', 'paper_no', 'type', 'customer_name', 'vehicle_no', 'chassis_no')
        .orderBy('id', 'desc')
        .limit(perSource)).map(r => ({
          type: 'paper', id: r.id,
          title: r.paper_no || `${(r.type || 'paper').replace(/_/g, ' ')} #${r.id}`,
          subtitle: [r.vehicle_no, r.customer_name, r.chassis_no].filter(Boolean).join(' · '),
          path: `/app/vehicle-papers/${r.id}`,
        }))),
    ]);

    // Interleave so every category is visible near the top
    const buckets = [invoices, quotations, purchases, customers, papers];
    const results = [];
    for (let i = 0; i < perSource; i++) {
      for (const b of buckets) if (b[i]) results.push(b[i]);
    }

    res.json({ success: true, count: results.length, results: results.slice(0, 20) });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, msg: 'Search failed', results: [] });
  }
});

module.exports = router;
