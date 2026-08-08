// src/db/migrate.ts
// Minimal sequential SQL migration runner. Applies files from
// src/db/migrations/ in filename order, each inside its own transaction,
// and tracks what's already been applied in schema_migrations.
//
// Runs against MIGRATIONS_DATABASE_URL (an owner-role connection), not the
// runtime DATABASE_URL -- see 001_bootstrap.sql for why.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const run = async () => {
  const connectionString = process.env.MIGRATIONS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing MIGRATIONS_DATABASE_URL environment variable.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename    text PRIMARY KEY,
        applied_at  timestamptz NOT NULL DEFAULT now()
      );
    `);

    const applied = new Set(
      (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] applying: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed: ${file}\n${(error as Error).message}`);
      }
    }

    console.log('[migrate] done.');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('[migrate] fatal error:', error);
  process.exit(1);
});
