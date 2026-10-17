import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * `POSTGRES_URL` is supported as a fallback because Vercel's Postgres
 * (Neon) integration sets that automatically when you connect Storage.
 *
 * During `next build` on a host without env vars yet (page-data collection
 * imports this module even though no query ever runs at build time), we fall
 * back to a harmless placeholder DSN — the pool is lazy and never connects.
 * At RUNTIME a missing URL still throws a clear error on first use.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  (isBuildPhase
    ? "postgresql://localhost:5432/build-time-placeholder"
    : undefined);

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required (set it in your environment; POSTGRES_URL also works)",
  );
}

/** Serverless Postgres providers (Vercel Postgres, Neon, Supabase) require SSL. */
const isLocalDb =
  databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
