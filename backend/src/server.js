try { require('dotenv').config(); } catch(e) {}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const knex = require('knex');

const app = express();
const PORT = process.env.PORT || 5000;

// Database - single instance
let db;
try {
  db = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 1, max: 5 },
    acquireConnectionTimeout: 30000,
    ssl: { rejectUnauthorized: false }
  });
  require('./config/db').setDb(db);
} catch(e) {
  console.error('DB init error:', e.message);
}

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ====== GLOBAL DATA SANITIZATION MIDDLEWARE ======
// Fixes multiple problems permanently for ALL routes:
// 1. Empty string "" for date columns → null (PostgreSQL rejects "" for DATE type)
// 2. Wrong column name "total" → "total_amount" (our DB uses total_amount, not total)
// 3. Strips frontend-only columns that don't exist in DB tables

const DATE_FIELDS = [
  'invoice_date', 'due_date', 'quotation_date', 'validity_date',
  'bill_date', 'payment_date', 'expense_date', 'credit_date',
  'join_date', 'purchase_date', 'production_date', 'ack_date',
  'last_maintenance', 'next_maintenance'
];

const COLUMN_RENAMES = {
  'total': 'total_amount',
  'calculated_total': 'total_amount'
};

// Columns that do NOT exist in any table - strip them to prevent SQL errors
// Note: customer_name, additional_info, actual_notes are used by quotation routes 
// (stored in notes column via ||| separator) — they must be destructured OUT before SQL insert
// shipping_* fields are used by invoice routes — same pattern
const BLOCKED_COLUMNS = [
  'gst_rate', 'bold', 'calculated'
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip blocked columns that don't exist in DB
    if (BLOCKED_COLUMNS.includes(key)) continue;
    // Rename wrong column names
    const newKey = COLUMN_RENAMES[key] || key;
    // Convert empty string to null for date fields
    if (DATE_FIELDS.includes(key) && (value === '' || value === undefined)) {
      clean[newKey] = null;
    } else {
      clean[newKey] = value;
    }
  }
  return clean;
}

app.use((req, res, next) => {
  if (req.body) {
    // Sanitize top-level body
    req.body = sanitize(req.body);
    // Sanitize nested items array
    if (req.body.items && Array.isArray(req.body.items)) {
      req.body.items = req.body.items.map(item => sanitize(item));
    }
  }
  next();
});

// Static uploads
const fs = require('fs');
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// ============ ROUTES ============

app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    msg: 'Glob ERP API is running!', 
    time: new Date().toISOString(),
    endpoints: ['/api/health', '/api/setup', '/api/diagnose', '/api/auth/login']
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ success: true, msg: 'API running', db: 'connected' });
  } catch(e) {
    res.json({ success: true, msg: 'API running', db: 'ERROR: ' + e.message });
  }
});

app.get('/api/setup', async (req, res) => {
  try {
    const hasOrgs = await db.schema.hasTable('organizations');
    if (!hasOrgs) {
      const migration = require('./migrations/001_initial_schema');
      await migration.up(db);
    }
    const orgCount = await db('organizations').count('id as count').first();
    if (parseInt(orgCount.count) === 0) {
      const seed = require('./seeds/001_initial_data');
      await seed.seed(db);
    }
    res.json({ success: true, msg: 'Setup done! Login: admin@globfabrication.com / admin123' });
  } catch(e) {
    res.status(500).json({ success: false, msg: 'Setup failed: ' + e.message });
  }
});

// ====== SELF-HEAL DIAGNOSTIC ENDPOINT ======
const { selfHeal, trackError, getRecentErrors, errorTrackerMiddleware, TABLE_SCHEMAS } = require('./selfHeal');

// Lightweight auth check for diagnose endpoints
function simpleAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, msg: 'Login required' });
  try {
    const jwt = require('jsonwebtoken');
    const config = require('./config/env');
    jwt.verify(token, config.JWT_SECRET);
    next();
  } catch { return res.status(401).json({ success: false, msg: 'Invalid token' }); }
}

app.get('/api/diagnose', simpleAuth, async (req, res) => {
  try {
    const report = await selfHeal(db);
    res.json({ success: true, ...report });
  } catch(e) {
    res.status(500).json({ success: false, msg: 'Diagnose failed: ' + e.message, error: e.stack });
  }
});

// Recent errors endpoint (for debugging)
app.get('/api/diagnose/errors', simpleAuth, (req, res) => {
  res.json({ success: true, errors: getRecentErrors(50), count: getRecentErrors(50).length });
});

// Frontend error reporting endpoint (for auto-heal)
app.post('/api/diagnose/frontend-error', simpleAuth, async (req, res) => {
  try {
    const { message, stack, componentStack, url, userAgent, timestamp } = req.body;
    console.error('🛡️ FRONTEND ERROR REPORTED:', message);
    trackError('frontend', { message, stack, componentStack, url, userAgent, timestamp }, { originalUrl: url, method: 'FRONTEND_ERROR' });
    // Auto-fix: if it's a missing column error, trigger self-heal
    if (message && message.includes('column') && message.includes('does not exist')) {
      console.log('🔧 Auto-triggering self-heal for missing column...');
      try { await selfHeal(db); } catch(e) { console.error('Auto-heal trigger failed:', e.message); }
    }
    res.json({ success: true, msg: 'Error recorded', autoFixTriggered: message?.includes('column') });
  } catch(e) { res.json({ success: true, msg: 'Error logged (fallback)' }); }
});

