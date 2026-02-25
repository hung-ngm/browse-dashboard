import { subDays, format } from "date-fns";

export interface BrowsingEntry {
  domain: string;
  visits: number;
  date: string; // YYYY-MM-DD
  category: string;
  favicon: string;
}

const sites = [
  { domain: "github.com", category: "Development", favicon: "https://github.com/favicon.ico" },
  { domain: "stackoverflow.com", category: "Development", favicon: "https://stackoverflow.com/favicon.ico" },
  { domain: "chat.openai.com", category: "AI", favicon: "https://chat.openai.com/favicon.ico" },
  { domain: "claude.ai", category: "AI", favicon: "https://claude.ai/favicon.ico" },
  { domain: "vercel.com", category: "Development", favicon: "https://vercel.com/favicon.ico" },
  { domain: "youtube.com", category: "Entertainment", favicon: "https://youtube.com/favicon.ico" },
  { domain: "twitter.com", category: "Social", favicon: "https://twitter.com/favicon.ico" },
  { domain: "reddit.com", category: "Social", favicon: "https://reddit.com/favicon.ico" },
  { domain: "notion.so", category: "Productivity", favicon: "https://notion.so/favicon.ico" },
  { domain: "docs.google.com", category: "Productivity", favicon: "https://docs.google.com/favicon.ico" },
  { domain: "figma.com", category: "Design", favicon: "https://figma.com/favicon.ico" },
  { domain: "tailwindcss.com", category: "Development", favicon: "https://tailwindcss.com/favicon.ico" },
  { domain: "nextjs.org", category: "Development", favicon: "https://nextjs.org/favicon.ico" },
  { domain: "medium.com", category: "Reading", favicon: "https://medium.com/favicon.ico" },
  { domain: "news.ycombinator.com", category: "Reading", favicon: "https://news.ycombinator.com/favicon.ico" },
  { domain: "spotify.com", category: "Entertainment", favicon: "https://spotify.com/favicon.ico" },
  { domain: "gmail.com", category: "Productivity", favicon: "https://gmail.com/favicon.ico" },
  { domain: "linkedin.com", category: "Social", favicon: "https://linkedin.com/favicon.ico" },
  { domain: "aws.amazon.com", category: "Development", favicon: "https://aws.amazon.com/favicon.ico" },
  { domain: "npmjs.com", category: "Development", favicon: "https://npmjs.com/favicon.ico" },
];

// Deterministic seeded random
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateBrowsingData(): BrowsingEntry[] {
  const data: BrowsingEntry[] = [];
  const now = new Date(2026, 1, 26); // Feb 26, 2026

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = subDays(now, dayOffset);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      const seed = dayOffset * 100 + i;
      const rand = seededRandom(seed);

      // Skip some sites on some days
      if (rand < 0.3) continue;

      // Dev sites more on weekdays, entertainment more on weekends
      let multiplier = 1;
      if (site.category === "Development" && !isWeekend) multiplier = 2.5;
      if (site.category === "Entertainment" && isWeekend) multiplier = 3;
      if (site.category === "Social" && isWeekend) multiplier = 2;

      const visits = Math.max(1, Math.round(seededRandom(seed + 999) * 20 * multiplier));

      data.push({ ...site, visits, date: dateStr });
    }
  }

  return data;
}

export const categories = [...new Set(sites.map((s) => s.category))];

export const categoryColors: Record<string, string> = {
  Development: "#3b82f6",
  AI: "#8b5cf6",
  Entertainment: "#f59e0b",
  Social: "#ec4899",
  Productivity: "#10b981",
  Design: "#f43f5e",
  Reading: "#06b6d4",
};
