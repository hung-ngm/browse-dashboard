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

  pool = new Pool({ connectionString, max: 5 });
  return pool;
}
