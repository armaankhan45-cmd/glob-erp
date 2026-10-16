#!/usr/bin/env node
'use strict';

// Glob ERP encrypted PostgreSQL backups. Format:
// "GLOBBAK1" (8 bytes) | scrypt salt (16) | AES-GCM IV (12) |
// ciphertext | authentication tag (16). No secret or plaintext in the artifact.
// Usage: pg_dump -Fc ... | BACKUP_ENCRYPTION_KEY=... node scripts/backup-crypto.cjs encrypt backup.enc
//        BACKUP_ENCRYPTION_KEY=... node scripts/backup-crypto.cjs verify backup.enc
//        BACKUP_ENCRYPTION_KEY=... node scripts/backup-crypto.cjs decrypt backup.enc > backup.dump

const fs = require('node:fs');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const MAGIC = Buffer.from('GLOBBAK1');
const HEADER_BYTES = 8 + 16 + 12;
const TAG_BYTES = 16;
const [action, filename] = process.argv.slice(2);
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;

if (!['encrypt', 'decrypt', 'verify'].includes(action) || !filename || !passphrase || passphrase.length < 32) {
  console.error('Usage: BACKUP_ENCRYPTION_KEY=<at least 32 chars> node backup-crypto.cjs encrypt|verify|decrypt <file>');
  process.exit(2);
}

function key(salt) {
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

async function main() {
  if (action === 'encrypt') {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(salt), iv);
    // wx: refuse to overwrite an existing backup; 0600: private to the runner user.
    const fd = fs.openSync(filename, 'wx', 0o600);
    try {
      fs.writeSync(fd, Buffer.concat([MAGIC, salt, iv]));
      await pipeline(process.stdin, cipher, fs.createWriteStream(null, { fd, autoClose: false }));
      fs.writeSync(fd, cipher.getAuthTag());
    } catch (err) {
      try { fs.closeSync(fd); } catch (_) {}
      fs.rmSync(filename, { force: true });
      throw err;
    }
    fs.closeSync(fd);
    return;
  }

  // Authenticating BEFORE writing any plaintext prevents a corrupted or
  // malicious artifact being streamed straight into pg_restore.
  const file = fs.readFileSync(filename);
  if (file.length < HEADER_BYTES + TAG_BYTES || !file.subarray(0, 8).equals(MAGIC)) {
    throw new Error('Not a Glob ERP encrypted backup');
  }
  const salt = file.subarray(8, 24);
  const iv = file.subarray(24, 36);
  const tag = file.subarray(file.length - TAG_BYTES);
  const encrypted = file.subarray(HEADER_BYTES, file.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(salt), iv);
  decipher.setAuthTag(tag);
  // finalize decrypt before any output; wrong key and tampering throw here.
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  if (action === 'decrypt') process.stdout.write(plaintext);
  else console.error(`Encrypted backup verified (${encrypted.length} ciphertext bytes)`);
}

main().catch(() => {
  // No keys, DB URLs, decrypted content or provider responses in logs.
  console.error('Backup encryption/decryption failed. Check key, file and available memory.');
  process.exitCode = 1;
});
