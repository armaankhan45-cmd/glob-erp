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

// ═══════════════════════════════════════════════════════════════
// SELF-SUFFICIENT TABLE
// The startup self-heal engine once crashed with
// "Cannot read properties of undefined (reading 'fn')" and left the
// table missing → every save failed with
// 'relation "vehicle_papers" does not exist'.
// This creates/repairs the table on first use, re-checks it every
// 60s, and rebuilds it automatically if it ever disappears again.
// ═══════════════════════════════════════════════════════════════
const TABLE_COLUMNS = {
  organization_id: 'integer',
  type: 'text',
  paper_no: 'text',
  paper_date: 'date',
  title: 'text',
  customer_id: 'integer',
  customer_name: 'text',
  customer_address: 'text',
  customer_gstin: 'text',
  customer_phone: 'text',
  vehicle_no: 'text',
  chassis_no: 'text',
  engine_no: 'text',
  model: 'text',
  amount: 'numeric(15,2) DEFAULT 0',
  payment_mode: 'text',
  reference: 'text',
  bank_name: 'text',
  reference_date: 'date',
  towards: 'text',
  balance_amount: 'numeric(15,2) DEFAULT 0',
  notes: 'text',
  image_data: 'text',
  data: 'jsonb',
  created_by: 'integer',
  created_at: 'timestamp DEFAULT now()',
  updated_at: 'timestamp DEFAULT now()',
};

const ENSURE_TTL_MS = 60 * 1000;
let ensurePromise = null;
let ensuredAt = 0;

async function ensureTable(db) {
  const now = Date.now();
  if (ensurePromise && (now - ensuredAt) < ENSURE_TTL_MS) return ensurePromise;

  ensuredAt = now;
  ensurePromise = (async () => {
    const exists = await db.schema.hasTable('vehicle_papers');
    if (!exists) {
      console.log('🔧 vehicle_papers table missing → creating...');
      await db.schema.createTable('vehicle_papers', (t) => {
        t.increments('id').primary();
        t.integer('organization_id');
        t.text('type');
        t.text('paper_no');
        t.date('paper_date');
        t.text('title');
        t.integer('customer_id');
        t.text('customer_name');
        t.text('customer_address');
        t.text('customer_gstin');
        t.text('customer_phone');
        t.text('vehicle_no');
        t.text('chassis_no');
        t.text('engine_no');
        t.text('model');
        t.decimal('amount', 15, 2).defaultTo(0);
        t.text('payment_mode');
        t.text('reference');
        t.text('bank_name');
        t.date('reference_date');
        t.text('towards');
        t.decimal('balance_amount', 15, 2).defaultTo(0);
        t.text('notes');
        t.text('image_data');
        t.jsonb('data');
        t.integer('created_by');
        t.timestamp('created_at').defaultTo(db.fn.now());
        t.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('✅ vehicle_papers table created');
    } else {
      // repair missing columns (older / partially created table)
      for (const [col, type] of Object.entries(TABLE_COLUMNS)) {
        const has = await db.schema.hasColumn('vehicle_papers', col);
        if (!has) {
          console.log(`🔧 vehicle_papers.${col} missing → adding...`);
          await db.raw(`ALTER TABLE vehicle_papers ADD COLUMN ${col} ${type}`);
        }
      }
    }
    try {
      await db.raw('CREATE INDEX IF NOT EXISTS idx_vehicle_papers_org ON vehicle_papers(organization_id)');
      await db.raw('CREATE INDEX IF NOT EXISTS idx_vehicle_papers_type ON vehicle_papers(type)');
    } catch (e) { /* indexes are optional */ }
    return true;
  })();

  try {
    return await ensurePromise;
  } catch (e) {
    console.error('❌ ensureTable(vehicle_papers) failed:', e.message);
    ensurePromise = null;
    ensuredAt = 0;
    throw e;
  }
}

function isMissingTable(e) {
  return e && (e.code === '42P01' || /relation .* does not exist/i.test(e.message || ''));
}

/**
 * Runs a DB operation on vehicle_papers, creating/repairing the table first.
 * If PostgreSQL still says the table is missing (e.g. it was dropped while
 * the server was running), the cache is cleared, the table is rebuilt and
 * the operation is retried once — so a save can never fail for this reason.
 */
async function withTable(db, fn) {
  await ensureTable(db);
  try {
    return await fn();
  } catch (e) {
    if (isMissingTable(e)) {
      console.warn('⚠️  vehicle_papers vanished — rebuilding and retrying…');
      ensurePromise = null;
      ensuredAt = 0;
      await ensureTable(db);
      return await fn();
    }
    throw e;
  }
}

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
    const fx = fyLabel(type);
    const last = await withTable(db, () => db('vehicle_papers')
      .where({ organization_id: req.user.organization_id, type })
      .orderBy('id', 'desc')
      .first('paper_no', 'id'));

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
      nextNumber: `${prefix}-${String(next).padStart(4, '0')}/${fx}`,
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

    const rows = await withTable(db, () => {
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
      return q.orderBy('id', 'desc').limit(parseInt(limit) || 300);
    });

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
    const paper = await withTable(db, () => db('vehicle_papers')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .first());
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

    const id = await withTable(db, async () => {
      const [row] = await db('vehicle_papers').insert(data).returning('id');
      return row?.id || row;
    });

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
    const existing = await withTable(db, () => db('vehicle_papers')
      .where({ id, organization_id: req.user.organization_id })
      .first());
    if (!existing) return res.status(404).json({ success: false, msg: 'Paper not found' });

    const data = { ...pickPaper(req.body), updated_at: new Date() };
    delete data.type; // type never changes after creation
    await withTable(db, () => db('vehicle_papers')
      .where({ id, organization_id: req.user.organization_id })
      .update(data));
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
    const deleted = await withTable(db, () => db('vehicle_papers')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .del());
    if (!deleted) return res.status(404).json({ success: false, msg: 'Paper not found' });
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'vehicle_papers', req.params.id, null, null, req.ip);
    res.json({ success: true, msg: 'Paper deleted' });
  } catch (err) {
    console.error('Delete vehicle paper error:', err);
    res.status(500).json({ success: false, msg: 'Failed: ' + err.message });
  }
});

module.exports = router;
