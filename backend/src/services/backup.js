// Per-organisation backups.
// A backup is a gzip-compressed JSON snapshot of every business table for one
// organisation, stored in the `backups` table (so it survives Render restarts,
// whose disk is wiped) and downloadable as a .json.gz file to keep offline.
// Users and the audit log are never overwritten by a restore.
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip), gunzip = promisify(zlib.gunzip);

const FORMAT = 'glob-erp-backup/1';
const KEEP_AUTO = 14;          // keep the last 14 automatic backups per org
const DAY = 24 * 60 * 60 * 1000;

// Parent tables first (insert order). Child tables are linked through their parent.
const ORG_TABLES = ['customers', 'suppliers', 'machines', 'workers', 'inventory', 'settings',
  'invoices', 'quotations', 'purchase_bills', 'payments', 'credit_notes', 'expenses', 'production', 'vehicle_papers'];
const CHILD_TABLES = [
  { table: 'invoice_items', fk: 'invoice_id', parent: 'invoices' },
  { table: 'quotation_items', fk: 'quotation_id', parent: 'quotations' },
  { table: 'purchase_bill_items', fk: 'purchase_id', parent: 'purchase_bills' },
];
const ORG_SKIP_COLS = ['id', 'created_at', 'smtp_pass']; // never overwrite these on the org row

async function ensureTable(db) {
  if (await db.schema.hasTable('backups')) return;
  await db.schema.createTable('backups', t => {
    t.increments('id').primary();
    t.integer('organization_id').notNullable().index();
    t.text('kind').notNullable().defaultTo('manual'); // auto | manual | pre-restore
    t.text('note');
    t.integer('row_count').defaultTo(0);
    t.integer('size_bytes').defaultTo(0);
    t.binary('data').notNullable();
    t.integer('created_by');
    t.timestamp('created_at').defaultTo(db.fn.now());
  });
}

async function existing(db, tables) {
  const rows = await db('information_schema.tables').where({ table_schema: 'public' }).whereIn('table_name', tables).select('table_name');
  return new Set(rows.map(r => r.table_name));
}

async function snapshot(db, orgId) {
  const have = await existing(db, [...ORG_TABLES, ...CHILD_TABLES.map(c => c.table)]);
  const org = await db('organizations').where({ id: orgId }).first();
  if (!org) throw Object.assign(new Error('Organisation not found'), { status: 404 });
  delete org.smtp_pass;
  const tables = {};
  for (const t of ORG_TABLES) if (have.has(t)) tables[t] = await db(t).where({ organization_id: orgId }).orderBy('id');
  for (const c of CHILD_TABLES) {
    if (!have.has(c.table) || !tables[c.parent]) continue;
    const ids = tables[c.parent].map(r => r.id);
    tables[c.table] = ids.length ? await db(c.table).whereIn(c.fk, ids).orderBy('id') : [];
  }
  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  return { format: FORMAT, created_at: new Date().toISOString(), organization: org, counts, tables };
}

async function createBackup(db, orgId, { kind = 'manual', note = null, userId = null } = {}) {
  await ensureTable(db);
  const snap = await snapshot(db, orgId);
  const data = await gzip(Buffer.from(JSON.stringify(snap)));
  const rowCount = Object.values(snap.counts).reduce((a, b) => a + b, 0);
  const [row] = await db('backups').insert({ organization_id: orgId, kind, note, row_count: rowCount, size_bytes: data.length, data, created_by: userId }).returning(['id', 'created_at']);
  if (kind === 'auto') {
    const old = await db('backups').where({ organization_id: orgId, kind: 'auto' }).orderBy('created_at', 'desc').offset(KEEP_AUTO).pluck('id');
    if (old.length) await db('backups').whereIn('id', old).del();
  }
  return { id: row.id, created_at: row.created_at, kind, row_count: rowCount, size_bytes: data.length, counts: snap.counts };
}

async function listBackups(db, orgId) {
  await ensureTable(db);
  return db('backups').where({ organization_id: orgId }).orderBy('created_at', 'desc')
    .select('id', 'kind', 'note', 'row_count', 'size_bytes', 'created_at');
}

async function readBackup(db, orgId, id) {
  await ensureTable(db);
  return db('backups').where({ organization_id: orgId, id }).first();
}

async function decode(buf) {
  let text;
  try { text = (await gunzip(buf)).toString('utf8') } catch { text = Buffer.from(buf).toString('utf8') } // allow plain .json too
  let snap;
  try { snap = JSON.parse(text) } catch { throw Object.assign(new Error('This file is not a Glob ERP backup'), { status: 400 }) }
  if (snap?.format !== FORMAT || !snap.tables) throw Object.assign(new Error('This file is not a Glob ERP backup'), { status: 400 });
  return snap;
}

