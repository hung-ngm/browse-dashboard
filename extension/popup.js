function fmt(ts){return ts?new Date(ts).toLocaleString():"never"}

function updateUI(d){
  document.getElementById("lastSync").textContent = fmt(d.lastSync);
  document.getElementById("lastServerSync").textContent = fmt(d.lastServerSync);
  document.getElementById("totalUrls").textContent = d.totalUrls || 0;
  document.getElementById("syncKey").value = d.syncKey || "";
  document.getElementById("windowDays").value = String(d.windowDays || 30);

  const err = document.getElementById("err");
  if (d.lastServerError) { err.style.display = "block"; err.textContent = d.lastServerError; }
  else { err.style.display = "none"; err.textContent = ""; }
}

chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);

document.getElementById("syncKey").addEventListener("change", (e) => {
  chrome.runtime.sendMessage({ type: "SET_SYNC_KEY", syncKey: e.target.value.trim() }, () => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);
  });
});

document.getElementById("windowDays").addEventListener("change", (e) => {
  chrome.runtime.sendMessage({ type: "SET_WINDOW_DAYS", windowDays: Number(e.target.value) }, () => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);
  });
});

document.getElementById("syncBtn").addEventListener("click", () => {
  const btn = document.getElementById("syncBtn");
  btn.textContent = "Syncing…";
  chrome.runtime.sendMessage({ type: "SYNC_NOW" }, () => {
    btn.textContent = "Sync Now";
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, updateUI);
  });
});

document.getElementById("openBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://browse-dashboard.vercel.app" });
});
