// Clicks through the main daily flows in a real browser against a running backend:
// add customer → create invoice → record part + full payment → check list totals.
//   API=http://localhost:5055 WEB=http://localhost:4173 node e2e/ui-flows.js
const { chromium } = require('playwright');
const API = process.env.API || 'http://localhost:5055';
const WEB = process.env.WEB || 'http://localhost:4173';
const fails = [];
const ok = (cond, label) => { if (!cond) fails.push(label); console.log((cond ? '  ✓ ' : '  ✗ ') + label) };

(async () => {
  const email = `flow${Date.now()}@test.in`;
  const reg = await (await fetch(API + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgName: 'Flow Works', gstin: '27ABCDE1234F1Z5', state: 'Maharashtra', state_code: '27', city: 'Pune', email, password: 'Test@12345', name: 'Flow Admin', phone: '9876543210' }) })).json();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('**/api/**', async route => { const u = new URL(route.request().url()); if (u.origin === API) return route.continue(); try { route.fulfill({ response: await route.fetch({ url: API + u.pathname + u.search }) }) } catch { route.abort() } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  const crashes = []; page.on('pageerror', e => crashes.push(e.message));
  page.on('dialog', d => d.accept());

  // Log in through the real login form
  await page.goto(WEB + '/login');
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', 'Test@12345');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
  ok(page.url().includes('/app'), 'logs in with email + password');

  // Add a customer through the form
  await page.goto(WEB + '/app/customers/new'); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Basic Info' }).click();
  await page.fill('input[placeholder="Sharma Steel Works"]', 'Ravi Transport');
  await page.getByRole('button', { name: 'Contact' }).click();
  await page.fill('input[placeholder="9876543210"]', '9820012345');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  await page.goto(WEB + '/app/customers'); await page.waitForTimeout(2000);
  ok(await page.getByText('Ravi Transport').first().isVisible(), 'new customer appears in the list');

  // Create an invoice through the new form (2 items, Enter adds a row)
  await page.goto(WEB + '/app/invoices/new'); await page.waitForTimeout(2500);
  const custSelect = page.locator('select').first();
  const optVal = await custSelect.locator('option', { hasText: 'Ravi Transport' }).getAttribute('value');
  await custSelect.selectOption(optVal);
  const rows = page.locator('.inv-row:not(.inv-head)');
  await rows.nth(0).locator('input').nth(0).fill('Body building work');
  await rows.nth(0).locator('input[aria-label=Rate]').fill('10000');
  await rows.nth(0).locator('input[aria-label=Rate]').press('Enter');
  await page.waitForTimeout(300);
  ok(await rows.count() === 2, 'Enter in Rate adds a new item row');
  await rows.nth(1).locator('input').nth(0).fill('Paint');
  await rows.nth(1).locator('input[aria-label=Rate]').fill('2000');
  const total = await page.locator('.inv-total b').innerText();
  ok(total.includes('14,160'), `live total is ₹14,160 (shows ${total})`);
  await page.keyboard.press('Control+s');
  await page.waitForURL(/\/app\/invoices$/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  ok(await page.getByText('Ravi Transport').first().isVisible(), 'Ctrl+S saves and the invoice shows in the list');

  // Open it and record payments
  await page.getByText('Ravi Transport').first().click();
  await page.waitForTimeout(3000);
  const panel = page.locator('section', { hasText: 'Balance due' });
  await panel.locator('input[type=number]').fill('5000');
  await panel.getByRole('button', { name: 'Record payment' }).click();
  await page.waitForTimeout(2500);
  ok(await panel.getByText('Partial').first().isVisible(), 'part payment marks the invoice Partial');
  ok((await panel.innerText()).includes('9,160.00'), 'balance due drops to ₹9,160');
  await panel.getByRole('button', { name: 'Record payment' }).click(); // amount pre-filled with balance
  await page.waitForTimeout(2500);
  ok(await panel.getByText('Paid').first().isVisible(), 'paying the balance marks it Paid');

  await page.goto(WEB + '/app/invoices'); await page.waitForTimeout(2000);
  await page.getByRole('tab', { name: /Paid/ }).click();
  ok(await page.getByText('Ravi Transport').first().isVisible(), 'invoice shows under the Paid filter');

  await page.goto(WEB + '/app/dashboard'); await page.waitForTimeout(3000);
  ok(crashes.length === 0, 'no crashes during the flow' + (crashes.length ? ': ' + crashes[0] : ''));
  await browser.close();
  console.log(fails.length ? `❌ ${fails.length} flow checks failed` : '✅ all flow checks passed');
  process.exit(fails.length ? 1 : 0);
})();
