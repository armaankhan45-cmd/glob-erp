try { require('dotenv').config(); } catch(e) { /* use system env vars */ }

const NODE_ENV = process.env.NODE_ENV || 'development';

// FIX #3: Force a real JWT_SECRET in production — refuse to boot with weak/default secret
const JWT_SECRET = process.env.JWT_SECRET;
if (NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ FATAL: JWT_SECRET must be set and at least 32 characters in production.');
    console.error('   Set it in your Render/Railway env vars and redeploy.');
    process.exit(1);
  }
}
// In development, generate a random secret per boot (tokens don't persist across restarts)
const FALLBACK_SECRET = require('crypto').randomBytes(48).toString('hex');

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: JWT_SECRET || FALLBACK_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  SETUP_SECRET: process.env.SETUP_SECRET || '', // FIX #2: secret required to run /api/setup
  SMTP: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  },
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 2097152,
  AUTH_RATE_LIMIT: parseInt(process.env.AUTH_RATE_LIMIT) || 5,
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT) || 100
};
