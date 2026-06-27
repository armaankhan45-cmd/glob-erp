const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const getDb = require('../config/db');
const config = require('../config/env');
const { auth, adminOnly } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// Register - creates organization + admin user
router.post('/register', async (req, res) => {
  try {
    const { orgName, gstin, address, city, state, state_code, pincode, phone, email, password, name } = req.body;
    if (!orgName || !email || !password || !name) {
      return res.status(400).json({ success: false, msg: 'Organization name, admin name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, msg: 'Password must be at least 6 characters' });
    }

    const db = getDb();

    // Check if email exists
    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(400).json({ success: false, msg: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);

    // Create organization
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

    // Create admin user
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
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, msg: 'Email and password required' });
    }

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
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, msg: 'Email required' });

    const db = getDb();
    const user = await db('users').where({ email }).first();
    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true, msg: 'If email exists, OTP has been sent' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
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

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const db = getDb();
    const user = await db('users').where({ email, reset_otp: otp }).first();
    if (!user || !user.reset_expires || user.reset_expires < Date.now()) {
      return res.status(400).json({ success: false, msg: 'Invalid or expired OTP' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await db('users').where({ id: user.id }).update({ reset_otp: null });

    res.json({ success: true, resetToken, userId: user.id });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, msg: 'Verification failed' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, msg: 'Invalid input' });
    }

    const db = getDb();
    const hash = await bcrypt.hash(newPassword, 12);
    await db('users').where({ id: userId }).update({
      password_hash: hash,
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

// Change password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, msg: 'Invalid input' });
    }

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

// Add user to org (admin only)
router.post('/users', auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, msg: 'Name, email, password required' });
    }

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
