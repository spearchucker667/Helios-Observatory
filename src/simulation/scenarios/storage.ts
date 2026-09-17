import type { ScenarioDocument } from "./schema.ts";

export interface ScenarioMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  engineVersion: string;
  bodyCount: number;
}

const DB_NAME = "helios-sandbox";
const DB_VERSION = 1;
const STORE_NAME = "scenarios";

// In-memory fallback for Node.js test environment or SSR
const inMemoryStore = new Map<string, ScenarioDocument>();

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a scenario to local IndexedDB (or in-memory store in Node).
 */
export async function saveScenario(scenario: ScenarioDocument): Promise<void> {
  const idb = getIndexedDB();
  if (!idb) {
    inMemoryStore.set(scenario.id, structuredClone(scenario));
    return;
  }

  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(scenario);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Loads a scenario by ID.
 */
export async function loadScenario(id: string): Promise<ScenarioDocument | null> {
  const idb = getIndexedDB();
  if (!idb) {
    const doc = inMemoryStore.get(id);
    return doc ? structuredClone(doc) : null;
  }

  const db = await openDatabase();
  return new Promise<ScenarioDocument | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lists all stored scenarios metadata.
 */
export async function listScenarios(): Promise<ScenarioMetadata[]> {
  const idb = getIndexedDB();
  if (!idb) {
    return Array.from(inMemoryStore.values()).map((doc) => ({
      id: doc.id,
      name: doc.name,
      description: doc.description,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      engineVersion: doc.engineVersion,
      bodyCount: doc.initialState.bodies.length,
    }));
  }

  const db = await openDatabase();
  return new Promise<ScenarioMetadata[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const docs: ScenarioDocument[] = req.result || [];
      const metas = docs.map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        engineVersion: doc.engineVersion,
        bodyCount: doc.initialState.bodies.length,
      }));
      resolve(metas);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a scenario by ID.
 */
export async function deleteScenario(id: string): Promise<void> {
  const idb = getIndexedDB();
  if (!idb) {
    inMemoryStore.delete(id);
    return;
  }

  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear in-memory store (for unit tests)
 */
export function clearInMemoryScenarios(): void {
  inMemoryStore.clear();
}
