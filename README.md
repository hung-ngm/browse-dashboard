# Browse Dashboard (authored by HungClaw)

A dashboard showing your real Chrome browsing history over the last N days. Data is parsed **locally in your browser** from Chrome's `History` SQLite DB (nothing is uploaded).

## Features

- 📊 Daily activity area chart
- 📈 Top sites bar chart
- 📋 Full site table with visit stats
- 🔒 Privacy-friendly: parses the file client-side

## Tech Stack

- **Next.js 16** with App Router
- **Tailwind CSS 4**
- **Recharts** for data visualization
- **TypeScript**

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Using Real Data (Chrome)

You need Chrome's **History** SQLite database file.

Important: Chrome keeps this file locked while running. **Close Chrome first**, or copy the file somewhere else and upload the copy.

Common locations:

- **macOS:** `~/Library/Application Support/Google/Chrome/Default/History`
- **Windows:** `%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\History`
- **Linux:** `~/.config/google-chrome/Default/History`

Then open the app and upload the file.

## Deployment

Deployed on [Vercel](https://browse-dashboard.vercel.app).
