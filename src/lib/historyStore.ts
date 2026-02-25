import type { NormalizedVisit } from "@/lib/chromeHistory";

const DB_NAME = "browse-dashboard";
const DB_VERSION = 1;
const STORE = "kv";

type PersistedPayload = {
  version: 1;
  savedAt: number;
  source: "file" | "extension" | "cache";
  visits: NormalizedVisit[];
  lastSync: number | null;
  extId?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbSet<T>(key: string, value: T): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.put(value as any, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function idbDel(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

const KEY_PAYLOAD = "payload";

export async function loadHistoryCache(): Promise<PersistedPayload | null> {
  if (typeof indexedDB === "undefined") return null;
  return await idbGet<PersistedPayload>(KEY_PAYLOAD);
}

export async function saveHistoryCache(payload: Omit<PersistedPayload, "version" | "savedAt">): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const full: PersistedPayload = {
    version: 1,
    savedAt: Date.now(),
    ...payload,
  };
  await idbSet(KEY_PAYLOAD, full);
}

export async function clearHistoryCache(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await idbDel(KEY_PAYLOAD);
}
