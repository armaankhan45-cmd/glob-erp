const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');
const backup = require('../services/backup');

const fail = (res, err, msg) => {
  if (err.status) return res.status(err.status).json({ success: false, msg: err.message });
  console.error(msg, err);
  res.status(500).json({ success: false, msg });
};

// List backups (newest first)
router.get('/', auth, adminOnly, async (req, res) => {
  try { res.json({ success: true, backups: await backup.listBackups(getDb(), req.user.organization_id) }); }
  catch (err) { fail(res, err, 'Could not list backups'); }
});

// Take a backup now
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const b = await backup.createBackup(getDb(), req.user.organization_id, { kind: 'manual', note: (req.body?.note || '').slice(0, 200) || null, userId: req.user.id });
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'backups', b.id, null, { row_count: b.row_count }, req.ip);
    res.status(201).json({ success: true, backup: b });
  } catch (err) { fail(res, err, 'Backup failed'); }
});

// Download a backup file (.json.gz)
router.get('/:id/download', auth, adminOnly, async (req, res) => {
  try {
    const b = await backup.readBackup(getDb(), req.user.organization_id, req.params.id);
    if (!b) return res.status(404).json({ success: false, msg: 'Backup not found' });
    const stamp = new Date(b.created_at).toISOString().slice(0, 16).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="glob-erp-backup-${stamp}.json.gz"`);
    res.send(b.data);
  } catch (err) { fail(res, err, 'Download failed'); }
});

// Restore from a stored backup
router.post('/:id/restore', auth, adminOnly, async (req, res) => {
  try {
    const db = getDb();
    const b = await backup.readBackup(db, req.user.organization_id, req.params.id);
    if (!b) return res.status(404).json({ success: false, msg: 'Backup not found' });
    const snap = await backup.decode(b.data);
    const result = await backup.restore(db, req.user.organization_id, snap, { userId: req.user.id });
    await auditLog(req.user.id, req.user.organization_id, 'RESTORE', 'backups', b.id, null, result.restored, req.ip);
    res.json({ success: true, ...result });
  } catch (err) { fail(res, err, 'Restore failed — nothing was changed'); }
});

// Restore from an uploaded backup file (raw body, up to 50 MB)
router.post('/restore-file', auth, adminOnly, express.raw({ type: () => true, limit: '50mb' }), async (req, res) => {
  try {
    if (!req.body?.length) return res.status(400).json({ success: false, msg: 'Choose a backup file' });
    const snap = await backup.decode(req.body);
    const result = await backup.restore(getDb(), req.user.organization_id, snap, { userId: req.user.id });
    await auditLog(req.user.id, req.user.organization_id, 'RESTORE', 'backups', null, null, result.restored, req.ip);
    res.json({ success: true, ...result });
  } catch (err) { fail(res, err, 'Restore failed — nothing was changed'); }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const n = await getDb()('backups').where({ id: req.params.id, organization_id: req.user.organization_id }).del();
    if (!n) return res.status(404).json({ success: false, msg: 'Backup not found' });
    res.json({ success: true });
  } catch (err) { fail(res, err, 'Delete failed'); }
});

module.exports = router;
