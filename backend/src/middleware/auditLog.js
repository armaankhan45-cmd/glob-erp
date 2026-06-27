const getDb = require('../config/db');

async function auditLog(userId, orgId, action, tableName, recordId, oldValue, newValue, ip) {
  try {
    const db = getDb();
    await db('audit_log').insert({
      user_id: userId,
      organization_id: orgId,
      action,
      table_name: tableName,
      record_id: recordId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: ip
    });
  } catch (err) {
    // Never let audit logging crash the app
    console.error('Audit log error:', err.message);
  }
}

module.exports = auditLog;
