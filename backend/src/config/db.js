let _db = null;

function getDb() {
  if (!_db) {
    // Fallback: create own connection
    const knex = require('knex');
    _db = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL,
      pool: { min: 1, max: 5 },
      ssl: { rejectUnauthorized: false }
    });
  }
  return _db;
}

function setDb(dbInstance) {
  _db = dbInstance;
}

module.exports = getDb;
module.exports.setDb = setDb;
module.exports.default = getDb;
