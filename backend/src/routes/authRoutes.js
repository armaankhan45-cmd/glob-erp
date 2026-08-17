const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const getDb = require('../config/db');
const config = require('../config/env');
const { auth, adminOnly } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// FIX #7: Joi validation schemas for auth routes
const Joi = require('joi');

const registerSchema = Joi.object({
  orgName: Joi.string().min(2).max(200).required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  gstin: Joi.string().max(15).allow('', null),
  address: Joi.string().max(500).allow('', null),
  city: Joi.string().max(100).allow('', null),
  state: Joi.string().max(100).allow('', null),
  state_code: Joi.string().max(2).allow('', null),
  pincode: Joi.string().max(10).allow('', null),
  phone: Joi.string().max(20).allow('', null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

const resetPasswordSchema = Joi.object({
  resetToken: Joi.string().length(64).required(), // FIX #1: require actual token, not userId
  newPassword: Joi.string().min(6).max(100).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(100).required(),
});

const addUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(100).required(),
  role: Joi.string().valid('admin', 'accountant', 'viewer').default('viewer'),
  phone: Joi.string().max(20).allow('', null),
});

// Register - creates organization + admin user
router.post('/register', async (req, res) => {
  try {
    // FIX #7: Validate input with Joi before touching DB
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { orgName, gstin, address, city, state, state_code, pincode, phone, email, password, name } = value;

    const db = getDb();

    // Check if email exists
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(400).json({ success: false, msg: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);

    // Create organization — FIX #4: explicit whitelist only
    const [org] = await db('organizations').insert({
      name: orgName,
      gstin: gstin || '',
      address: address || '',
      city: city || '',
      state: state || '',
      state_code: state_code || '',
      pincode: pincode || '',
      phone: phone || '',
      email: email
    }).returning('id');

    const orgId = org.id || org;

    // Create admin user — FIX #4: explicit whitelist
    const [user] = await db('users').insert({
      organization_id: orgId,
      name,
      email,
      password_hash: hash,
      role: 'admin',
      phone: phone || ''
    }).returning('id');

    // Default settings
    await db('settings').insert([
      { organization_id: orgId, key: 'invoice_prefix', value: 'GST-' },
      { organization_id: orgId, key: 'quotation_prefix', value: 'Q-' },
      { organization_id: orgId, key: 'print_letterhead_mm', value: '65' },
      { organization_id: orgId, key: 'print_footer_mm', value: '50' },
      { organization_id: orgId, key: 'print_font_size', value: '9.5' },
      { organization_id: orgId, key: 'default_gst_rate', value: '18' }
    ]);

    const token = jwt.sign(
      { id: user.id || user, email, organization_id: orgId, role: 'admin', name },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id || user, name, email, role: 'admin', organization_id: orgId }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, msg: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    // FIX #7: Validate input with Joi
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { email, password } = value;

    const db = getDb();
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({ success: false, msg: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, msg: 'Invalid credentials' });
    }

    const org = await db('organizations').where({ id: user.organization_id }).first();

    const token = jwt.sign(
      { id: user.id, email: user.email, organization_id: user.organization_id, role: user.role, name: user.name },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        organization_id: user.organization_id,
        organization: org
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, msg: 'Login failed' });
  }
});

