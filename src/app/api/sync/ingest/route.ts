import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { corsHeaders } from "@/lib/server/cors";
import { getBearerToken, userIdFromSyncKey } from "@/lib/server/auth";

export const runtime = "nodejs";

type IngestRow = {
  day: string; // YYYY-MM-DD
  domain: string;
  visits: number;
  lastSeen?: string; // ISO
};

type IngestPayload = {
  deviceId?: string;
  windowDays?: number;
  generatedAt?: number;
  rows: IngestRow[];
};

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

export async function POST(req: Request) {
  const headers = corsHeaders();
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing Bearer token" }, { status: 401, headers });
    }

    const userId = userIdFromSyncKey(token);
    const body = (await req.json()) as IngestPayload;

    if (!body?.rows || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers });
    }

    if (body.rows.length > 20000) {
      return NextResponse.json({ error: "Too many rows" }, { status: 413, headers });
    }

    await ensureSchema();

    const pool = getPool();

    // Batch upsert
    // Using parameterized VALUES list.
    const values: any[] = [];
    const placeholders: string[] = [];

    body.rows.forEach((r, i) => {
      const idx = i * 5;
      placeholders.push(`($${idx + 1}, $${idx + 2}::date, $${idx + 3}, $${idx + 4}::int, $${idx + 5}::timestamptz)`);
      values.push(userId, r.day, r.domain, Math.max(0, Math.floor(r.visits || 0)), r.lastSeen || null);
    });

    if (placeholders.length === 0) {
      return NextResponse.json({ ok: true, upserted: 0 }, { status: 200, headers });
    }

    const sql = `
      INSERT INTO domain_daily (user_id, day, domain, visits, last_seen)
      VALUES ${placeholders.join(",")}
      ON CONFLICT (user_id, day, domain)
      DO UPDATE SET
        visits = EXCLUDED.visits,
        last_seen = CASE
          WHEN domain_daily.last_seen IS NULL THEN EXCLUDED.last_seen
          WHEN EXCLUDED.last_seen IS NULL THEN domain_daily.last_seen
          ELSE GREATEST(domain_daily.last_seen, EXCLUDED.last_seen)
        END,
        updated_at = now();
    `;

    await pool.query(sql, values);

    return NextResponse.json(
      { ok: true, upserted: body.rows.length, userIdPrefix: userId.slice(0, 8) },
      { status: 200, headers }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: "Internal error", detail: e?.message || String(e) },
      { status: 500, headers }
    );
  }
}
