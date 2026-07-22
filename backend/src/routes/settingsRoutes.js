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

// ═══════════════════════════════════════════════════════════════
// SMART EMAIL SENDER — Uses Resend API (HTTPS) on Render free tier
// Falls back to SMTP (nodemailer) when SMTP is available (local/VPS)
// ═══════════════════════════════════════════════════════════════
async function sendEmail({ to, fromName, fromEmail, subject, html, attachments }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // ── Priority 1: Resend API (HTTPS) — works on Render free tier ──
  if (RESEND_API_KEY) {
    console.log('📧 Sending via Resend API (HTTPS)...');
    try {
      const payload = {
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html
      };
      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        payload.attachments = attachments.map(a => ({
          filename: a.filename,
          content: typeof a.content === 'string' ? a.content : Buffer.from(a.content).toString('base64'),
          type: a.contentType || 'text/html'
        }));
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.id) {
        console.log('✅ Email sent via Resend! ID:', data.id);
        return { success: true, method: 'resend', id: data.id };
      } else {
        console.error('❌ Resend API error:', data);
        throw new Error(data.message || 'Resend API failed');
      }
    } catch (resendErr) {
      console.error('Resend failed:', resendErr.message);
      // Try SMTP fallback
    }
  }

  // ── Priority 2: SMTP via nodemailer — works on local/VPS/paid Render ──
  const db = getDb();
  const org = await db('organizations').where({ id: 1 }).first();
  const smtpHost = org?.smtp_host || process.env.SMTP_HOST;
  const smtpPort = parseInt(org?.smtp_port || process.env.SMTP_PORT || '587');
  const smtpUser = org?.smtp_user || process.env.SMTP_USER;
  const smtpPass = org?.smtp_pass || process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    console.log('📧 Sending via SMTP (nodemailer)...');
    try {
      const nodemailer = require('nodemailer');
      const secure = smtpPort === 465;
      const transporter = nodemailer.createTransport({
        host: smtpHost, port: smtpPort, secure,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 15000
      });
      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to, subject, html, attachments: attachments || []
      });
      console.log('✅ Email sent via SMTP!');
      return { success: true, method: 'smtp' };
    } catch (smtpErr) {
      console.error('SMTP failed:', smtpErr.message);
      // Both methods failed
      if (!RESEND_API_KEY) {
        return { success: false, msg: `SMTP failed: ${smtpErr.message}. On Render free tier, SMTP is BLOCKED. Set RESEND_API_KEY env var to use Resend email API (free, 3000/month).` };
      }
      return { success: false, msg: `Both Resend and SMTP failed. Resend: (no key). SMTP: ${smtpErr.message}` };
    }
  }

  // ── No email service configured ──
  const hint = RESEND_API_KEY ? 'Check your Resend API key.' : 'Set RESEND_API_KEY env var on Render for free email sending (3000/month). On Render free tier, SMTP ports are blocked since Sept 2025.';
  return { success: false, msg: `No email service configured. ${hint}` };
}

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

    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        await db('settings').where({ organization_id: orgId, key }).del();
        await db('settings').insert({ organization_id: orgId, key, value });
      }
    }

    if (organization) {
      const allowedOrgCols = [
        'name', 'gstin', 'address', 'city', 'state', 'state_code', 'pincode',
        'phone', 'email', 'bank_name', 'account_no', 'ifsc', 'upi_id', 'branch',
        'invoice_prefix', 'quotation_prefix', 'print_letterhead_mm', 'print_footer_mm',
        'invoice_font_family', 'invoice_font_size', 'invoice_desc_size', 'invoice_item_bold',
        'quotation_font_family', 'quotation_font_size', 'app_font_family', 'app_font_size',
        'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
        'resend_api_key'
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

// ═══ Test Email — tries Resend first, then SMTP ═══
router.post('/test-email', auth, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const { to } = req.body;
    const testTo = to || org.smtp_user || org.email || process.env.SMTP_USER;
    
    if (!testTo) return res.status(400).json({ success: false, msg: 'No email address provided' });

    const result = await sendEmail({
      to: testTo,
      fromName: org.name || 'Glob ERP',
      fromEmail: org.email || 'onboarding@resend.dev',
      subject: `✓ Email Verified — ${org.name || 'Glob ERP'}`,
      html: `<div style="font-family:Arial;max-width:500px;margin:0 auto;padding:20px;background:#f5f5f5;border-radius:8px">
        <div style="background:#1a1a2e;color:#fff;padding:16px;border-radius:6px 6px 0 0;text-align:center">
          <h2 style="margin:0;font-size:18px">✓ Email Settings Verified!</h2>
        </div>
        <div style="background:#fff;padding:20px;border-radius:0 0 6px 6px">
          <p style="margin:0 0 12px;font-size:14px;color:#333">Great news! Your email settings are working correctly.</p>
          <p style="margin:0 0 8px;font-size:13px;color:#333"><strong>Organization:</strong> ${org.name || 'N/A'}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#333"><strong>Method:</strong> ${result.method === 'resend' ? 'Resend API (HTTPS)' : 'SMTP (Gmail)'}</p>
          <p style="margin:12px 0 0;font-size:12px;color:#999">You can now share invoices and quotations via email directly from the app.</p>
        </div>
      </div>`
    });

    if (result.success) {
      res.json({ success: true, msg: `Test email sent to ${testTo} via ${result.method}! Check your inbox.`, method: result.method });
    } else {
      res.json({ success: false, msg: result.msg });
    }
  } catch (err) {
    console.error('Test email error:', err);
    res.json({ success: false, msg: 'Email test failed: ' + (err.message || 'Unknown error') });
  }
});