// Forgot password - generate OTP
router.post('/forgot-password', async (req, res) => {
  try {
    // FIX #7: Validate input with Joi
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { email } = req.body;

    const db = getDb();
    const user = await db('users').where({ email }).first();
    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, msg: 'If email exists, OTP has been sent' });
    }

    // crypto.randomInt is cryptographically secure — Math.random() isn't meant for
    // anything security-sensitive, even a short-lived, rate-limited OTP.
    const otp = crypto.randomInt(100000, 1000000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 min

    await db('users').where({ id: user.id }).update({
      reset_otp: otp,
      reset_expires: expires
    });

    // Try to send email
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: config.SMTP.host,
        port: config.SMTP.port,
        auth: { user: config.SMTP.user, pass: config.SMTP.pass }
      });
      await transporter.sendMail({
        from: config.SMTP.from,
        to: email,
        subject: 'Glob ERP - Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}. Valid for 10 minutes.`
      });
    } catch (emailErr) {
      console.error('Email send error:', emailErr.message);
    }

    res.json({ success: true, msg: 'If email exists, OTP has been sent' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Verify OTP — FIX #1: Now generates a hashed reset_token stored in DB
router.post('/verify-otp', async (req, res) => {
  try {
    // FIX #7: Validate input with Joi
    const { error } = verifyOtpSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { email, otp } = req.body;
    const db = getDb();
    const user = await db('users').where({ email, reset_otp: otp }).first();
    if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
      return res.status(400).json({ success: false, msg: 'Invalid or expired OTP' });
    }

    // FIX #1: Generate a cryptographically random reset token, hash it, store in DB
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenExpires = Date.now() + 10 * 60 * 1000; // 10 min expiry

    // Clear OTP fields, store hashed reset token + expiry
    await db('users').where({ id: user.id }).update({
      reset_otp: null,
      reset_expires: null,
      reset_token: hashedToken,
      reset_token_expires: tokenExpires
    });

    // Return the RAW (unhashed) token to client — only the hashed version is stored
    res.json({ success: true, resetToken: rawToken });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, msg: 'Verification failed' });
  }
});

// Reset password — FIX #1: Requires resetToken (not userId), validates hashed token, single-use
router.post('/reset-password', async (req, res) => {
  try {
    // FIX #7: Validate input with Joi
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { resetToken, newPassword } = value;

    const db = getDb();

    // FIX #1: Hash the received token and look up user by hashed token
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const user = await db('users').where({ reset_token: hashedToken }).first();

    if (!user) {
      // FIX #1: Generic error — don't leak whether a token exists
      return res.status(400).json({ success: false, msg: 'Invalid or expired reset token' });
    }

    // Check token hasn't expired
    if (!user.reset_token_expires || user.reset_token_expires < Date.now()) {
      // Immediately invalidate expired token
      await db('users').where({ id: user.id }).update({ reset_token: null, reset_token_expires: null });
      return res.status(400).json({ success: false, msg: 'Invalid or expired reset token' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    // FIX #1: Immediately invalidate token so it can't be reused
    await db('users').where({ id: user.id }).update({
      password_hash: hash,
      reset_token: null,
      reset_token_expires: null,
      reset_otp: null,
      reset_expires: null
    });

    res.json({ success: true, msg: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, msg: 'Reset failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const db = getDb();
    const user = await db('users').where({ id: req.user.id }).first();
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        organization_id: user.organization_id,
        organization: org
      }
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Change password (while logged in)
router.post('/change-password', auth, async (req, res) => {
  try {
    // FIX #7: Validate input with Joi
    const { error } = changePasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { currentPassword, newPassword } = req.body;

    const db = getDb();
    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(400).json({ success: false, msg: 'Current password incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db('users').where({ id: req.user.id }).update({ password_hash: hash });

    res.json({ success: true, msg: 'Password changed' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// List org users (admin only)
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const users = await db('users')
      .where({ organization_id: req.user.organization_id })
      .select('id', 'name', 'email', 'role', 'phone', 'created_at');
    res.json({ success: true, users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Add user to org (admin only) — FIX #4: explicit whitelist
router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    // FIX #7: Validate input with Joi
    const { error, value } = addUserSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, msg: error.details[0].message });

    const { name, email, password, role, phone } = value;

    const db = getDb();
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(400).json({ success: false, msg: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [user] = await db('users').insert({
      organization_id: req.user.organization_id,
      name,
      email,
      password_hash: hash,
      role: role || 'viewer',
      phone: phone || ''
    }).returning('id');

    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'users', user.id || user, null, { name, email, role }, req.ip);

    res.status(201).json({ success: true, user: { id: user.id || user, name, email, role } });
  } catch (err) {
    console.error('Add user error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
