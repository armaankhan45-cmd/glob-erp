try { require('dotenv').config(); } catch(e) {}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const knex = require('knex');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');

const app = express();
const PORT = config.PORT;

// Database - single instance
let db;
try {
  db = knex({
    client: 'pg',
    connection: config.DATABASE_URL,
    pool: { min: 1, max: 5 },
    acquireConnectionTimeout: 30000
  });
  require('./config/db').setDb(db);
} catch(e) {
  console.error('DB init error:', e.message);
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING — increased for cold-start scenarios
// Auth: 20 per 15 min (was 5 — too strict, users got locked out
// when retrying during server wake-up)
// ═══════════════════════════════════════════════════════════════
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.AUTH_RATE_LIMIT || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, msg: 'Too many requests. Try again in 15 minutes.' });
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.API_RATE_LIMIT || 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ success: false, msg: 'Too many requests. Slow down and try again.' });
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ═══════════════════════════════════════════════════════════════
// INSTANT PING — no DB, no auth, no rate limit
// Used by frontend keep-alive + cold-start wake-up
// ═══════════════════════════════════════════════════════════════
app.get('/api/ping', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ts: Date.now() });
});

const ALLOWED_ORIGINS = config.CORS_ORIGIN
  ? config.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['https://glob-erp.pages.dev', 'https://glob-erp.vercel.app', 'http://localhost:5173'];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://api.qrserver.com", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://glob-erp-api.onrender.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://api.qrserver.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/', apiLimiter);

// ====== GLOBAL DATA SANITIZATION MIDDLEWARE ======
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

const BLOCKED_COLUMNS = [
  'gst_rate', 'bold', 'calculated'
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (BLOCKED_COLUMNS.includes(key)) continue;
    const newKey = COLUMN_RENAMES[key] || key;
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
    req.body = sanitize(req.body);
    if (req.body.items && Array.isArray(req.body.items)) {
      req.body.items = req.body.items.map(item => sanitize(item));
    }
  }
  next();
});

// Static uploads
const fs = require('fs');
const uploadDir = config.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// ============ ROUTES ============

app.get('/', (req, res) => {
  res.json({
    success: true,
    msg: 'Glob ERP API is running!',
    time: new Date().toISOString(),
    endpoints: ['/api/ping', '/api/health', '/api/auth/login']
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

// FIX #2: Lock down /api/setup
app.get('/api/setup', async (req, res) => {
  try {
    const secret = req.headers['x-setup-secret'] || req.query.secret || '';
    if (!config.SETUP_SECRET || secret !== config.SETUP_SECRET) {
      return res.status(403).json({ success: false, msg: 'Setup requires SETUP_SECRET. Set the env var and pass it as X-Setup-Secret header or ?secret= param.' });
    }

    const orgCount = await db('organizations').count('id as count').first();
    if (parseInt(orgCount.count) > 0) {
      return res.status(403).json({ success: false, msg: 'Already initialized. Setup can only run once.' });
    }

    const hasOrgs = await db.schema.hasTable('organizations');
    if (!hasOrgs) {
      const migration = require('./migrations/001_initial_schema');
      await migration.up(db);
    }

    const seed = require('./seeds/001_initial_data');
    await seed.seed(db);

    res.json({ success: true, msg: 'Setup complete. Use your configured admin credentials to log in.' });
  } catch(e) {
    res.status(500).json({ success: false, msg: 'Setup failed: ' + e.message });
  }
});

// ====== SELF-HEAL DIAGNOSTIC ENDPOINT ======
const { selfHeal, trackError, getRecentErrors, errorTrackerMiddleware, TABLE_SCHEMAS } = require('./selfHeal');
const { auth, adminOnly } = require('./middleware/auth');

app.get('/api/diagnose', auth, adminOnly, async (req, res) => {
  try {
    const report = await selfHeal(db);
    res.json({ success: true, ...report });
  } catch(e) {
    res.status(500).json({ success: false, msg: 'Diagnose failed: ' + e.message, error: e.stack });
  }
});

app.get('/api/diagnose/errors', auth, adminOnly, (req, res) => {
  res.json({ success: true, errors: getRecentErrors(50), count: getRecentErrors(50).length });
});

app.get('/api/diagnose/table/:name', auth, adminOnly, async (req, res) => {
  try {
    const tableName = req.params.name;
    const exists = await db.schema.hasTable(tableName);
    if (!exists) return res.json({ success: false, msg: `Table "${tableName}" does NOT exist` });

    const expectedSchema = TABLE_SCHEMAS[tableName];
    const expectedColumns = expectedSchema ? Object.keys(expectedSchema.columns) : [];

    const actualCols = await db.raw(
      'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position',
      [tableName]
    );
    const actualColumnNames = actualCols.rows.map(r => r.column_name);

    const missingColumns = expectedColumns.filter(c => !actualColumnNames.includes(c));
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

// Route loading
function safe(path) {
  try {
    const router = require(path);
    if (router?.stack?.length === 0) {
      console.warn(`⚠️  Route ${path} loaded but has 0 routes — might be empty`);
    }
    return router;
  } catch(e) {
    console.error('❌ Route load FAILED:', path, '→', e.message);
    trackError('route_load', e, { originalUrl: path, method: 'LOAD' });
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

app.use(errorTrackerMiddleware);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    msg: `Route ${req.method} ${req.originalUrl} not found`,
    hint: 'Visit /api/diagnose to check all routes'
  });
});

app.listen(PORT, () => {
  console.log('🚀 Glob ERP API running on port ' + PORT);
  // ═══════════════════════════════════════════════════════════════
  // PRE-WARM DB — run a simple query immediately so the first
  // real request doesn't wait for a cold DB connection
  // ═══════════════════════════════════════════════════════════════
  try { db?.raw('SELECT 1').then(() => console.log('⚡ DB pre-warmed')).catch(() => {}); } catch(e) {}
  setupDB();
});

async function setupDB() {
  try {
    console.log('⏳ Auto-setting up database...');
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
