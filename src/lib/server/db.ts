import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool() {
  if (pool) return pool;

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DATABASE_POSTGRES_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL (or DATABASE_POSTGRES_URL/POSTGRES_URL) environment variable"
    );
  }

  // Neon/Vercel Postgres typically requires SSL in production.
  // pg will usually infer this from the connection string, but we also set it explicitly
  // to avoid "no pg_hba.conf entry" / TLS-related failures in serverless.
  const ssl = connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined;

  pool = new Pool({ connectionString, ssl, max: 5, connectionTimeoutMillis: 10_000 });
  return pool;
}
