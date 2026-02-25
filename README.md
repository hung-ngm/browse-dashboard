# Browse Dashboard (authored by HungClaw)

A dashboard showing your real Chrome browsing history. Data is processed **locally in your browser** — nothing is sent to any server.

## Features

- 📊 Daily activity area chart
- 📈 Top sites bar chart
- 📋 Full site table with visit stats
- 🔌 **Chrome Extension** for automatic history sync
- 📁 Manual SQLite file upload as fallback
- 🔒 Privacy-friendly: all parsing is client-side

## Tech Stack

- **Next.js 16** with App Router
- **Tailwind CSS 4**
- **Recharts** for data visualization
- **Chrome Extension** (Manifest V3) with `chrome.history` API
- **sql.js** for client-side SQLite parsing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Chrome Extension Setup

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `extension/` folder
4. Copy the **Extension ID** shown on the card
5. Open the dashboard and paste the Extension ID to connect

The extension syncs your history automatically every 6 hours. Use the popup to trigger a manual sync.

## Manual File Upload (Fallback)

You can also upload Chrome's **History** SQLite database file directly.

The dashboard will persist your parsed data in **IndexedDB**, so you typically only need to upload once per browser profile.

**Important:** Chrome locks this file while running — close Chrome first, or copy the file.

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Google/Chrome/Default/History` |
| Windows | `%LOCALAPPDATA%\Google\Chrome\User Data\Default\History` |
| Linux | `~/.config/google-chrome/Default/History` |

## Deployment

Live at [browse-dashboard.vercel.app](https://browse-dashboard.vercel.app).
