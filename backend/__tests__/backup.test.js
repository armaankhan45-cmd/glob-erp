const zlib = require('zlib');
const backup = require('../src/services/backup');

describe('backup file decoding', () => {
  const snap = { format: backup.FORMAT, tables: { invoices: [{ id: 1 }] }, counts: { invoices: 1 } };
  test('reads a gzipped backup', async () => {
    expect((await backup.decode(zlib.gzipSync(JSON.stringify(snap)))).tables.invoices).toHaveLength(1);
  });
  test('reads a plain JSON backup', async () => {
    expect((await backup.decode(Buffer.from(JSON.stringify(snap)))).format).toBe(backup.FORMAT);
  });
  test.each([['random text', 'hello'], ['other JSON', '{"a":1}']])('rejects %s', async (_, body) => {
    await expect(backup.decode(Buffer.from(body))).rejects.toMatchObject({ status: 400 });
  });
  test('backs up every business table but never users or the audit log', () => {
    const all = [...backup.ORG_TABLES, ...backup.CHILD_TABLES.map(c => c.table)];
    expect(all).toEqual(expect.arrayContaining(['customers', 'invoices', 'invoice_items', 'purchase_bills', 'payments', 'vehicle_papers']));
    expect(all).not.toContain('users');
    expect(all).not.toContain('audit_log');
  });
});
