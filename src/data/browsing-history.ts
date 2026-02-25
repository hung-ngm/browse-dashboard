import { subDays, format } from "date-fns";

export interface BrowseEntry {
  domain: string;
  url: string;
  title: string;
  visits: number;
  category: string;
  favicon: string;
  lastVisited: string;
}

export interface DailyActivity {
  date: string;
  visits: number;
}

const SITES: Omit<BrowseEntry, "visits" | "lastVisited">[] = [
  { domain: "github.com", url: "https://github.com", title: "GitHub", category: "Development", favicon: "https://github.com/favicon.ico" },
  { domain: "stackoverflow.com", url: "https://stackoverflow.com", title: "Stack Overflow", category: "Development", favicon: "https://cdn.sstatic.net/Sites/stackoverflow/Img/favicon.ico" },
  { domain: "chat.openai.com", url: "https://chat.openai.com", title: "ChatGPT", category: "AI", favicon: "https://chat.openai.com/favicon.ico" },
  { domain: "claude.ai", url: "https://claude.ai", title: "Claude", category: "AI", favicon: "https://claude.ai/favicon.ico" },
  { domain: "youtube.com", url: "https://youtube.com", title: "YouTube", category: "Media", favicon: "https://www.youtube.com/favicon.ico" },
  { domain: "twitter.com", url: "https://twitter.com", title: "X / Twitter", category: "Social", favicon: "https://abs.twimg.com/favicons/twitter.3.ico" },
  { domain: "vercel.com", url: "https://vercel.com", title: "Vercel", category: "Development", favicon: "https://vercel.com/favicon.ico" },
  { domain: "nextjs.org", url: "https://nextjs.org", title: "Next.js", category: "Development", favicon: "https://nextjs.org/favicon.ico" },
  { domain: "docs.google.com", url: "https://docs.google.com", title: "Google Docs", category: "Productivity", favicon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico" },
  { domain: "notion.so", url: "https://notion.so", title: "Notion", category: "Productivity", favicon: "https://www.notion.so/images/favicon.ico" },
  { domain: "reddit.com", url: "https://reddit.com", title: "Reddit", category: "Social", favicon: "https://www.redditstatic.com/desktop2x/img/favicon/favicon-32x32.png" },
  { domain: "medium.com", url: "https://medium.com", title: "Medium", category: "Reading", favicon: "https://miro.medium.com/v2/1*m-R_BkNf1Qjr1YbyOIJY2w.png" },
  { domain: "news.ycombinator.com", url: "https://news.ycombinator.com", title: "Hacker News", category: "Reading", favicon: "https://news.ycombinator.com/favicon.ico" },
  { domain: "figma.com", url: "https://figma.com", title: "Figma", category: "Design", favicon: "https://static.figma.com/app/icon/1/favicon.png" },
  { domain: "linear.app", url: "https://linear.app", title: "Linear", category: "Productivity", favicon: "https://linear.app/favicon.ico" },
  { domain: "spotify.com", url: "https://open.spotify.com", title: "Spotify", category: "Media", favicon: "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png" },
  { domain: "gmail.com", url: "https://mail.google.com", title: "Gmail", category: "Productivity", favicon: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" },
  { domain: "npmjs.com", url: "https://npmjs.com", title: "npm", category: "Development", favicon: "https://static-production.npmjs.com/b0f1a8318363185cc2ea6a40ac23eeb2.png" },
  { domain: "tailwindcss.com", url: "https://tailwindcss.com", title: "Tailwind CSS", category: "Development", favicon: "https://tailwindcss.com/favicons/favicon-32x32.png" },
  { domain: "aws.amazon.com", url: "https://aws.amazon.com", title: "AWS Console", category: "Development", favicon: "https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico" },
];

// Deterministic seeded random
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateBrowsingData(): { sites: BrowseEntry[]; dailyActivity: DailyActivity[] } {
  const now = new Date(2026, 1, 26); // Feb 26, 2026
  const sites: BrowseEntry[] = SITES.map((site, i) => {
    const baseVisits = Math.floor(seededRandom(i * 7 + 3) * 180) + 5;
    const daysAgo = Math.floor(seededRandom(i * 13 + 1) * 10);
    return {
      ...site,
      visits: baseVisits,
      lastVisited: format(subDays(now, daysAgo), "yyyy-MM-dd"),
    };
  }).sort((a, b) => b.visits - a.visits);

  const dailyActivity: DailyActivity[] = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(now, 29 - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = isWeekend ? 15 : 35;
    const variance = Math.floor(seededRandom(i * 11 + 5) * 30);
    return {
      date: format(date, "MMM dd"),
      visits: base + variance,
    };
  });

  return { sites, dailyActivity };
}

export function getCategoryBreakdown(sites: BrowseEntry[]) {
  const map: Record<string, number> = {};
  for (const s of sites) {
    map[s.category] = (map[s.category] || 0) + s.visits;
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
