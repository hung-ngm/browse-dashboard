"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { generateBrowsingData, getCategoryBreakdown, type BrowseEntry } from "@/data/browsing-history";

const COLORS = ["#6366f1", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#fb923c", "#a78bfa"];

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function SiteRow({ site, rank }: { site: BrowseEntry; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-800/50 rounded-xl transition-colors">
      <span className="text-gray-500 text-sm w-6 text-right">{rank}</span>
      <img
        src={site.favicon}
        alt=""
        width={20}
        height={20}
        className="rounded"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{site.domain}</p>
        <p className="text-xs text-gray-500">{site.category}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold text-indigo-400">{site.visits}</p>
        <p className="text-xs text-gray-500">visits</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { sites, dailyActivity } = useMemo(() => generateBrowsingData(), []);
  const categories = useMemo(() => getCategoryBreakdown(sites), [sites]);
  const totalVisits = sites.reduce((s, e) => s + e.visits, 0);
  const avgDaily = Math.round(totalVisits / 30);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">🌐 Browse Dashboard</h1>
        <p className="text-gray-400 mt-1">Sites visited in the last 30 days</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Visits" value={totalVisits.toLocaleString()} />
        <StatCard label="Unique Sites" value={sites.length} />
        <StatCard label="Avg / Day" value={avgDaily} />
        <StatCard label="Top Site" value={sites[0]?.domain ?? "—"} />
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Daily Activity */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Daily Activity</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyActivity}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} interval={4} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 12 }} />
              <Area type="monotone" dataKey="visits" stroke="#6366f1" fill="url(#areaGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Categories</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={categories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {categories.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {categories.map((c, i) => (
              <span key={c.name} className="text-xs flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: COLORS[i % COLORS.length] }} />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Top Sites Bar + List */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">Top 10 Sites</h2>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={sites.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis dataKey="domain" type="category" tick={{ fill: "#d1d5db", fontSize: 12 }} width={80} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 12 }} />
              <Bar dataKey="visits" fill="#6366f1" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Site List */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-4">All Sites</h2>
          <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
            {sites.map((site, i) => (
              <SiteRow key={site.domain} site={site} rank={i + 1} />
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-gray-600 text-xs mt-10">Browse Dashboard — built with Next.js + Recharts</p>
    </main>
  );
}
