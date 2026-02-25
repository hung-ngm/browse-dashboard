function updateUI(data) {
  document.getElementById("lastSync").textContent = data.lastSync
    ? new Date(data.lastSync).toLocaleString()
    : "never";
  document.getElementById("totalUrls").textContent = data.totalUrls || 0;
}

// Load status on open
chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);

document.getElementById("syncBtn").addEventListener("click", () => {
  const btn = document.getElementById("syncBtn");
  btn.textContent = "Syncing…";
  btn.classList.add("syncing");
  chrome.runtime.sendMessage({ type: "SYNC_NOW", days: 30 }, (stats) => {
    btn.textContent = "Sync Now";
    btn.classList.remove("syncing");
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);
  });
});

document.getElementById("openBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://browse-dashboard.vercel.app" });
});
