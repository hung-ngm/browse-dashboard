"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, Cell,
} from "recharts";
import initSqlJs from "sql.js";
import {
  aggregateDailyTotals, aggregateTopDomains,
  ChromeHistoryRow, normalizeRowsToVisits, NormalizedVisit,
} from "@/lib/chromeHistory";
import {
  getHistoryFromExtension, syncNowViaExtension,
  ExtensionHistoryEntry,
} from "@/lib/extensionBridge";
import { downloadExtensionZip } from "@/lib/extensionZip";
import { clearHistoryCache, loadHistoryCache, saveHistoryCache } from "@/lib/historyStore";
import { fetchSummary } from "@/lib/apiClient";
import { generateSyncKey } from "@/lib/syncKey";

type Source = "none" | "extension" | "file" | "cache" | "server";

function extensionToNormalized(entries: ExtensionHistoryEntry[]): NormalizedVisit[] {
  return entries.map((e) => ({
    url: "",
    title: e.title,
    domain: e.domain,
    date: e.date,
    visits: e.visits,
  }));
}

export default function Home() {
  const [days, setDays] = useState(30);
  const [source, setSource] = useState<Source>("none");
  const [visits, setVisits] = useState<NormalizedVisit[]>([]);

  // Cross-device sync
  const [syncKey, setSyncKey] = useState("");
  const [serverLastSync, setServerLastSync] = useState<string | null>(null);

  // Extension/local
  const [extId, setExtId] = useState("");
  const [extConnected, setExtConnected] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileLoaded, setFileLoaded] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState<number | null>(null);
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  // On mount: (1) try server via Sync Key, else (2) try extension, else (3) load from IndexedDB cache
  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem("extensionId") || "" : "";
    if (savedId) setExtId(savedId);

    const savedSyncKey = typeof window !== "undefined" ? localStorage.getItem("syncKey") || "" : "";
    if (savedSyncKey) setSyncKey(savedSyncKey);

    async function boot() {
      // 1) Prefer server if Sync Key exists (works on phone)
      if (savedSyncKey) {
        try {
          const summary = await fetchSummary(savedSyncKey, days);
          const v: NormalizedVisit[] = summary.domainDaily.map((r) => ({
            url: "",
            title: r.domain,
            domain: r.domain,
            date: r.day,
            visits: r.visits,
          }));
          setVisits(v);
          setServerLastSync(summary.lastSync);
          setSource("server");
          setLoadedFromCache(false);
          await saveHistoryCache({ source: "cache", visits: v, lastSync: summary.lastSync ? Date.parse(summary.lastSync) : null });
          return;
        } catch {
          // fall through to local methods
        }
      }

      // 2) Extension
      const extRes = await getHistoryFromExtension(savedId || undefined);
      if (extRes) {
        const v = extensionToNormalized(extRes.data);
        setExtConnected(true);
        setVisits(v);
        setLastSync(extRes.lastSync);
        setSource("extension");
        setLoadedFromCache(false);
        await saveHistoryCache({ source: "extension", visits: v, lastSync: extRes.lastSync, extId: savedId || undefined });
        return;
      }

      // 3) Cache
      const cached = await loadHistoryCache();
      if (cached?.visits?.length) {
        setVisits(cached.visits);
        setLastSync(cached.lastSync);
        setSource("cache");
        setCacheSavedAt(cached.savedAt);
        setLoadedFromCache(true);
      }
    }

    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectExtension = useCallback(async () => {
    if (!extId) return;
    setLoading(true);
    setError(null);
    localStorage.setItem("extensionId", extId);
    const res = await getHistoryFromExtension(extId);
    if (res) {
      const v = extensionToNormalized(res.data);
      setExtConnected(true);
      setVisits(v);
      setLastSync(res.lastSync);
      setSource("extension");
      setLoadedFromCache(false);
      await saveHistoryCache({ source: "extension", visits: v, lastSync: res.lastSync, extId });
    } else {
      setError("Could not connect. Check the extension ID and ensure the extension is installed.");
    }
    setLoading(false);
  }, [extId]);

  const syncNow = useCallback(async () => {
    if (!extId) return;
    setLoading(true);
    const res = await syncNowViaExtension(extId, days);
    if (res) {
      const v = extensionToNormalized(res.data);
      setVisits(v);
      setLastSync(res.lastSync);
      setSource("extension");
      setLoadedFromCache(false);
      await saveHistoryCache({ source: "extension", visits: v, lastSync: res.lastSync, extId });
    }
    setLoading(false);
  }, [extId, days]);

  // File upload handler
  async function onFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const SQL = await initSqlJs({
        locateFile: (f) => `https://sql.js.org/dist/${f}`,
      });
      const buf = await file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(buf));
      const res = db.exec(
        "SELECT url, title, visit_count as visitCount, typed_count as typedCount, last_visit_time as lastVisitTime FROM urls;"
      );
      if (!res.length) throw new Error("No rows. Is this a Chrome History file?");
      const cols = res[0].columns;
      const rows = res[0].values as any[];
      const idx = (n: string) => cols.indexOf(n);
      const mapped: ChromeHistoryRow[] = rows.map((r) => ({
        url: String(r[idx("url")] ?? ""),
        title: String(r[idx("title")] ?? ""),
        visitCount: Number(r[idx("visitCount")] ?? 0),
        typedCount: Number(r[idx("typedCount")] ?? 0),
        lastVisitTime: Number(r[idx("lastVisitTime")] ?? 0),
      }));
      // Persist a larger window so you can change the dashboard window later without re-uploading
      const v = normalizeRowsToVisits(mapped, 365);
      setVisits(v);
      setSource("file");
      setFileLoaded(true);
      setLoadedFromCache(false);
      await saveHistoryCache({ source: "file", visits: v, lastSync: Date.now() });
    } catch (e: any) {
      setError(e?.message || "Failed to parse");
    }
    setLoading(false);
  }

  // Filtered by days
  const filteredVisits = useMemo(() => {
    if (source === "file") return visits; // already filtered by normalizeRowsToVisits
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return visits.filter((v) => v.date >= cutoffStr);
  }, [visits, days, source]);

  const topDomains = useMemo(() => aggregateTopDomains(filteredVisits), [filteredVisits]);
  const daily = useMemo(
    () =>
      aggregateDailyTotals(filteredVisits).map((d) => ({
        ...d,
        label: format(parseISO(d.date), "MMM d"),
      })),
    [filteredVisits]
  );

  const totalVisits = topDomains.reduce((s, e) => s + e.visits, 0);
  const totalSites = topDomains.length;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">🌐 Browse Dashboard</h1>
        <p className="text-gray-400 mt-1">Your real browsing history, visualized.</p>
      </div>

      {/* Data Source Panel */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-8 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-300">Source:</span>
          {extConnected && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-900/40 text-green-400">
              ✓ Extension connected
            </span>
          )}
          {fileLoaded && source === "file" && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-400">
              ✓ File loaded
            </span>
          )}
          {source === "none" && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
              No data yet
            </span>
          )}
          {lastSync && (
            <span className="text-xs text-gray-500">Last sync: {new Date(lastSync).toLocaleString()}</span>
          )}
          {loadedFromCache && cacheSavedAt && (
            <span className="text-xs text-gray-500">Loaded from cache: {new Date(cacheSavedAt).toLocaleString()}</span>
          )}
        </div>

        {/* Cross-device sync (server-backed) */}
        <div className="bg-gray-950 rounded-lg p-4 border border-gray-800 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium text-gray-200">📱 Cross-device Sync Key (Postgres)</div>
            {source === "server" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-900/40 text-purple-300">
                Server mode
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Paste the same Sync Key on your phone to view your MacBook browsing stats.
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={syncKey}
              onChange={(e) => setSyncKey(e.target.value)}
              placeholder="bd_sk_..."
              className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
            />
            <button
              onClick={async () => {
                const k = generateSyncKey();
                setSyncKey(k);
                localStorage.setItem("syncKey", k);
              }}
              className="px-4 py-2 bg-gray-800 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-700"
            >
              Generate
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const k = syncKey.trim();
                  if (!k) throw new Error("Missing Sync Key");
                  localStorage.setItem("syncKey", k);
                  const summary = await fetchSummary(k, days);
                  const v: NormalizedVisit[] = summary.domainDaily.map((r) => ({
                    url: "",
                    title: r.domain,
                    domain: r.domain,
                    date: r.day,
                    visits: r.visits,
                  }));
                  setVisits(v);
                  setServerLastSync(summary.lastSync);
                  setSource("server");
                  setLoadedFromCache(false);
                  await saveHistoryCache({ source: "cache", visits: v, lastSync: summary.lastSync ? Date.parse(summary.lastSync) : null });
                } catch (e: any) {
                  setError(e?.message || "Failed to load from server");
                }
                setLoading(false);
              }}
              disabled={loading}
              className="px-4 py-2 bg-purple-700 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-40"
            >
              Load
            </button>
          </div>
          {serverLastSync && (
            <div className="text-xs text-gray-500">Server last sync: {new Date(serverLastSync).toLocaleString()}</div>
          )}
        </div>

        {/* Extension setup */}
        {!extConnected && (
          <div className="bg-gray-950 rounded-lg p-4 border border-gray-800 space-y-3">
            <div className="text-sm font-medium text-gray-200">⚡ Quick Setup (one time)</div>
            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
              <li>
                <button onClick={downloadExtensionZip} className="text-blue-400 underline underline-offset-2 hover:text-blue-300">
                  Download extension zip
                </button>{" "}
                and unzip it
              </li>
              <li>Open <code className="text-gray-300">chrome://extensions</code> → enable <strong className="text-gray-200">Developer mode</strong></li>
              <li>Click <strong className="text-gray-200">Load unpacked</strong> → select the unzipped folder</li>
              <li>Copy the <strong className="text-gray-200">Extension ID</strong> and paste it below</li>
            </ol>
          </div>
        )}

        {/* Extension connect */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Chrome Extension ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={extId}
                onChange={(e) => setExtId(e.target.value)}
                placeholder="e.g. abcdefghijklmnopqrstuvwxyz123456"
                className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
              />
              <button
                onClick={connectExtension}
                disabled={!extId || loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors"
              >
                {extConnected ? "Reconnect" : "Connect"}
              </button>
              {extConnected && (
                <button
                  onClick={syncNow}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-800 text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {loading ? "Syncing…" : "Sync Now"}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Window</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200"
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>Last {d} days</option>
              ))}
            </select>
          </div>
        </div>

        {/* File upload fallback + cache controls */}
        <div className="border-t border-gray-800 pt-3 space-y-3">
          <div className="text-xs text-gray-500">
            Or upload Chrome&apos;s History SQLite file manually (processed locally, nothing uploaded). We&apos;ll save it in your browser so you only upload once.
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              type="file"
              accept="*/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="block text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700"
            />
            <button
              onClick={async () => {
                await clearHistoryCache();
                setVisits([]);
                setSource("none");
                setLastSync(null);
                setCacheSavedAt(null);
                setLoadedFromCache(false);
                setFileLoaded(false);
                setExtConnected(false);
              }}
              className="px-4 py-2 bg-red-900/40 text-red-300 text-sm font-medium rounded-lg hover:bg-red-900/55 transition-colors"
            >
              Clear saved data
            </button>
          </div>
          <div className="text-xs text-gray-600">
            Note: saved data lives in this browser profile (IndexedDB). Clearing site data will remove it.
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {loading && source === "none" && <div className="text-sm text-gray-400">Loading…</div>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Visits", value: totalVisits.toLocaleString() },
          { label: "Unique Sites", value: totalSites },
          { label: "Avg/Day", value: days ? Math.round(totalVisits / days) : 0 },
          { label: "Top Site", value: topDomains[0]?.domain || "-" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-sm text-gray-400">{stat.label}</div>
            <div className="text-2xl font-semibold mt-1 truncate">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Daily Activity</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} labelStyle={{ color: "#f3f4f6" }} />
              <Area type="monotone" dataKey="visits" stroke="#3b82f6" fill="url(#colorVisits)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Top Sites</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topDomains.slice(0, 10)} layout="vertical" margin={{ left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis type="category" dataKey="domain" tick={{ fill: "#d1d5db", fontSize: 13 }} width={110} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }} />
              <Bar dataKey="visits" radius={[0, 6, 6, 0]}>
                {topDomains.slice(0, 10).map((e) => (
                  <Cell key={e.domain} fill="#3b82f6" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold">All Sites</h2>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium text-right">Total Visits</th>
                <th className="px-4 py-3 font-medium text-right">Avg/Day</th>
              </tr>
            </thead>
            <tbody>
              {topDomains.map((site) => (
                <tr key={site.domain} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{site.domain}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{site.visits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">{Math.round(site.visits / days)}</td>
                </tr>
              ))}
              {!topDomains.length && (
                <tr>
                  <td className="px-4 py-8 text-gray-500 text-center" colSpan={3}>
                    Connect the Chrome extension or upload a History file to see your data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="mt-8 text-center text-gray-500 text-sm">Browse Dashboard · Client-side only · Next.js</footer>
    </main>
  );
}
