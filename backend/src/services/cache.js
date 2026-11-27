// Tiny in-memory TTL cache, scoped per organisation. Used for expensive
// read-only aggregates (dashboard stats). Any write by an org clears its entries.
const store = new Map();

function get(orgId, key) {
  const hit = store.get(`${orgId}:${key}`);
  if (!hit) return undefined;
  if (Date.now() > hit.exp) { store.delete(`${orgId}:${key}`); return undefined; }
  return hit.value;
}
function set(orgId, key, value, ttlMs = 30000) {
  store.set(`${orgId}:${key}`, { value, exp: Date.now() + ttlMs });
  if (store.size > 2000) store.delete(store.keys().next().value);
}
function bust(orgId) {
  const prefix = `${orgId}:`;
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
// Express middleware: after any successful write, clear that org's cache.
function bustOnWrite(req, res, next) {
  if (req.method !== 'GET') res.on('finish', () => { if (res.statusCode < 400 && req.user?.organization_id) bust(req.user.organization_id); });
  next();
}
module.exports = { get, set, bust, bustOnWrite };
