// Inline the extension files and generate a zip for download
// Using a minimal zip implementation (no dependencies)

const FILES: Record<string, string> = {
  "manifest.json": JSON.stringify(
    {
      manifest_version: 3,
      name: "Browse Dashboard Sync",
      version: "1.0.0",
      description: "Auto-syncs Chrome browsing history to Browse Dashboard",
      permissions: ["history", "storage", "alarms"],
      action: { default_popup: "popup.html" },
      background: { service_worker: "background.js" },
      externally_connectable: {
        matches: ["https://browse-dashboard.vercel.app/*", "http://localhost:3000/*"],
      },
    },
    null,
    2
  ),

  "background.js": `
async function collectHistory(days = 30) {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const results = await chrome.history.search({ text: "", startTime, maxResults: 100000 });
  const entries = {};
  for (const item of results) {
    if (!item.url) continue;
    let domain;
    try { domain = new URL(item.url).hostname.replace(/^www\\./, ""); } catch { continue; }
    if (!domain || item.url.startsWith("chrome://") || item.url.startsWith("chrome-extension://")) continue;
    const date = new Date(item.lastVisitTime).toISOString().slice(0, 10);
    const key = domain + "|" + date;
    if (!entries[key]) entries[key] = { domain, date, visits: 0, title: item.title || domain };
    entries[key].visits += item.visitCount || 1;
    if (item.title && item.title.length > (entries[key].title || "").length) entries[key].title = item.title;
  }
  const data = Object.values(entries);
  await chrome.storage.local.set({ browseHistory: data, lastSync: Date.now(), totalUrls: results.length });
  return { entries: data.length, urls: results.length };
}
chrome.runtime.onInstalled.addListener(() => { collectHistory(); chrome.alarms.create("sync-history", { periodInMinutes: 360 }); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "sync-history") collectHistory(); });
chrome.runtime.onMessageExternal.addListener((req, sender, res) => {
  if (req.type === "GET_HISTORY") { chrome.storage.local.get(["browseHistory","lastSync","totalUrls"], (r) => res({ data: r.browseHistory||[], lastSync: r.lastSync||null, totalUrls: r.totalUrls||0 })); return true; }
  if (req.type === "SYNC_NOW") { collectHistory(req.days||30).then(() => chrome.storage.local.get(["browseHistory","lastSync","totalUrls"], (r) => res({ data: r.browseHistory||[], lastSync: r.lastSync||null, totalUrls: r.totalUrls||0 }))); return true; }
});
chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.type === "SYNC_NOW") { collectHistory(req.days||30).then((s) => res(s)); return true; }
  if (req.type === "GET_STATUS") { chrome.storage.local.get(["lastSync","totalUrls"], (r) => res(r)); return true; }
});
`.trim(),

  "popup.html": `<!DOCTYPE html>
<html><head><style>
body{width:280px;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;margin:0}
h2{font-size:16px;margin:0 0 12px}.stat{color:#9ca3af;font-size:13px;margin:4px 0}.stat strong{color:#e5e5e5}
button{width:100%;padding:10px;margin-top:12px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
.btn-sync{background:#3b82f6;color:#fff}.btn-open{background:#1f2937;color:#d1d5db;margin-top:8px}
</style></head><body>
<h2>🌐 Browse Dashboard</h2>
<div class="stat">Last sync: <strong id="lastSync">never</strong></div>
<div class="stat">URLs tracked: <strong id="totalUrls">0</strong></div>
<button class="btn-sync" id="syncBtn">Sync Now</button>
<button class="btn-open" id="openBtn">Open Dashboard</button>
<script src="popup.js"></script>
</body></html>`,

  "popup.js": `
function updateUI(d){document.getElementById("lastSync").textContent=d.lastSync?new Date(d.lastSync).toLocaleString():"never";document.getElementById("totalUrls").textContent=d.totalUrls||0}
chrome.runtime.sendMessage({type:"GET_STATUS"},updateUI);
document.getElementById("syncBtn").addEventListener("click",()=>{const b=document.getElementById("syncBtn");b.textContent="Syncing…";chrome.runtime.sendMessage({type:"SYNC_NOW",days:30},(s)=>{b.textContent="Sync Now";chrome.runtime.sendMessage({type:"GET_STATUS"},updateUI)})});
document.getElementById("openBtn").addEventListener("click",()=>{chrome.tabs.create({url:"https://browse-dashboard.vercel.app"})});
`.trim(),
};

// Minimal ZIP generator (store-only, no compression needed for small text files)
function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function downloadExtensionZip() {
  const encoder = new TextEncoder();
  const entries = Object.entries(FILES).map(([name, content]) => ({
    name: encoder.encode(name),
    data: encoder.encode(content),
  }));

  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const crc = crc32(data);

    // Local file header
    const lh = new ArrayBuffer(30 + name.length);
    const lv = new DataView(lh);
    lv.setUint32(0, 0x04034b50, true); // sig
    lv.setUint16(4, 20, true); // version
    lv.setUint16(8, 0, true); // method: store
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); // compressed
    lv.setUint32(22, data.length, true); // uncompressed
    lv.setUint16(26, name.length, true);
    new Uint8Array(lh).set(name, 30);
    parts.push(new Uint8Array(lh));
    parts.push(data);

    // Central directory entry
    const cd = new ArrayBuffer(46 + name.length);
    const cv = new DataView(cd);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    new Uint8Array(cd).set(name, 46);
    centralDir.push(new Uint8Array(cd));

    offset += 30 + name.length + data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  parts.push(new Uint8Array(eocd));

  const blob = new Blob(parts as BlobPart[], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "browse-dashboard-extension.zip";
  a.click();
  URL.revokeObjectURL(url);
}
