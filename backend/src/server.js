// Load .env file (only in development - Render uses env vars directly)
try { require('dotenv').config(); } catch(e) { /* use system env vars on Render */ }

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const knex = require('knex');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

// Create Knex instance (used everywhere)
const db = knex({
  client: 'pg',
  connection: config.DATABASE_URL || process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 30000
});

// Override the getDb function to return our instance
const originalGetDb = require('./config/db');
// Replace module exports so all routes use the same instance
require.cache[require.resolve('./config/db')].exports = () => db;

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.AUTH_RATE_LIMIT || 5,
  message: { success: false, msg: 'Too many requests. Try again in a minute.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.API_RATE_LIMIT || 100,
  message: { success: false, msg: 'API rate limit exceeded.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploads directory
const uploadDir = config.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Lazy-load routes (prevents missing module crashes)
function loadRoutes(path) {
  try { return require(path); } catch(e) { console.error(`Failed to load ${path}:`, e.message); return express.Router(); }
}

// Routes
app.use('/api/auth', authLimiter, loadRoutes('./routes/authRoutes'));
app.use('/api/customers', apiLimiter, loadRoutes('./routes/customerRoutes'));
app.use('/api/invoices', apiLimiter, loadRoutes('./routes/invoiceRoutes'));
app.use('/api/quotations', apiLimiter, loadRoutes('./routes/quotationRoutes'));
app.use('/api/purchases', apiLimiter, loadRoutes('./routes/purchaseRoutes'));
app.use('/api/payments', apiLimiter, loadRoutes('./routes/paymentRoutes'));
app.use('/api/expenses', apiLimiter, loadRoutes('./routes/expenseRoutes'));
app.use('/api/credit-notes', apiLimiter, loadRoutes('./routes/creditNoteRoutes'));
app.use('/api/suppliers', apiLimiter, loadRoutes('./routes/supplierRoutes'));
app.use('/api/inventory', apiLimiter, loadRoutes('./routes/inventoryRoutes'));
app.use('/api/workers', apiLimiter, loadRoutes('./routes/workerRoutes'));
app.use('/api/machines', apiLimiter, loadRoutes('./routes/machineRoutes'));
app.use('/api/production', apiLimiter, loadRoutes('./routes/productionRoutes'));
app.use('/api/dashboard', apiLimiter, loadRoutes('./routes/dashboardRoutes'));
app.use('/api/gst', apiLimiter, loadRoutes('./routes/gstRoutes'));
app.use('/api/reports', apiLimiter, loadRoutes('./routes/reportRoutes'));
app.use('/api/settings', apiLimiter, loadRoutes('./routes/settingsRoutes'));
app.use('/api/export', apiLimiter, loadRoutes('./routes/exportRoutes'));

// Health check with DB test
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.raw('SELECT 1 as ok');
    res.json({ success: true, msg: 'Glob ERP API running', db: 'connected', timestamp: new Date() });
  } catch (err) {
    res.json({ success: true, msg: 'Glob ERP API running', db: 'not connected - ' + err.message, timestamp: new Date() });
  }
});

// Setup endpoint - run migrations manually
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
    res.json({ success: true, msg: 'Database setup complete! Login: admin@globfabrication.com / admin123' });
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Setup failed: ' + err.message });
  }
});

// Error handler
app.use(errorHandler);

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err.message);
});

// Auto-run migrations and seeds on startup
async function setupDatabase() {
  try {
    console.log('⏳ Setting up database...');
    
    const hasOrgs = await db.schema.hasTable('organizations');
    if (!hasOrgs) {
      console.log('📦 Creating database tables...');
      const migration = require('./migrations/001_initial_schema');
      await migration.up(db);
      console.log('✅ Tables created!');
    } else {
      console.log('✅ Tables already exist');
    }

    const orgCount = await db('organizations').count('id as count').first();
    if (parseInt(orgCount.count) === 0) {
      console.log('🌱 Inserting seed data...');
      const seed = require('./seeds/001_initial_data');
      await seed.seed(db);
      console.log('✅ Seed data inserted!');
      console.log('📧 Login: admin@globfabrication.com / admin123');
    } else {
      console.log('✅ Data exists (' + orgCount.count + ' orgs)');
    }
  } catch (err) {
    console.error('⚠️ Database setup error:', err.message);
  }
}

const PORT = config.PORT || process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Glob ERP API running on port ${PORT} [${config.NODE_ENV || 'production'}]`);
  await setupDatabase();
});
