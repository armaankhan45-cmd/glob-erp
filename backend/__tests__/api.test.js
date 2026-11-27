const express = require('express');
const request = require('supertest');
const { validate } = require('../src/middleware/validate');
const cache = require('../src/services/cache');

const appFor = (name, opts) => {
  const app = express(); app.use(express.json());
  app.post('/x', validate(name, opts), (req, res) => res.json({ success: true }));
  return app;
};

describe('request validation', () => {
  test('invoice needs a date', async () => {
    const r = await request(appFor('invoice')).post('/x').send({ items: [] });
    expect(r.status).toBe(400);
    expect(r.body.msg).toMatch(/date/i);
  });
  test('rejects negative item rate and quantity', async () => {
    const r = await request(appFor('invoice')).post('/x').send({ invoice_date: '2026-11-01', items: [{ rate: -5, quantity: -1 }] });
    expect(r.status).toBe(400);
    expect(r.body.errors.map(e => e.field)).toEqual(expect.arrayContaining(['items.0.rate', 'items.0.quantity']));
  });
  test('accepts a normal invoice with extra fields', async () => {
    const r = await request(appFor('invoice')).post('/x').send({ invoice_date: '2026-11-01', notes: 'hi', items: [{ rate: 100, quantity: 2, gst_rate: 18, description: 'Body work' }] });
    expect(r.status).toBe(200);
  });
  test('customer GSTIN format is checked; blank is fine', async () => {
    const bad = await request(appFor('customer')).post('/x').send({ name: 'A', gstin: '27ABC' });
    expect(bad.status).toBe(400);
    const ok = await request(appFor('customer')).post('/x').send({ name: 'A', gstin: '27abcde1234f1z5' });
    expect(ok.status).toBe(200);
    const blank = await request(appFor('customer')).post('/x').send({ name: 'A', gstin: '' });
    expect(blank.status).toBe(200);
  });
  test('customer update can omit the name', async () => {
    const r = await request(appFor('customer', { partial: true })).post('/x').send({ phone: '9876543210' });
    expect(r.status).toBe(200);
  });
});

describe('org cache', () => {
  test('stores per org and clears on bust', () => {
    cache.set(1, 'k', { a: 1 }); cache.set(2, 'k', { b: 2 });
    expect(cache.get(1, 'k')).toEqual({ a: 1 });
    cache.bust(1);
    expect(cache.get(1, 'k')).toBeUndefined();
    expect(cache.get(2, 'k')).toEqual({ b: 2 });
  });
  test('expires after ttl', () => {
    cache.set(3, 'k', 1, -1);
    expect(cache.get(3, 'k')).toBeUndefined();
  });
});
