// Load .env file (only in development - Render uses env vars directly)
try { require('dotenv').config(); } catch(e) { /* .env not available, use system env vars */ }

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const creditNoteRoutes = require('./routes/creditNoteRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const workerRoutes = require('./routes/workerRoutes');
const machineRoutes = require('./routes/machineRoutes');
const productionRoutes = require('./routes/productionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const gstRoutes = require('./routes/gstRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.AUTH_RATE_LIMIT,
  message: { success: false, msg: 'Too many requests. Try again in a minute.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.API_RATE_LIMIT,
  message: { success: false, msg: 'API rate limit exceeded.' }
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Uploads directory
const uploadDir = config.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/customers', apiLimiter, customerRoutes);
app.use('/api/invoices', apiLimiter, invoiceRoutes);
app.use('/api/quotations', apiLimiter, quotationRoutes);
app.use('/api/purchases', apiLimiter, purchaseRoutes);
app.use('/api/payments', apiLimiter, paymentRoutes);
app.use('/api/expenses', apiLimiter, expenseRoutes);
app.use('/api/credit-notes', apiLimiter, creditNoteRoutes);
app.use('/api/suppliers', apiLimiter, supplierRoutes);
app.use('/api/inventory', apiLimiter, inventoryRoutes);
app.use('/api/workers', apiLimiter, workerRoutes);
app.use('/api/machines', apiLimiter, machineRoutes);
app.use('/api/production', apiLimiter, productionRoutes);
app.use('/api/dashboard', apiLimiter, dashboardRoutes);
app.use('/api/gst', apiLimiter, gstRoutes);
app.use('/api/reports', apiLimiter, reportRoutes);
app.use('/api/settings', apiLimiter, settingsRoutes);
app.use('/api/export', apiLimiter, exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, msg: 'Glob ERP API running', timestamp: new Date() });
});

// Error handler
app.use(errorHandler);

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Glob ERP API running on port ${PORT} [${config.NODE_ENV}]`);
});
