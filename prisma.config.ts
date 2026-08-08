// prisma.config.ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // CLI tooling (db pull / generate) connects as the migration owner
    // role -- consistent with src/db/migrate.ts, and needed so
    // introspection sees the full schema regardless of app_user's grants.
    url: env('MIGRATIONS_DATABASE_URL'),
  },
});
