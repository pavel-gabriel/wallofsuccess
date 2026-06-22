// Applies schema.sql and seeds the initial admin from env. Idempotent — runs as
// the web pod's init container and is safe on every boot.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function waitForDb(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await query('select 1');
      return;
    } catch (e) {
      console.log(`Waiting for Postgres (${i}/${attempts})… ${e.code || e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Postgres did not become ready in time.');
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed.');
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  // Upsert so the password can be rotated by changing the env value.
  await query(
    `insert into admins (email, password_hash) values ($1, $2)
     on conflict (email) do update set password_hash = excluded.password_hash`,
    [email, hash]
  );
  console.log(`Admin ensured: ${email}`);
}

async function main() {
  await waitForDb();
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
  console.log('Schema applied.');
  await seedAdmin();
  await pool.end();
  console.log('Migration complete.');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
