"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
} from "recharts";

import initSqlJs from "sql.js";
import {
  aggregateDailyTotals,
  aggregateTopDomains,
  ChromeHistoryRow,
  normalizeRowsToVisits,
} from "@/lib/chromeHistory";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

function downloadSampleJson() {
  const sample = {
    note: "This is ONLY a sample. For real data, upload your Chrome History SQLite file.",
    instructions:
      "On macOS: ~/Library/Application Support/Google/Chrome/Default/History (copy it first). On Windows: %LOCALAPPDATA%/Google/Chrome/User Data/Default/History.",
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "browse-dashboard-sample.json";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [visits, setVisits] = useState<ReturnType<typeof normalizeRowsToVisits>>([]);

  const topDomains = useMemo(() => aggregateTopDomains(visits), [visits]);
  const daily = useMemo(() => {
    return aggregateDailyTotals(visits).map((d) => ({
      ...d,
      label: format(parseISO(d.date), "MMM d"),
    }));
  }, [visits]);

  const totalVisits = topDomains.reduce((s, e) => s + e.visits, 0);
  const totalSites = topDomains.length;

  async function onFile(file: File) {
    setState({ status: "loading" });
    try {
      // Load sql.js wasm
      const SQL = await initSqlJs({
        locateFile: (fileName) => `https://sql.js.org/dist/${fileName}`,
      });

      const buf = await file.arrayBuffer();
      const u8 = new Uint8Array(buf);
      const db = new SQL.Database(u8);

      // Chrome schema: urls table has url, title, visit_count, typed_count, last_visit_time
      const res = db.exec(
        `SELECT url, title, visit_count as visitCount, typed_count as typedCount, last_visit_time as lastVisitTime FROM urls;`
      );

      if (!res.length) throw new Error("No rows returned. Is this a Chrome History file?");

      const cols = res[0].columns;
      const rows = res[0].values as any[];

      const idx = (name: string) => cols.indexOf(name);
      const iUrl = idx("url");
      const iTitle = idx("title");
      const iVisit = idx("visitCount");
      const iTyped = idx("typedCount");
      const iLast = idx("lastVisitTime");

      if ([iUrl, iTitle, iVisit, iTyped, iLast].some((i) => i < 0)) {
        throw new Error(`Unexpected schema. Columns: ${cols.join(", ")}`);
      }

      const mapped: ChromeHistoryRow[] = rows.map((r) => ({
        url: String(r[iUrl] ?? ""),
        title: String(r[iTitle] ?? ""),
        visitCount: Number(r[iVisit] ?? 0),
        typedCount: Number(r[iTyped] ?? 0),
        lastVisitTime: Number(r[iLast] ?? 0),
      }));

      const normalized = normalizeRowsToVisits(mapped, days);
      setVisits(normalized);
      setState({ status: "ready" });
    } catch (e: any) {
      setState({ status: "error", message: e?.message || "Failed to parse file" });
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">🌐 Browse Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Real Chrome history (client-side). Upload your <span className="font-medium">History</span> SQLite file.
        </p>
      </div>

      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-8">
        <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div className="space-y-2">
            <div className="text-sm text-gray-400">
              Privacy: the file is processed in your browser. Nothing is uploaded to a server.
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-300">Window:</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm"
              >
                {[7, 14, 30, 60, 90].map((d) => (
                  <option key={d} value={d}>
                    Last {d} days
                  </option>
                ))}
              </select>
              <button
                onClick={() => downloadSampleJson()}
                className="text-sm text-gray-300 underline underline-offset-4 hover:text-white"
              >
                Download sample (not real)
              </button>
            </div>
          </div>

          <div>
            <input
              type="file"
              accept="*/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="block text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-gray-200"
            />
            <div className="text-xs text-gray-500 mt-1">
              Tip: Chrome locks the History DB while running — copy the file first.
            </div>
            {state.status === "loading" && <div className="text-sm text-gray-300 mt-2">Parsing…</div>}
            {state.status === "error" && <div className="text-sm text-red-400 mt-2">{state.message}</div>}
            {state.status === "ready" && (
              <div className="text-sm text-green-400 mt-2">Loaded {visits.length.toLocaleString()} rows</div>
            )}
          </div>
        </div>
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
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#f3f4f6" }}
              />
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
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
              />
              <Bar dataKey="visits" radius={[0, 6, 6, 0]}>
                {topDomains.slice(0, 10).map((entry) => (
                  <Cell key={entry.domain} fill="#3b82f6" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-lg font-semibold">All Sites</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-gray-800">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium text-right">Total Visits</th>
                <th className="px-4 py-3 font-medium text-right">Avg/Day</th>
              </tr>
            </thead>
            <tbody>
              {topDomains.map((site) => (
                <tr key={site.domain} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{site.domain}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{site.visits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">{Math.round(site.visits / days)}</td>
                </tr>
              ))}
              {!topDomains.length && (
                <tr>
                  <td className="px-4 py-6 text-gray-400" colSpan={3}>
                    Upload a Chrome History file to see your real browsing stats.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="mt-8 text-center text-gray-500 text-sm">Browse Dashboard · Client-side parsing · Next.js</footer>
    </main>
  );
}
