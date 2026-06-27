const knex = require('knex');
const config = require('../config/env');

let db;

function getDb() {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: config.DATABASE_URL || {
        host: '127.0.0.1',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'glob_erp'
      },
      pool: { min: 2, max: 10 },
      acquireConnectionTimeout: 30000
    });
  }
  return db;
}

module.exports = getDb;
