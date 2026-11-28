// Opens every page of the built frontend against a running backend and
// reports console errors, crashes and failed API calls.
//   API=http://localhost:5055 WEB=http://localhost:4173 node e2e/ui-crawl.js
const { chromium } = require('playwright');
const API = process.env.API || 'http://localhost:5055';
const WEB = process.env.WEB || 'http://localhost:4173';
const j = async (method, url, token, body) => (await fetch(API + '/api' + url, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) })).json();

(async () => {
  const email = `ui${Date.now()}@test.in`;
  const reg = await j('POST', '/auth/register', null, { orgName: 'UI Test Works', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', state_code: '27', city: 'Pune', email, password: 'Test@12345', name: 'UI Admin', phone: '9876543210' });
  const { token, user } = reg.token ? reg : await j('POST', '/auth/login', null, { email, password: 'Test@12345' });
  const c = await j('POST', '/customers', token, { name: 'Sharma Motors', gstin: '27AAACS1234A1Z5', city: 'Pune', state_code: '27' });
  const custId = c.customer?.id || c.id;
  const inv = await j('POST', '/invoices', token, { invoice_number: '26270001', customer_id: custId, invoice_date: '2026-07-15', subtotal: 1000, cgst_amount: 90, sgst_amount: 90, total_amount: 1180, items: [{ description: 'Work', quantity: 1, rate: 1000, amount: 1000, cgst_rate: 9, sgst_rate: 9 }] });
  const pur = await j('POST', '/purchases', token, { bill_number: 'B1', supplier_name: 'Tata', bill_date: '2026-07-10', subtotal: 500, total_amount: 590, items: [{ description: 'Sheet', quantity: 1, rate: 500, amount: 500 }] });
  const quo = await j('POST', '/quotations', token, { customer_id: custId, quotation_date: '2026-07-01', total_amount: 590, items: [{ description: 'Tank', quantity: 1, rate: 500, amount: 500 }] });
  const ids = { inv: inv.invoice?.id || inv.id, pur: pur.purchase?.id || pur.id, quo: quo.quotation?.id || quo.id };

  const pages = ['dashboard', 'invoices', 'invoices/new', `invoices/${ids.inv}`, `invoices/${ids.inv}/edit`, 'quotations', 'quotations/new', `quotations/${ids.quo}`, `quotations/${ids.quo}/edit`,
    'customers', 'customers/new', `customers/${custId}`, `customers/${custId}/edit`, 'purchases', 'purchases/new', `purchases/${ids.pur}`, `purchases/${ids.pur}/edit`,
    'vehicle-papers', 'vehicle-papers/new/money_receipt', 'gst', 'reports', 'ai-assistant', 'settings', 'settings?tab=backups', 'fonts', 'export', 'deploy', 'diagnostics', 'audit'];

  const browser = await chromium.launch();
  const problems = []; let apiCalls = 0, opened = 0;
  for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
    await ctx.route('**/api/**', async route => {
      const u = new URL(route.request().url());
      if (u.origin === API) return route.continue();
      try { route.fulfill({ response: await route.fetch({ url: API + u.pathname + u.search }) }) } catch { route.abort() }
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await ctx.addInitScript(([t, u, m]) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify(u)); localStorage.setItem('glob-mode-v3', m) }, [token, user, mode]);
    for (const pg of (mode === 'light' ? pages : pages.slice(0, 6))) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('CRASH ' + e.message.slice(0, 180)));
      page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_FAILED|net::/.test(m.text())) errs.push('console ' + m.text().slice(0, 180)) });
      page.on('response', r => { if (r.url().includes('/api/')) apiCalls++; if (r.url().includes('/api/') && r.status() >= 400) errs.push(`API ${r.status()} ${new URL(r.url()).pathname}`) });
      await page.goto(`${WEB}/app/${pg}`, { waitUntil: 'load', timeout: 20000 }).catch(e => errs.push('nav ' + e.message.slice(0, 80)));
      await page.waitForTimeout(2500);
      const text = (await page.locator('main').innerText().catch(() => '')).trim();
      if (text.length < 20) errs.push('blank page');
      if (/Something went wrong|Route failed to load/i.test(text)) errs.push('error screen shown');
      opened++;
      if (errs.length) problems.push(`[${mode}] /app/${pg}\n   ` + [...new Set(errs)].join('\n   '));
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? `❌ ${problems.length} pages with problems\n` + problems.join('\n') : `✅ all ${opened} page loads clean (${apiCalls} API calls)`);
  process.exit(problems.length ? 1 : 0);
})();
