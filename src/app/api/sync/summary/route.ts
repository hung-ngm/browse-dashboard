import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { corsHeaders } from "@/lib/server/cors";
import { getBearerToken, userIdFromSyncKey } from "@/lib/server/auth";

export const runtime = "nodejs";

async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS domain_daily (
      user_id TEXT NOT NULL,
      day DATE NOT NULL,
      domain TEXT NOT NULL,
      visits INTEGER NOT NULL,
      last_seen TIMESTAMPTZ NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, day, domain)
    );
  `);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  const headers = corsHeaders();
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing Bearer token" }, { status: 401, headers });
    }

    const userId = userIdFromSyncKey(token);
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));

    await ensureSchema();
    const pool = getPool();

    // Fetch rows
    const { rows } = await pool.query(
      `
      SELECT day::text as day, domain, visits, updated_at
      FROM domain_daily
      WHERE user_id = $1 AND day >= (current_date - $2::int)
      ORDER BY day ASC;
      `,
      [userId, days]
    );

    const lastSync = rows.reduce<string | null>((acc, r) => {
      const ts = r.updated_at ? new Date(r.updated_at).toISOString() : null;
      if (!ts) return acc;
      if (!acc) return ts;
      return ts > acc ? ts : acc;
    }, null);

    return NextResponse.json(
      {
        ok: true,
        days,
        lastSync,
        domainDaily: rows.map((r) => ({ day: r.day, domain: r.domain, visits: Number(r.visits) })),
      },
      { status: 200, headers }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Internal error", detail: e?.message || String(e) },
      { status: 500, headers }
    );
  }
}
