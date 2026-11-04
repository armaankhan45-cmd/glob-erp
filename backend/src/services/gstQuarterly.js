/**
 * Quarterly GST (QRMP scheme) calculations — one place, used by the GST page AND the Excel export.
 *
 * Indian GST rules applied (CGST Act §49 set-off, QRMP scheme):
 *  - Quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
 *  - Tax liability for the whole quarter is set off against the Input Tax Credit (ITC) ledger:
 *      IGST liability ← IGST, then CGST, then SGST credit
 *      CGST liability ← CGST, then IGST credit
 *      SGST liability ← SGST, then IGST credit
 *    CGST credit can never pay SGST and vice-versa. Unused credit carries forward.
 *  - GSTR-1 (QRMP): due 13th of the month after the quarter.
 *  - GSTR-3B (QRMP): due 22nd (category X states incl. Maharashtra) or 24th (category Y) after the quarter.
 *  - PMT-06: tax for the 1st and 2nd month of each quarter is deposited by the 25th of the next month.
 *    Fixed-sum method = 35% of the cash tax paid in the previous quarter.
 *
 * Credit carry-forward is rolled from two financial years back, so April opens with the real March balance.
 * Figures come from the invoices and purchase bills recorded in the ERP — confirm with your CA before filing.
 */

// States/UTs whose quarterly GSTR-3B is due on the 22nd (everyone else: 24th)
const CATEGORY_X = new Set(['22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37']);

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const num = v => parseFloat(v || 0) || 0;
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`; // m is 1-12, may overflow into next year handled by caller

function nextMonth(y, m) { return m === 12 ? [y + 1, 1] : [y, m + 1]; }

// Set off one quarter's liability against the credit ledger (mutates `led`)
function setOff(led, out, inp) {
  led.c += inp.cgst; led.s += inp.sgst; led.i += inp.igst;
  let due = out.igst, use;
  use = Math.min(led.i, due); led.i -= use; due -= use;
  if (due > 0) { use = Math.min(led.c, due); led.c -= use; due -= use; }
  if (due > 0) { use = Math.min(led.s, due); led.s -= use; due -= use; }
  const payI = due;
  due = out.cgst;
  use = Math.min(led.c, due); led.c -= use; due -= use;
  if (due > 0) { use = Math.min(led.i, due); led.i -= use; due -= use; }
  const payC = due;
  due = out.sgst;
  use = Math.min(led.s, due); led.s -= use; due -= use;
  if (due > 0) { use = Math.min(led.i, due); led.i -= use; due -= use; }
  const payS = due;
  return { cgst: payC, sgst: payS, igst: payI, total: payC + payS + payI };
}

const emptyAgg = () => ({ taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 });
function addAgg(a, b) { a.taxable += b.taxable; a.cgst += b.cgst; a.sgst += b.sgst; a.igst += b.igst; a.total += b.total; a.count += b.count; return a; }
function roundAgg(a) { return { taxable: r2(a.taxable), cgst: r2(a.cgst), sgst: r2(a.sgst), igst: r2(a.igst), total: r2(a.total), count: a.count, gst: r2(a.cgst + a.sgst + a.igst) }; }

/**
 * @param db      knex instance
 * @param orgId   organization id
 * @param year    FINANCIAL YEAR START year (2026 => FY 2026-27, Apr 2026 – Mar 2027)
 * @param today   Date (injectable for tests)
 */
async function computeQuarterly(db, orgId, year, today = new Date()) {
  const org = await db('organizations').where({ id: orgId }).first().catch(() => null) || {};
  const gstin = org.gstin || '';
  const stateCode = (org.state_code || gstin.substring(0, 2) || '27').toString().padStart(2, '0');
  const category = CATEGORY_X.has(stateCode) ? 'X' : 'Y';
  const gstr3bDay = category === 'X' ? 22 : 24;

  const rangeStart = `${year - 2}-04-01`;
  const rangeEnd = `${year + 1}-03-31`;

  const outRows = await db('invoices').where({ organization_id: orgId }).whereBetween('invoice_date', [rangeStart, rangeEnd])
    .select(db.raw("TO_CHAR(invoice_date, 'YYYY-MM') as month"), db.raw('COUNT(*) as cnt'),
      db.raw('COALESCE(SUM(subtotal),0) as taxable'), db.raw('COALESCE(SUM(cgst_amount),0) as cgst'),
      db.raw('COALESCE(SUM(sgst_amount),0) as sgst'), db.raw('COALESCE(SUM(igst_amount),0) as igst'),
      db.raw('COALESCE(SUM(total_amount),0) as total')).groupBy('month');
  const inRows = await db('purchase_bills').where({ organization_id: orgId }).whereBetween('bill_date', [rangeStart, rangeEnd])
    .select(db.raw("TO_CHAR(bill_date, 'YYYY-MM') as month"), db.raw('COUNT(*) as cnt'),
      db.raw('COALESCE(SUM(subtotal),0) as taxable'), db.raw('COALESCE(SUM(cgst_amount),0) as cgst'),
      db.raw('COALESCE(SUM(sgst_amount),0) as sgst'), db.raw('COALESCE(SUM(igst_amount),0) as igst'),
      db.raw('COALESCE(SUM(total_amount),0) as total')).groupBy('month');
  const toAgg = r => r ? { taxable: num(r.taxable), cgst: num(r.cgst), sgst: num(r.sgst), igst: num(r.igst), total: num(r.total), count: parseInt(r.cnt) || 0 } : emptyAgg();
  const outBy = Object.fromEntries(outRows.map(r => [r.month, toAgg(r)]));
  const inBy = Object.fromEntries(inRows.map(r => [r.month, toAgg(r)]));

  const led = { c: 0, s: 0, i: 0 };
  const all = []; // 12 quarters, oldest first
  for (let idx = 0; idx < 12; idx++) {
    const fy = year - 2 + Math.floor(idx / 4);
    const q = idx % 4; // 0..3
    // calendar (year, month) for the 3 months of this quarter
    const startMonth = [4, 7, 10, 1][q];
    const calYear = q === 3 ? fy + 1 : fy;
    const months = [0, 1, 2].map(k => {
      const m = startMonth + k;
      const key = `${calYear}-${pad(m)}`;
      return { key, label: `${MONTH_ABBR[m - 1]} ${calYear}`, out: outBy[key] || emptyAgg(), inp: inBy[key] || emptyAgg(), m };
    });
    const out = emptyAgg(), inp = emptyAgg();
    months.forEach(m => { addAgg(out, m.out); addAgg(inp, m.inp); });
    const opening = led.c + led.s + led.i;
    const openingHeads = { c: led.c, s: led.s, i: led.i };
    const pay = setOff(led, out, inp);
    all.push({ fy, q, calYear, startMonth, months, out, inp, opening, openingHeads, pay, closing: led.c + led.s + led.i, closingHeads: { cgst: led.c, sgst: led.s, igst: led.i } });
  }

  const todayIso = iso(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);

  const quarters = all.slice(8).map((Q, k) => {
    const prev = all[7 + k]; // previous quarter (for fixed-sum PMT-06)
    const endMonth = Q.startMonth + 2;
    const [fy, fm] = nextMonth(Q.calYear, endMonth); // month after quarter end
    const gstr1Due = iso(fy, fm, 13);
    const gstr3bDue = iso(fy, fm, gstr3bDay);
    const quarterEnd = iso(Q.calYear, endMonth, new Date(Date.UTC(Q.calYear, endMonth, 0)).getUTCDate());
    const quarterStart = iso(Q.calYear, Q.startMonth, 1);

    // PMT-06 for the first two months (25th of the following month)
    const fixedSum = r2(prev.pay.total * 0.35);
    // self-assessment estimate: month-by-month set-off using credit already available
    const sim = { ...Q.openingHeads };
    const pmt06 = [0, 1].map(j => {
      const mm = Q.months[j];
      const [py, pm] = nextMonth(Q.calYear, mm.m);
      const est = setOff(sim, mm.out, mm.inp).total;
      const dueDate = iso(py, pm, 25);
      return { month: mm.label, due: dueDate, fixedSum, selfAssessmentEstimate: r2(est), daysLeft: daysBetween(todayIso, dueDate) };
    });

    let status, daysLeft = daysBetween(todayIso, gstr3bDue);
    if (todayIso < quarterStart) status = 'upcoming';
    else if (todayIso <= quarterEnd) status = 'in_progress';
    else if (todayIso <= gstr3bDue) status = 'filing_open';
    else status = 'past_due_date';

    const out = roundAgg(Q.out), inp = roundAgg(Q.inp);
    return {
      quarter: Q.q + 1,
      label: `Q${Q.q + 1}`,
      name: `Q${Q.q + 1} (${MONTH_ABBR[Q.startMonth - 1]}–${MONTH_ABBR[endMonth - 1]} ${Q.calYear})`,
      range: { from: quarterStart, to: quarterEnd },
      months: Q.months.map(m => ({
        monthKey: m.key, label: m.label, sales: roundAgg(m.out), purchases: roundAgg(m.inp),
        outputGST: r2(m.out.cgst + m.out.sgst + m.out.igst), inputGST: r2(m.inp.cgst + m.inp.sgst + m.inp.igst),
      })),
      output: out,
      input: inp,
      openingCredit: r2(Q.opening),
      payable: { cgst: r2(Q.pay.cgst), sgst: r2(Q.pay.sgst), igst: r2(Q.pay.igst), total: r2(Q.pay.total) },
      closingCredit: r2(Q.closing),
      closingHeads: { cgst: r2(Q.closingHeads.cgst), sgst: r2(Q.closingHeads.sgst), igst: r2(Q.closingHeads.igst) },
      due: { gstr1: gstr1Due, gstr3b: gstr3bDue, pmt06 },
      status, daysLeft,
    };
  });

  const sum = (f) => r2(quarters.reduce((s, q) => s + f(q), 0));
  return {
    fy: `${year}-${String(year + 1).slice(2)}`,
    year,
    registration: { gstin, stateCode, category, gstr3bDay, scheme: 'QRMP (quarterly return, monthly payment)' },
    quarters,
    totals: {
      outputGST: sum(q => q.output.gst), inputGST: sum(q => q.input.gst), payable: sum(q => q.payable.total),
      sales: sum(q => q.output.total), purchases: sum(q => q.input.total),
      closingCredit: quarters.length ? quarters[quarters.length - 1].closingCredit : 0,
    },
  };
}

module.exports = { computeQuarterly, CATEGORY_X, setOff };
