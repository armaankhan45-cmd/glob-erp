// Minimal knex stand-in: db(table) returns a chainable query that resolves to
// the rows supplied for that table. Enough for pure computation services.
function fakeDb(tables = {}) {
  const db = (table) => {
    const q = {
      where: () => q, whereBetween: () => q, whereNull: () => q, whereNotNull: () => q,
      select: () => q, groupBy: () => q, orderBy: () => q, sum: () => q, count: () => q,
      first: () => Promise.resolve((tables[table] || [])[0]),
      then: (res, rej) => Promise.resolve(tables[table] || []).then(res, rej),
      catch: (rej) => Promise.resolve(tables[table] || []).catch(rej),
    };
    return q;
  };
  db.raw = (sql) => sql;
  return db;
}
module.exports = { fakeDb };
