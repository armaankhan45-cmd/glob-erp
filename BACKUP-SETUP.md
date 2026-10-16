# Glob ERP — encrypted database backups

> **Not active until you commit the workflow AND configure both GitHub Actions secrets.**
> The workflow is scheduled daily around **08:45 IST** (GitHub may delay scheduled jobs).
> Backups are encrypted, checked, and retained as GitHub Actions artifacts for **14 days**.

## 1. Create the two GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Value |
| --- | --- |
| `BACKUP_DATABASE_URL` | Your database provider's **externally reachable** PostgreSQL connection string, with SSL parameters as required by the provider. An internal Render-only hostname will not work on GitHub's runner. Prefer a dedicated read-only backup account with access to all ERP tables. |
| `BACKUP_ENCRYPTION_KEY` | A unique, randomly generated passphrase of at least 32 characters. Generate locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Store a copy in a password manager **outside GitHub**; losing it makes every artifact unrecoverable. |

Never commit the DB URL, passphrase, unencrypted dump, or decrypted SQL to the repository. Do not put them in Vercel `VITE_*` variables. Do not paste secrets into chat.

## 2. Commit both backup files

- `.github/workflows/encrypted-db-backup.yml`
- `scripts/backup-crypto.cjs`

Then use **Actions → Encrypted PostgreSQL backup → Run workflow** once. The job must finish green and show `Encrypted backup verified`. It uploads **only** a `.enc` artifact. If it fails, inspect the job logs (but do not paste secrets into an issue/chat). Common causes: incorrect external URL, blocked database IPs, insufficient `SELECT` privileges, or incorrect secrets.

## 3. Verify recovery periodically (staging only)

Download a recent encrypted artifact from the successful Actions run. Extract the `.enc` file locally. With this repo checked out, set your encryption key in your terminal *without putting it in shell history* (e.g. read it from your password manager or use `read -rs BACKUP_ENCRYPTION_KEY; export BACKUP_ENCRYPTION_KEY` in Bash). Then verify and inspect the archive:

```bash
node scripts/backup-crypto.cjs verify path/to/glob-erp-....enc
node scripts/backup-crypto.cjs decrypt path/to/glob-erp-....enc \
  | docker run --rm -i postgres:17-alpine pg_restore --list | head -25
```

To perform an actual recovery drill, provision a **new empty staging PostgreSQL database**. Never restore a test backup over production. Use its connection string *only in your local shell*:

```bash
node scripts/backup-crypto.cjs decrypt path/to/glob-erp-....enc \
  | docker run --rm -i -e STAGING_DATABASE_URL postgres:17-alpine \
      sh -c 'pg_restore --no-owner --no-acl --dbname="$STAGING_DATABASE_URL"'
```

The encrypted file must pass authentication before plaintext is emitted. The decrypt command holds the verified dump in memory; for very large databases, use a dedicated backup service or object storage instead of this small-ERP script. Restore to staging and check row counts/login before calling the backup reliable.

## Limits / privacy

- GitHub Actions schedules can be delayed or missed; public repositories may have scheduled workflows disabled after prolonged inactivity. Artifacts expire after **14 days**. This is a short-term safety net, **not** a permanent backup archive. Download periodic encrypted copies to secure independent storage or use your DB provider's managed point-in-time recovery.
- A GitHub repo admin or anyone who can change the workflow on `main` may cause secrets to be used. Protect `main`, require review for workflow changes, enable GitHub 2FA, and consider making the repo private (check Render/Vercel access before changing visibility).
- Database encryption protects the artifact, but anyone with both the encryption key and artifact can read all customer/financial data.
- The workflow uses `postgres:17-alpine`; if your database server later upgrades past PostgreSQL 17, update the client version accordingly.
