const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const auditLog = require('../middleware/auditLog');

// Multer for logo uploads — store in memory as buffer (not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG/JPG/WebP allowed'));
  }
});

// Get settings
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const settings = await db('settings')
      .where({ organization_id: req.user.organization_id });
    
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });
    
    res.json({ success: true, settings: settingsMap, organization: org });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Save settings
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const { settings, organization } = req.body;
    const orgId = req.user.organization_id;

    // Save key-value settings
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        await db('settings')
          .where({ organization_id: orgId, key })
          .del();
        await db('settings').insert({ organization_id: orgId, key, value });
      }
    }

    // Update organization details — including SMTP settings
    if (organization) {
      // Only allow valid columns (prevent SQL injection)
      const allowedOrgCols = [
        'name', 'gstin', 'address', 'city', 'state', 'state_code', 'pincode',
        'phone', 'email', 'bank_name', 'account_no', 'ifsc', 'upi_id', 'branch',
        'invoice_prefix', 'quotation_prefix', 'print_letterhead_mm', 'print_footer_mm',
        'invoice_font_family', 'invoice_font_size', 'invoice_desc_size', 'invoice_item_bold',
        'quotation_font_family', 'quotation_font_size', 'app_font_family', 'app_font_size',
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass'
      ];
      const cleanOrg = {};
      for (const col of allowedOrgCols) {
        if (organization[col] !== undefined) cleanOrg[col] = organization[col];
      }
      await db('organizations').where({ id: orgId }).update(cleanOrg);
    }

    await auditLog(req.user.id, orgId, 'UPDATE', 'settings', null, null, { settings, organization }, req.ip);

    res.json({ success: true, msg: 'Settings saved' });
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ success: false, msg: 'Failed to save settings' });
  }
});

// Test Email — verifies SMTP configuration by sending a test email
router.post('/test-email', auth, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const { to } = req.body;
    const testTo = to || org.smtp_user || org.email || process.env.SMTP_USER;
    
    if (!testTo) return res.status(400).json({ success: false, msg: 'No email address provided' });

    // Use org SMTP settings first, fallback to env vars
    const smtpHost = org.smtp_host || process.env.SMTP_HOST;
    const smtpPort = parseInt(org.smtp_port || process.env.SMTP_PORT || '587');
    const smtpUser = org.smtp_user || process.env.SMTP_USER;
    const smtpPass = org.smtp_pass || process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return res.json({ success: false, msg: 'SMTP not configured. Please set Host, User, and Password in Email Settings.' });
    }

    const nodemailer = require('nodemailer');
    const secure = smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 30000,  // 30s to connect
      greetingTimeout: 30000,    // 30s for SMTP greeting
      socketTimeout: 30000       // 30s for data transfer
    });

    // Verify connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `"${org.name || 'Glob ERP'}" <${smtpUser}>`,
      to: testTo,
      subject: `✓ Email Configuration Verified — ${org.name || 'Glob ERP'}`,
      html: `<div style="font-family:Arial;max-width:500px;margin:0 auto;padding:20px;background:#f5f5f5;border-radius:8px">
        <div style="background:#1a1a2e;color:#fff;padding:16px;border-radius:6px 6px 0 0;text-align:center">
          <h2 style="margin:0;font-size:18px">✓ Email Settings Verified!</h2>
        </div>
        <div style="background:#fff;padding:20px;border-radius:0 0 6px 6px">
          <p style="margin:0 0 12px;font-size:14px;color:#333">Great news! Your Gmail SMTP settings are working correctly.</p>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666;font-weight:600">SMTP Host</td><td style="padding:6px 0;color:#333">${smtpHost}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600">SMTP Port</td><td style="padding:6px 0;color:#333">${smtpPort}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600">SMTP User</td><td style="padding:6px 0;color:#333">${smtpUser}</td></tr>
            <tr><td style="padding:6px 0;color:#666;font-weight:600">Organization</td><td style="padding:6px 0;color:#333">${org.name || 'N/A'}</td></tr>
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#999">You can now share invoices and quotations via email directly from the app.</p>
        </div>
      </div>`
    });

    res.json({ success: true, msg: `Test email sent to ${testTo}! Check your inbox.` });
  } catch (err) {
    console.error('Test email error:', err);
    res.json({ success: false, msg: 'Email test failed: ' + (err.message || 'Unknown error. Check your SMTP settings.') });
  }
});

// Upload logo — saves as base64 data URI in database
router.post('/upload/logo', auth, adminOnly, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    const db = getDb();
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ logo_url: dataUri });
    res.json({ success: true, logoUrl: dataUri });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ success: false, msg: 'Upload failed: ' + err.message });
  }
});

// Upload stamp — saves as base64 data URI
router.post('/upload/stamp', auth, adminOnly, upload.single('stamp'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    const db = getDb();
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ stamp_url: dataUri });
    res.json({ success: true, stampUrl: dataUri });
  } catch (err) {
    console.error('Stamp upload error:', err);
    res.status(500).json({ success: false, msg: 'Upload failed' });
  }
});

// Upload signature — saves as base64 data URI
router.post('/upload/signature', auth, adminOnly, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    const db = getDb();
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ signature_url: dataUri });
    res.json({ success: true, signatureUrl: dataUri });
  } catch (err) {
    console.error('Signature upload error:', err);
    res.status(500).json({ success: false, msg: 'Upload failed' });
  }
});

// Delete uploaded image (logo, stamp, or signature)
router.delete('/upload/:field', auth, adminOnly, async (req, res) => {
  try {
    const allowed = ['logo', 'stamp', 'signature'];
    const field = req.params.field;
    if (!allowed.includes(field)) return res.status(400).json({ success: false, msg: 'Invalid field' });
    const db = getDb();
    const column = `${field}_url`;
    await db('organizations').where({ id: req.user.organization_id }).update({ [column]: null });
    res.json({ success: true, msg: `${field} removed` });
  } catch (err) {
    console.error('Delete image error:', err);
    res.status(500).json({ success: false, msg: 'Delete failed' });
  }
});

module.exports = router;
