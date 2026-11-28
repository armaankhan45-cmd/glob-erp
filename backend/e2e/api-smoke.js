// End-to-end API smoke test against a running server + real Postgres.
//   API=http://localhost:5055 node e2e/api-smoke.js
// Registers a fresh org, runs core business flows, then calls every
// parameter-free GET route and reports anything that is not 2xx.
const path = require('path'), fs = require('fs');
const API = process.env.API || 'http://localhost:5055';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x';
const fails = [];
let token = '';
const call = async (method, url, body, expect = [200, 201]) => {
  const r = await fetch(API + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text) } catch { json = text }
  if (!expect.includes(r.status)) fails.push(`${method} ${url} → ${r.status} ${typeof json === 'object' ? (json.msg || json.error || JSON.stringify(json).slice(0, 160)) : String(json).slice(0, 160)}`);
  return json;
};
(async () => {
  const email = `e2e${Date.now()}@test.in`;
  const reg = await call('POST', '/auth/register', { orgName: 'E2E Fabricators', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', state_code: '27', city: 'Pune', email, password: 'Test@12345', name: 'E2E Admin', phone: '9876543210' });
  token = reg.token || (await call('POST', '/auth/login', { email, password: 'Test@12345' })).token;
  if (!token) { console.log('Cannot log in:', fails); process.exit(1) }

  // Core flows
  const cust = await call('POST', '/customers', { name: 'Sharma Motors', gstin: '27AAACS1234A1Z5', city: 'Pune', state: 'Maharashtra', state_code: '27', phone: '9820000000' });
  const custId = cust.customer?.id || cust.id;
  const cust2 = await call('POST', '/customers', { name: 'Delhi Traders', gstin: '07AAACD1234A1Z5', state: 'Delhi', state_code: '07' });
  const inv = await call('POST', '/invoices', { invoice_number: '26270001', customer_id: custId, invoice_date: '2026-07-15', due_date: '2026-08-15', subtotal: 100000, cgst_amount: 9000, sgst_amount: 9000, igst_amount: 0, total_amount: 118000, payment_status: 'Unpaid', status: 'Sent',
    items: [{ description: 'MS fabrication', hsn_code: '7308', quantity: 2, unit: 'NOS', rate: 50000, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 100000 }] });
  const invId = inv.invoice?.id || inv.id;
  await call('POST', '/invoices', { invoice_date: 'not-a-date', items: [] }, [400]);
  await call('POST', '/invoices', { invoice_date: '2026-07-15', customer_id: 999999, items: [] }, [400]);
  await call('POST', '/purchases', { bill_number: 'B-1', supplier_name: 'Tata Steel', supplier_gstin: '27AAACT1234A1Z5', bill_date: '2026-07-10', subtotal: 40000, cgst_amount: 3600, sgst_amount: 3600, igst_amount: 0, total_amount: 47200, payment_status: 'Unpaid',
    items: [{ description: 'MS sheet', hsn_code: '7208', quantity: 10, unit: 'PCS', rate: 4000, amount: 40000 }] });
  const quo = await call('POST', '/quotations', { customer_id: custId, quotation_date: '2026-07-01', subtotal: 50000, total_amount: 59000, items: [{ description: 'Tank', quantity: 1, rate: 50000, amount: 50000 }] });
  const quoId = quo.quotation?.id || quo.id;
  if (invId) {
    await call('GET', `/invoices/${invId}`);
    await call('POST', '/payments', { invoice_id: invId, customer_id: custId, amount: 50000, payment_date: '2026-07-20', payment_mode: 'NEFT' });
  }
  if (quoId) { await call('GET', `/quotations/${quoId}`); await call('POST', `/quotations/${quoId}/duplicate`) }
  if (custId) await call('GET', `/customers/${custId}`);
  await call('POST', '/expenses', { category: 'Electricity', amount: 5000, expense_date: '2026-07-05', description: 'MSEB' });

  // Business results must add up
  const check = (label, got, want) => { if (got !== want) fails.push(`${label}: expected ${want}, got ${got}`) };
  if (invId) {
    const after = await call('GET', `/invoices/${invId}`);
    const i = after.invoice || after;
    check('invoice status after part payment', i.payment_status, 'Partial');
    const list = await call('GET', '/invoices');
    check('amount_paid on invoice list', Number((list.invoices || []).find(x => x.id === invId)?.amount_paid), 50000);
    const pay2 = await call('POST', '/payments', { invoice_id: invId, amount: 68000, payment_mode: 'UPI' });
    check('invoice status after full payment', pay2.invoice?.payment_status, 'Paid');
    const pays = await call('GET', `/payments?invoice_id=${invId}`);
    check('payments listed for invoice', (pays.payments || []).length, 2);
    const del = await call('DELETE', `/payments/${pays.payments?.[0]?.id}`);
    check('status after deleting a payment', del.invoice?.payment_status, 'Partial');
    await call('POST', '/payments', { invoice_id: invId, amount: 0 }, [400]);
  }
  const gq = await call('GET', '/gst/quarterly?year=2026');
  const q2 = (gq.quarters || [])[1] || {};
  check('Q2 output GST', q2.output?.gst, 18000);
  check('Q2 input GST', q2.input?.gst, 7200);
  check('Q2 GST payable', q2.payable?.total, 10800);
  const dash = await call('GET', '/dashboard/stats?period=month&month=2026-07');
  check('July revenue on dashboard', Number(dash.stats?.totalRevenue), 118000);
  const ageing = await call('GET', '/reports/ageing');
  check('ageing has the unpaid invoice', Object.values(ageing.buckets || {}).flat().length, 1);

  // Backups: take one, damage data, restore, data comes back
  const bk = await call('POST', '/backups', { note: 'e2e' });
  check('backup captured the invoice', bk.backup?.counts?.invoices, 1);
  const before = (await call('GET', '/customers')).customers?.length;
  if (custId) { await call('DELETE', `/customers/${cust2.customer?.id || cust2.id}`) }
  await call('DELETE', `/invoices/${invId}`);
  const rs = await call('POST', `/backups/${bk.backup?.id}/restore`);
  check('restore brought invoices back', rs.restored?.invoices, 1);
  check('restore brought invoice items back', rs.restored?.invoice_items, 1);
  check('customers after restore', (await call('GET', '/customers')).customers?.length, before);
  const back = await call('GET', `/invoices/${invId}`);
  check('restored invoice keeps its items', (back.items || back.invoice?.items || []).length, 1);
  const list2 = await call('GET', '/backups');
  check('a safety copy is taken before restoring', (list2.backups || []).some(b => b.kind === 'pre-restore'), true);
  const dl = await fetch(API + `/api/backups/${bk.backup?.id}/download`, { headers: { Authorization: 'Bearer ' + token } });
  const file = Buffer.from(await dl.arrayBuffer());
  check('download is a gzip file', file[0] === 0x1f && file[1] === 0x8b, true);
  const up = await fetch(API + '/api/backups/restore-file', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/gzip' }, body: file });
  check('restore from an uploaded file works', up.status, 200);
  const bad = await fetch(API + '/api/backups/restore-file', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' }, body: 'hello' });
  check('a non-backup file is rejected', bad.status, 400);
  const fresh = await call('POST', '/customers', { name: 'After Restore Co' });
  check('new records still save after restore', !!(fresh.customer?.id || fresh.id), true);

  // Every parameter-free GET route
  const routesDir = path.join(__dirname, '../src/routes');
  const mounts = [...fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf8').matchAll(/app\.use\('(\/api\/[^']+)', safe\('\.\/routes\/(\w+)'\)\)/g)];
  const skip = /\/(test|stream|backup|deploy|restore|selfheal|diagnose)/i;
  for (const [, mount, file] of mounts) {
    const router = require(path.join(routesDir, file));
    for (const layer of router.stack.filter(l => l.route && l.route.methods.get && !l.route.path.includes(':'))) {
      const url = mount.replace('/api', '') + (layer.route.path === '/' ? '' : layer.route.path);
      if (skip.test(url)) continue;
      await call('GET', url + (url.includes('/gst') || url.includes('/reports') ? '?month=2026-07&year=2026' : ''));
    }
  }
  console.log(fails.length ? `❌ ${fails.length} failures\n` + fails.join('\n') : '✅ all API checks passed');
  process.exit(fails.length ? 1 : 0);
})();
