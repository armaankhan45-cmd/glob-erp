/**
 * Migration 002: Add reset_token and reset_token_expires columns to users table
 * FIX #1: Password reset now requires a hashed token (not just userId)
 */
exports.up = async function(knex) {
  const hasResetToken = await knex.schema.hasColumn('users', 'reset_token');
  const hasResetTokenExpires = await knex.schema.hasColumn('users', 'reset_token_expires');

  if (!hasResetToken || !hasResetTokenExpires) {
    await knex.schema.table('users', (table) => {
      if (!hasResetToken) table.string('reset_token', 128).nullable();
      if (!hasResetTokenExpires) table.bigint('reset_token_expires').nullable();
    });
    console.log('✅ Added reset_token and reset_token_expires columns to users table');
  } else {
    console.log('ℹ️ reset_token columns already exist in users table');
  }
};

exports.down = async function(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('reset_token');
    table.dropColumn('reset_token_expires');
  });
};