// Quick column checker — given a table name, shows what columns exist vs expected
app.get('/api/diagnose/table/:name', simpleAuth, async (req, res) => {
  try {
    const tableName = req.params.name;
    const exists = await db.schema.hasTable(tableName);
    if (!exists) return res.json({ success: false, msg: `Table "${tableName}" does NOT exist` });
    
    const expectedSchema = TABLE_SCHEMAS[tableName];
    const expectedColumns = expectedSchema ? Object.keys(expectedSchema.columns) : [];
    
    // Get actual columns from information_schema
    const actualCols = await db.raw(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}' 
      ORDER BY ordinal_position
    `);
    const actualColumnNames = actualCols.rows.map(r => r.column_name);
    
    // Find missing columns
    const missingColumns = expectedColumns.filter(c => !actualColumnNames.includes(c));
    // Find extra columns (not in our schema — that's OK, might be auto-migrated)
    const extraColumns = actualColumnNames.filter(c => !expectedColumns.includes(c));
    
    res.json({
      success: true,
      table: tableName,
      exists: true,
      expectedColumns,
      actualColumns: actualColumnNames,
      missingColumns,
      extraColumns,
      columnDetails: actualCols.rows,
      hasMissingColumns: missingColumns.length > 0
    });
  } catch(e) {
    res.status(500).json({ success: false, msg: e.message });
  }
});

// Route loading — with self-healing awareness
function safe(path) {
  try { 
    const router = require(path); 
    // Verify the router actually has routes
    if (router?.stack?.length === 0) {
      console.warn(`⚠️  Route ${path} loaded but has 0 routes — might be empty`);
    }
    return router;
  } catch(e) { 
    console.error('❌ Route load FAILED:', path, '→', e.message);
    // Track the error
    trackError('route_load', e, { originalUrl: path, method: 'LOAD' });
    // Create a fallback router that returns 500 with helpful info
    const fallback = express.Router();
    fallback.all('*', (req, res) => res.status(500).json({ 
      success: false, 
      msg: `Route ${path} failed to load: ${e.message}`,
      autoFix: 'Visit /api/diagnose to auto-detect and fix issues'
    }));
    return fallback;
  }
}

app.use('/api/auth', safe('./routes/authRoutes'));
app.use('/api/customers', safe('./routes/customerRoutes'));
app.use('/api/invoices', safe('./routes/invoiceRoutes'));
app.use('/api/quotations', safe('./routes/quotationRoutes'));
app.use('/api/purchases', safe('./routes/purchaseRoutes'));
app.use('/api/payments', safe('./routes/paymentRoutes'));
app.use('/api/expenses', safe('./routes/expenseRoutes'));
app.use('/api/credit-notes', safe('./routes/creditNoteRoutes'));
app.use('/api/suppliers', safe('./routes/supplierRoutes'));
app.use('/api/inventory', safe('./routes/inventoryRoutes'));
app.use('/api/workers', safe('./routes/workerRoutes'));
app.use('/api/machines', safe('./routes/machineRoutes'));
app.use('/api/production', safe('./routes/productionRoutes'));
app.use('/api/dashboard', safe('./routes/dashboardRoutes'));
app.use('/api/gst', safe('./routes/gstRoutes'));
app.use('/api/reports', safe('./routes/reportRoutes'));
app.use('/api/ai', safe('./routes/aiAssistantRoutes'));
app.use('/api/settings', safe('./routes/settingsRoutes'));
app.use('/api/export', safe('./routes/exportRoutes'));

// ====== SELF-HEALING ERROR HANDLER ======
// This catches ALL unhandled errors and:
// 1. Tracks them in the error log
// 2. Detects common error patterns and gives helpful auto-fix hints
// 3. Returns user-friendly error messages
app.use(errorTrackerMiddleware);

// 404 handler — route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    msg: `Route ${req.method} ${req.originalUrl} not found`,
    hint: 'Visit /api/diagnose to check all routes'
  });
});

app.listen(PORT, () => {
  console.log('🚀 Glob ERP API running on port ' + PORT);
  setupDB();
});

async function setupDB() {
  try {
    console.log('⏳ Auto-setting up database...');
    
    // Run self-heal engine on startup
    const report = await selfHeal(db);
    
    if (report.fixes.length > 0) {
      console.log(`\n🔧 AUTO-FIXED ${report.fixes.length} issue(s) on startup:`);
      report.fixes.forEach(f => console.log(`   ✅ ${f.type}: ${f.table || ''} ${f.column || ''}`));
    }
    
    if (report.errors.length > 0) {
      console.log(`\n⚠️  ${report.errors.length} issue(s) need attention:`);
      report.errors.forEach(e => console.log(`   ❌ ${e.area}: ${e.error || e.message}`));
    }
    
    console.log('\n✅ Server ready!');
  } catch(e) {
    console.error('⚠️ DB setup error:', e.message);
  }
}

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message);
  trackError('uncaught', err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err?.message || err);
  trackError('unhandled', err);
});
