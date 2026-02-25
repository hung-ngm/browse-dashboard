import crypto from "crypto";

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function userIdFromSyncKey(syncKey: string): string {
  return crypto.createHash("sha256").update(syncKey).digest("hex");
}
