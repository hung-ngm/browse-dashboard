const API_BASE = "https://browse-dashboard.vercel.app";

export type DomainDailyRow = { day: string; domain: string; visits: number };

export async function fetchSummary(syncKey: string, days: number) {
  const res = await fetch(`${API_BASE}/api/sync/summary?days=${encodeURIComponent(days)}`, {
    headers: { Authorization: `Bearer ${syncKey}` },
  });
  if (!res.ok) throw new Error(`Summary failed (${res.status})`);
  return (await res.json()) as {
    ok: boolean;
    days: number;
    lastSync: string | null;
    domainDaily: DomainDailyRow[];
  };
}
