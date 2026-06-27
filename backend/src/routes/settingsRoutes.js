const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const auditLog = require('../middleware/auditLog');

// Multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOAD_DIR || './uploads'),
  filename: (req, file, cb) => cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE || 2097152 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PNG/JPG allowed'));
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

// Upload logo
router.post('/upload/logo', auth, adminOnly, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file uploaded' });
    
    const db = getDb();
    const logoUrl = `/uploads/${req.file.filename}`;
    await db('organizations').where({ id: req.user.organization_id }).update({ logo_url: logoUrl });
    
    res.json({ success: true, logoUrl });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ success: false, msg: 'Upload failed' });
  }
});

module.exports = router;
