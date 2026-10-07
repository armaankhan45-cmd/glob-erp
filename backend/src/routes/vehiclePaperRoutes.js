const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// ═══════════════════════════════════════════════════════════════
// VEHICLE PAPERS MODULE
// Money Margin Receipt · Form 22-A · Form 17 · Vahan Paper
// ═══════════════════════════════════════════════════════════════

const TYPE_PREFIX = {
  money_receipt: 'MR',
  form_22a: '22A',
  form_17: 'F17',
  vahan: 'VH',
};

// Only these columns can ever be written (protects the table)
const PAPER_COLUMNS = [
  'type', 'paper_no', 'paper_date', 'title',
  'customer_id', 'customer_name', 'customer_address', 'customer_gstin', 'customer_phone',
  'vehicle_no', 'chassis_no', 'engine_no', 'model',
  'amount', 'payment_mode', 'reference', 'bank_name', 'reference_date',
  'towards', 'balance_amount', 'notes',
  'image_data', 'data',
];

function fyLabel(d = new Date()) {
  const m = d.getMonth();
  const y = d.getFullYear();
  const s = (n) => String(n).padStart(2, '0');
  return m < 3 ? `${s((y - 1) % 100)}-${s(y % 100)}` : `${s(y % 100)}-${s((y + 1) % 100)}`;
}

function pickPaper(body = {}) {
  const out = {};
  for (const col of PAPER_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col] === '' ? null : body[col];
  }
  return out;
}

// ─── Next suggested number, e.g. MR-0001/26-27 ───
router.get('/next-number', auth, async (req, res) => {
  try {
    const db = getDb();
    const type = req.query.type || 'money_receipt';
    const prefix = TYPE_PREFIX[type] || 'VP';
    const last = await db('vehicle_papers')
      .where({ organization_id: req.user.organization_id, type })
      .orderBy('id', 'desc')
      .first('paper_no', 'id');

    let next = 1;
    if (last?.paper_no) {
      const m = String(last.paper_no).match(/-(\d{1,6})/);
      if (m) next = parseInt(m[1]) + 1;
      else next = (last.id || 0) + 1;
    } else if (last?.id) {
      next = (last.id || 0) + 1;
    }

    res.json({
      success: true,
      nextNumber: `${prefix}-${String(next).padStart(4, '0')}/${fyLabel()}`,
      nextNumeric: next,
    });
  } catch (err) {
    console.error('Vehicle paper next-number error:', err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ─── List (heavy image data is stripped; list only flags has_image) ───
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { type, search, limit } = req.query;
    let q = db('vehicle_papers').where({ organization_id: req.user.organization_id });
    if (type && type !== 'all') q = q.where({ type });
    if (search) {
      q = q.where(function () {
        this.where('paper_no', 'ilike', `%${search}%`)
          .orWhere('customer_name', 'ilike', `%${search}%`)
          .orWhere('vehicle_no', 'ilike', `%${search}%`)
          .orWhere('chassis_no', 'ilike', `%${search}%`)
          .orWhere('engine_no', 'ilike', `%${search}%`);
      });
    }
    const rows = await q.orderBy('id', 'desc').limit(parseInt(limit) || 300);
    const papers = rows.map((r) => {
      const { image_data, ...rest } = r;
      return { ...rest, has_image: !!image_data };
    });
    res.json({ success: true, papers });
  } catch (err) {
    console.error('List vehicle papers error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message, papers: [] });
  }
});

// ─── Single (with image) ───
router.get('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const paper = await db('vehicle_papers')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .first();
    if (!paper) return res.status(404).json({ success: false, msg: 'Paper not found' });
    res.json({ success: true, paper });
  } catch (err) {
    console.error('Get vehicle paper error:', err);
    res.status(500).json({ success: false, msg: err.message });
  }
});

// ─── Create ───
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = {
      ...pickPaper(req.body),
      organization_id: req.user.organization_id,
      created_by: req.user.id,
      created_at: new Date(),
      updated_at: new Date(),
    };
    if (!data.type) data.type = 'money_receipt';
    if (!data.paper_date) data.paper_date = new Date().toISOString().slice(0, 10);

    const [row] = await db('vehicle_papers').insert(data).returning('id');
    const id = row?.id || row;
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'vehicle_papers', id, null, { type: data.type, paper_no: data.paper_no }, req.ip);
    res.status(201).json({ success: true, paper: { id }, msg: 'Paper saved' });
  } catch (err) {
    console.error('Create vehicle paper error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

// ─── Update ───
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const id = req.params.id;
    const existing = await db('vehicle_papers')
      .where({ id, organization_id: req.user.organization_id })
      .first();
    if (!existing) return res.status(404).json({ success: false, msg: 'Paper not found' });

    const data = { ...pickPaper(req.body), updated_at: new Date() };
    delete data.type; // type never changes after creation
    await db('vehicle_papers').where({ id, organization_id: req.user.organization_id }).update(data);
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'vehicle_papers', id, { paper_no: existing.paper_no }, { paper_no: data.paper_no }, req.ip);
    res.json({ success: true, msg: 'Paper updated' });
  } catch (err) {
    console.error('Update vehicle paper error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

// ─── Delete ───
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const deleted = await db('vehicle_papers')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .del();
    if (!deleted) return res.status(404).json({ success: false, msg: 'Paper not found' });
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'vehicle_papers', req.params.id, null, null, req.ip);
    res.json({ success: true, msg: 'Paper deleted' });
  } catch (err) {
    console.error('Delete vehicle paper error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

module.exports = router;
