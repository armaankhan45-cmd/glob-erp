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
// Fixes TWO problems permanently for ALL routes:
// 1. Empty string "" for date columns → null (PostgreSQL rejects "" for DATE type)
// 2. Wrong column name "total" → "total_amount" (our DB uses total_amount, not total)

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

// Columns that do NOT exist in our tables - strip them out to prevent SQL errors
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
    endpoints: ['/api/health', '/api/setup', '/api/auth/login']
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

function safe(path) {
  try { return require(path); } catch(e) { console.error('Route error:', path, e.message); return express.Router(); }
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
app.use('/api/settings', safe('./routes/settingsRoutes'));
app.use('/api/export', safe('./routes/exportRoutes'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, msg: err.message });
});

app.listen(PORT, () => {
  console.log('🚀 Glob ERP API running on port ' + PORT);
  setupDB();
});

async function setupDB() {
  try {
    console.log('⏳ Auto-setting up database...');
    const hasOrgs = await db.schema.hasTable('organizations');
    if (!hasOrgs) {
      console.log('📦 Creating tables...');
      const migration = require('./migrations/001_initial_schema');
      await migration.up(db);
      console.log('✅ Tables created!');
    }
    
    // Auto-migrate: add missing columns
    const cols = {
      branch: await db.schema.hasColumn('organizations', 'branch'),
      stamp_url: await db.schema.hasColumn('organizations', 'stamp_url'),
      signature_url: await db.schema.hasColumn('organizations', 'signature_url'),
    };
    if (!cols.branch) { await db.schema.table('organizations', table => { table.text('branch'); }); console.log('✅ Added branch column'); }
    if (!cols.stamp_url) { await db.schema.table('organizations', table => { table.text('stamp_url'); }); console.log('✅ Added stamp_url column'); }
    if (!cols.signature_url) { await db.schema.table('organizations', table => { table.text('signature_url'); }); console.log('✅ Added signature_url column'); }
    
    const orgCount = await db('organizations').count('id as count').first();
    if (parseInt(orgCount.count) === 0) {
      console.log('🌱 Inserting seed data...');
      const seed = require('./seeds/001_initial_data');
      await seed.seed(db);
      console.log('✅ Ready! Login: admin@globfabrication.com / admin123');
    } else {
      console.log('✅ Database ready (' + orgCount.count + ' organizations)');
    }
  } catch(e) {
    console.error('⚠️ DB setup error:', e.message);
  }
}

process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err.message));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err));