async function columnsOf(trx, table) {
  return new Set((await trx('information_schema.columns').where({ table_schema: 'public', table_name: table }).pluck('column_name')));
}

// Replace all of this organisation's business data with the snapshot, atomically.
async function restore(db, orgId, snap, { userId = null } = {}) {
  await ensureTable(db);
  if (snap.organization && Number(snap.organization.id) !== Number(orgId)) {
    // A backup from another organisation is allowed (e.g. moving data), but ids are re-used only when free.
  }
  // Safety net: snapshot the current state first, so a restore can itself be undone.
  const safety = await createBackup(db, orgId, { kind: 'pre-restore', note: 'Automatic copy taken just before a restore', userId });

  const have = await existing(db, [...ORG_TABLES, ...CHILD_TABLES.map(c => c.table)]);
  const counts = {};
  await db.transaction(async trx => {
    // 1. delete current data (children first, then parents in reverse order)
    for (const c of CHILD_TABLES) {
      if (!have.has(c.table) || !have.has(c.parent)) continue;
      await trx(c.table).whereIn(c.fk, trx(c.parent).select('id').where({ organization_id: orgId })).del();
    }
    for (const t of [...ORG_TABLES].reverse()) if (have.has(t)) await trx(t).where({ organization_id: orgId }).del();

    // 2. organisation settings row
    if (snap.organization) {
      const cols = await columnsOf(trx, 'organizations');
      const upd = {};
      for (const [k, v] of Object.entries(snap.organization)) if (cols.has(k) && !ORG_SKIP_COLS.includes(k)) upd[k] = v;
      if (Object.keys(upd).length) await trx('organizations').where({ id: orgId }).update(upd);
    }

    // 3. insert parents, then children, keeping only columns that exist today
    const order = [...ORG_TABLES.slice(0, 7), 'invoice_items', 'quotations', 'quotation_items', 'purchase_bills', 'purchase_bill_items', ...ORG_TABLES.slice(9)];
    for (const t of order) {
      const rows = snap.tables[t];
      if (!have.has(t) || !Array.isArray(rows) || !rows.length) { counts[t] = 0; continue }
      const cols = await columnsOf(trx, t);
      const clean = rows.map(r => {
        const o = {};
        for (const [k, v] of Object.entries(r)) if (cols.has(k)) o[k] = (v !== null && typeof v === 'object' && !(v instanceof Date)) ? JSON.stringify(v) : v;
        if (cols.has('organization_id') && !CHILD_TABLES.some(c => c.table === t)) o.organization_id = orgId;
        return o;
      });
      for (let i = 0; i < clean.length; i += 500) await trx(t).insert(clean.slice(i, i + 500));
      counts[t] = clean.length;
      if (cols.has('id')) await trx.raw(`SELECT setval(pg_get_serial_sequence(?, 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ??), 1))`, [t, t]);
    }
  });
  return { restored: counts, safetyBackupId: safety.id };
}

// Daily automatic backups. Render's free plan sleeps, so this runs on start-up
// and then hourly while awake, backing up any organisation whose last automatic
// backup is more than a day old.
async function runDueBackups(db, log = console) {
  try {
    await ensureTable(db);
    const orgs = await db('organizations').pluck('id');
    for (const orgId of orgs) {
      const last = await db('backups').where({ organization_id: orgId, kind: 'auto' }).max('created_at as at').first();
      if (last?.at && Date.now() - new Date(last.at).getTime() < DAY) continue;
      const b = await createBackup(db, orgId, { kind: 'auto', note: 'Daily automatic backup' });
      log.log?.(`💾 Auto backup org ${orgId}: ${b.row_count} rows, ${Math.round(b.size_bytes / 1024)} KB`);
    }
  } catch (e) { log.error?.('Auto backup failed:', e.message) }
}

function startScheduler(db, { firstDelayMs = 60 * 1000, everyMs = 60 * 60 * 1000 } = {}) {
  const t1 = setTimeout(() => runDueBackups(db), firstDelayMs);
  const t2 = setInterval(() => runDueBackups(db), everyMs);
  t1.unref?.(); t2.unref?.();
  return () => { clearTimeout(t1); clearInterval(t2) };
}

module.exports = { FORMAT, ORG_TABLES, CHILD_TABLES, ensureTable, snapshot, createBackup, listBackups, readBackup, decode, restore, runDueBackups, startScheduler };
