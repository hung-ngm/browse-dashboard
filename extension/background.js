const API_BASE = "https://browse-dashboard.vercel.app";

async function getSettings() {
  return await chrome.storage.local.get(["syncKey", "windowDays", "deviceId"]);
}

function normalizeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function collectAggregated(days) {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const results = await chrome.history.search({ text: "", startTime, maxResults: 100000 });

  const entries = {};
  for (const item of results) {
    if (!item.url) continue;
    if (item.url.startsWith("chrome://") || item.url.startsWith("chrome-extension://")) continue;

    const domain = normalizeDomain(item.url);
    if (!domain) continue;

    const day = new Date(item.lastVisitTime).toISOString().slice(0, 10);
    const key = `${domain}|${day}`;

    if (!entries[key]) {
      entries[key] = { domain, day, visits: 0, lastSeen: null, title: item.title || domain };
    }

    entries[key].visits += item.visitCount || 1;

    const lastSeen = new Date(item.lastVisitTime).toISOString();
    if (!entries[key].lastSeen || lastSeen > entries[key].lastSeen) entries[key].lastSeen = lastSeen;

    if (item.title && item.title.length > (entries[key].title || "").length) entries[key].title = item.title;
  }

  const aggregated = Object.values(entries);
  await chrome.storage.local.set({
    browseHistory: aggregated.map((e) => ({ domain: e.domain, date: e.day, visits: e.visits, title: e.title })),
    lastSync: Date.now(),
    totalUrls: results.length,
  });

  return { aggregated, totalUrls: results.length };
}

async function pushToServer(aggregated, syncKey, windowDays, deviceId) {
  const payload = {
    deviceId: deviceId || "macbook-chrome",
    windowDays,
    generatedAt: Date.now(),
    rows: aggregated.map((e) => ({ day: e.day, domain: e.domain, visits: e.visits, lastSeen: e.lastSeen })),
  };

  const res = await fetch(`${API_BASE}/api/sync/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${syncKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Ingest failed ${res.status}: ${txt}`);
  }

  return await res.json();
}

async function syncAll() {
  const { syncKey, windowDays, deviceId } = await getSettings();
  const days = windowDays || 30;

  const { aggregated, totalUrls } = await collectAggregated(days);

  if (syncKey) {
    try {
      const resp = await pushToServer(aggregated, syncKey, days, deviceId);
      await chrome.storage.local.set({ lastServerSync: Date.now(), lastServerResult: resp });
    } catch (e) {
      await chrome.storage.local.set({ lastServerError: String(e), lastServerSync: Date.now() });
    }
  }

  return { entries: aggregated.length, urls: totalUrls, syncKeyConfigured: !!syncKey };
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["deviceId"]);
  if (!existing.deviceId) {
    await chrome.storage.local.set({ deviceId: `mac-${Math.random().toString(16).slice(2)}` });
  }
  await syncAll();
  chrome.alarms.create("sync-history", { periodInMinutes: 360 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-history") syncAll();
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HISTORY") {
    chrome.storage.local.get(["browseHistory", "lastSync", "totalUrls"], (result) => {
      sendResponse({
        data: result.browseHistory || [],
        lastSync: result.lastSync || null,
        totalUrls: result.totalUrls || 0,
      });
    });
    return true;
  }

  if (request.type === "SYNC_NOW") {
    syncAll().then(async (stats) => {
      chrome.storage.local.get(["browseHistory", "lastSync", "totalUrls"], (result) => {
        sendResponse({
          data: result.browseHistory || [],
          lastSync: result.lastSync || null,
          totalUrls: result.totalUrls || 0,
          stats,
        });
      });
    });
    return true;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SYNC_NOW") {
    syncAll().then((stats) => sendResponse(stats));
    return true;
  }
  if (request.type === "GET_STATUS") {
    chrome.storage.local.get(["lastSync", "totalUrls", "syncKey", "windowDays", "lastServerSync", "lastServerError"], (result) => {
      sendResponse(result);
    });
    return true;
  }
  if (request.type === "SET_SYNC_KEY") {
    chrome.storage.local.set({ syncKey: request.syncKey || "" }, () => sendResponse({ ok: true }));
    return true;
  }
  if (request.type === "SET_WINDOW_DAYS") {
    chrome.storage.local.set({ windowDays: request.windowDays || 30 }, () => sendResponse({ ok: true }));
    return true;
  }
});
