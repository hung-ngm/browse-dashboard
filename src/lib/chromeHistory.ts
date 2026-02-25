export type ChromeHistoryRow = {
  url: string;
  title: string;
  visitCount: number;
  typedCount: number;
  lastVisitTime: number; // Chrome timestamp (microseconds since 1601-01-01)
};

export type NormalizedVisit = {
  url: string;
  title: string;
  domain: string;
  date: string; // YYYY-MM-DD (local)
  visits: number;
};

// Chrome stores time as microseconds since 1601-01-01 UTC.
// See: https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md
export function chromeTimeToDate(chromeTime: number): Date {
  const epoch1601 = Date.UTC(1601, 0, 1);
  const ms = epoch1601 + chromeTime / 1000;
  return new Date(ms);
}

export function domainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeRowsToVisits(rows: ChromeHistoryRow[], days: number): NormalizedVisit[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return rows
    .map((r) => {
      const dt = chromeTimeToDate(r.lastVisitTime);
      return {
        url: r.url,
        title: r.title,
        domain: domainFromUrl(r.url),
        date: toLocalYmd(dt),
        visits: Math.max(1, r.visitCount || 1),
        _dt: dt,
      } as NormalizedVisit & { _dt: Date };
    })
    .filter((v) => v._dt >= cutoff)
    .map(({ _dt, ...rest }) => rest);
}

export function aggregateTopDomains(visits: NormalizedVisit[]) {
  const map = new Map<string, { domain: string; visits: number }>();
  for (const v of visits) {
    const cur = map.get(v.domain);
    if (cur) cur.visits += v.visits;
    else map.set(v.domain, { domain: v.domain, visits: v.visits });
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits);
}

export function aggregateDailyTotals(visits: NormalizedVisit[]) {
  const map = new Map<string, number>();
  for (const v of visits) map.set(v.date, (map.get(v.date) || 0) + v.visits);
  return [...map.entries()]
    .map(([date, visits]) => ({ date, visits }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
