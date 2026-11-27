const { computeQuarterly, setOff } = require('../src/services/gstQuarterly');
const { fakeDb } = require('./helpers/fakeDb');

const row = (month, cgst, sgst, igst = 0, taxable = 1000) => ({
  month, cnt: 1, taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst,
});

describe('setOff (ITC set-off order)', () => {
  test('IGST credit is used for IGST first, then CGST, then SGST', () => {
    const led = { c: 0, s: 0, i: 0 };
    const pay = setOff(led, { cgst: 100, sgst: 100, igst: 50 }, { cgst: 0, sgst: 0, igst: 200 });
    // 200 IGST credit → 50 to IGST, 100 to CGST, last 50 to SGST; 50 SGST paid in cash
    expect(pay).toEqual({ cgst: 0, sgst: 50, igst: 0, total: 50 });
    expect(led.i).toBe(0);
  });

  test('pays the shortfall in cash and never goes negative', () => {
    const led = { c: 0, s: 0, i: 0 };
    const pay = setOff(led, { cgst: 90, sgst: 90, igst: 0 }, { cgst: 40, sgst: 40, igst: 0 });
    expect(pay).toEqual({ cgst: 50, sgst: 50, igst: 0, total: 100 });
    expect(led).toEqual({ c: 0, s: 0, i: 0 });
  });

  test('excess credit carries forward', () => {
    const led = { c: 0, s: 0, i: 0 };
    setOff(led, { cgst: 10, sgst: 10, igst: 0 }, { cgst: 30, sgst: 30, igst: 0 });
    expect(led).toEqual({ c: 20, s: 20, i: 0 });
  });
});

describe('computeQuarterly', () => {
  const today = new Date('2026-11-27');
  const db = fakeDb({
    organizations: [{ id: 1, gstin: '27ABCDE1234F1Z5', state_code: '27' }],
    invoices: [row('2026-04', 90, 90), row('2026-07', 90, 90), row('2026-08', 45, 45)],
    purchase_bills: [row('2026-05', 30, 30), row('2026-07', 200, 200)],
  });

  test('returns 4 quarters for the financial year, Apr–Mar', async () => {
    const r = await computeQuarterly(db, 1, 2026, today);
    expect(r.fy).toBe('2026-27');
    expect(r.quarters.map(q => q.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(r.quarters[0].range).toEqual({ from: '2026-04-01', to: '2026-06-30' });
    expect(r.quarters[3].range.to).toBe('2027-03-31');
  });

  test('buckets months into the right quarter and nets ITC', async () => {
    const [q1, q2] = (await computeQuarterly(db, 1, 2026, today)).quarters;
    expect(q1.output.gst).toBe(180);
    expect(q1.input.gst).toBe(60);
    expect(q1.payable.total).toBe(120);
    // Q2: output 270, input 400 → nothing payable, 130 credit carried forward
    expect(q2.output.gst).toBe(270);
    expect(q2.payable.total).toBe(0);
    expect(q2.closingCredit).toBe(130);
  });

  test('Maharashtra (27) gets the 22nd GSTR-3B due date', async () => {
    const r = await computeQuarterly(db, 1, 2026, today);
    expect(r.registration.gstr3bDay).toBe(22);
    expect(r.quarters[0].due.gstr3b).toBe('2026-07-22');
  });

  test('empty organisation returns zeros, not errors', async () => {
    const r = await computeQuarterly(fakeDb({}), 99, 2026, today);
    expect(r.totals.payable).toBe(0);
    expect(r.quarters).toHaveLength(4);
  });
});