// ═══ Check email config status ═══
router.get('/email-status', auth, async (req, res) => {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const db = getDb();
    const org = await db('organizations').where({ id: req.user.organization_id }).first();
    const hasSMTP = org.smtp_host && org.smtp_user && org.smtp_pass;
    res.json({
      success: true,
      emailConfigured: !!RESEND_API_KEY || hasSMTP,
      resendAvailable: !!RESEND_API_KEY,
      smtpAvailable: hasSMTP,
      recommended: RESEND_API_KEY ? 'resend' : (hasSMTP ? 'smtp' : 'none'),
      note: RESEND_API_KEY ? 'Resend API active — works on Render free tier via HTTPS' : (hasSMTP ? 'SMTP configured — may not work on Render free tier (SMTP blocked)' : 'No email service configured. Set RESEND_API_KEY env var for free email (3000/month)')
    });
  } catch (err) {
    res.json({ success: false, msg: err.message });
  }
});

// Upload logo
router.post('/upload/logo', auth, adminOnly, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    const db = getDb();
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ logo_url: dataUri });
    res.json({ success: true, logoUrl: dataUri });
  } catch (err) { res.status(500).json({ success: false, msg: 'Upload failed: ' + err.message }); }
});

// Upload stamp
router.post('/upload/stamp', auth, adminOnly, upload.single('stamp'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    const db = getDb();
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ stamp_url: dataUri });
    res.json({ success: true, stampUrl: dataUri });
  } catch (err) { res.status(500).json({ success: false, msg: 'Upload failed' }); }
});

// Upload signature
router.post('/upload/signature', auth, adminOnly, upload.single('signature'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    const db = getDb();
    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ signature_url: dataUri });
    res.json({ success: true, signatureUrl: dataUri });
  } catch (err) { res.status(500).json({ success: false, msg: 'Upload failed' }); }
});

// Delete uploaded image
router.delete('/upload/:field', auth, adminOnly, async (req, res) => {
  try {
    const allowed = ['logo', 'stamp', 'signature'];
    const field = req.params.field;
    if (!allowed.includes(field)) return res.status(400).json({ success: false, msg: 'Invalid field' });
    const db = getDb();
    const column = `${field}_url`;
    await db('organizations').where({ id: req.user.organization_id }).update({ [column]: null });
    res.json({ success: true, msg: `${field} removed` });
  } catch (err) { res.status(500).json({ success: false, msg: 'Delete failed' }); }
});

module.exports = { router, sendEmail };
