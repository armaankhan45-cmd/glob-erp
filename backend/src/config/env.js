try { require('dotenv').config(); } catch(e) { /* use system env vars */ }

const NODE_ENV = process.env.NODE_ENV || 'development';

const JWT_SECRET = process.env.JWT_SECRET;
if (NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  console.warn('⚠️  WARNING: JWT_SECRET is missing or shorter than 32 chars in production.');
  console.warn('   Set a long random JWT_SECRET in Render → Environment so users stay logged in across restarts.');
}
const FALLBACK_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(48).toString('hex');

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: FALLBACK_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://glob-erp.vercel.app,http://localhost:5173',
  SETUP_SECRET: process.env.SETUP_SECRET || '',
  SMTP: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  },
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 2097152,
  AUTH_RATE_LIMIT: parseInt(process.env.AUTH_RATE_LIMIT) || 60,
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT) || 200
};
