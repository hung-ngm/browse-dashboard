// Collect history and store in chrome.storage.local
async function collectHistory(days = 30) {
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

  const results = await chrome.history.search({
    text: "",
    startTime,
    maxResults: 100000,
  });

  // Aggregate by domain + date
  const entries = {};
  for (const item of results) {
    if (!item.url) continue;
    let domain;
    try {
      domain = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    // Skip chrome:// and extension pages
    if (domain === "" || item.url.startsWith("chrome://") || item.url.startsWith("chrome-extension://")) continue;

    const date = new Date(item.lastVisitTime).toISOString().slice(0, 10);
    const key = `${domain}|${date}`;

    if (!entries[key]) {
      entries[key] = { domain, date, visits: 0, title: item.title || domain };
    }
    entries[key].visits += item.visitCount || 1;
    // Keep the most descriptive title
    if (item.title && item.title.length > (entries[key].title || "").length) {
      entries[key].title = item.title;
    }
  }

  const data = Object.values(entries);
  const syncTime = Date.now();

  await chrome.storage.local.set({
    browseHistory: data,
    lastSync: syncTime,
    totalUrls: results.length,
  });

  console.log(`[Browse Dashboard] Synced ${data.length} domain-day entries from ${results.length} URLs`);
  return { entries: data.length, urls: results.length, syncTime };
}

// Run on install
chrome.runtime.onInstalled.addListener(() => {
  // Sync immediately
  collectHistory();
  // Set alarm for every 6 hours
  chrome.alarms.create("sync-history", { periodInMinutes: 360 });
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-history") {
    collectHistory();
  }
});

// Handle messages from the dashboard page (externally_connectable)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_HISTORY") {
    chrome.storage.local.get(["browseHistory", "lastSync", "totalUrls"], (result) => {
      sendResponse({
        data: result.browseHistory || [],
        lastSync: result.lastSync || null,
        totalUrls: result.totalUrls || 0,
      });
    });
    return true; // async response
  }

  if (request.type === "SYNC_NOW") {
    collectHistory(request.days || 30).then((stats) => {
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

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SYNC_NOW") {
    collectHistory(request.days || 30).then((stats) => {
      sendResponse(stats);
    });
    return true;
  }
  if (request.type === "GET_STATUS") {
    chrome.storage.local.get(["lastSync", "totalUrls"], (result) => {
      sendResponse(result);
    });
    return true;
  }
});
