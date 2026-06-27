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

    // Update organization details
    if (organization) {
      await db('organizations').where({ id: orgId }).update(organization);
    }

    await auditLog(req.user.id, orgId, 'UPDATE', 'settings', null, null, { settings, organization }, req.ip);

    res.json({ success: true, msg: 'Settings saved' });
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ success: false, msg: 'Failed to save settings' });
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

module.exports = router;
