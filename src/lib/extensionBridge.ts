// Communication bridge with the Chrome Extension via externally_connectable

// The extension ID — user must update this after installing the unpacked extension
// We'll try to detect it dynamically
const KNOWN_EXTENSION_IDS: string[] = [];

export type ExtensionHistoryEntry = {
  domain: string;
  date: string;
  visits: number;
  title: string;
};

export type ExtensionResponse = {
  data: ExtensionHistoryEntry[];
  lastSync: number | null;
  totalUrls: number;
};

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (
          extensionId: string,
          message: unknown,
          callback: (response: ExtensionResponse) => void
        ) => void;
      };
    };
  }
}

function tryExtensionId(id: string, message: unknown): Promise<ExtensionResponse | null> {
  return new Promise((resolve) => {
    try {
      if (!window.chrome?.runtime?.sendMessage) {
        resolve(null);
        return;
      }
      const timeout = setTimeout(() => resolve(null), 2000);
      window.chrome.runtime.sendMessage(id, message, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError || !response) {
          resolve(null);
        } else {
          resolve(response as ExtensionResponse);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

export async function getHistoryFromExtension(
  extensionId?: string
): Promise<ExtensionResponse | null> {
  // If a specific ID is provided, try it
  if (extensionId) {
    return tryExtensionId(extensionId, { type: "GET_HISTORY" });
  }

  // Try known IDs
  for (const id of KNOWN_EXTENSION_IDS) {
    const res = await tryExtensionId(id, { type: "GET_HISTORY" });
    if (res) return res;
  }

  // Try the ID from localStorage (user can set it)
  const savedId = localStorage.getItem("extensionId");
  if (savedId) {
    const res = await tryExtensionId(savedId, { type: "GET_HISTORY" });
    if (res) return res;
  }

  return null;
}

export async function syncNowViaExtension(
  extensionId: string,
  days = 30
): Promise<ExtensionResponse | null> {
  return tryExtensionId(extensionId, { type: "SYNC_NOW", days });
}
