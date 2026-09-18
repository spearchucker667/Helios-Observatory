import { ScenarioDocumentSchema, type ScenarioDocument } from "./schema.ts";
import { migrateScenario } from "./migrations.ts";

export interface ScenarioMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  engineVersion: string;
  bodyCount: number;
}

export interface ScenarioListResult {
  scenarios: ScenarioMetadata[];
  /** Records that failed validation and were therefore not surfaced. */
  skippedInvalid: number;
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

function toMetadata(doc: ScenarioDocument): ScenarioMetadata {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    engineVersion: doc.engineVersion,
    bodyCount: doc.initialState.bodies.length,
  };
}

/**
 * Persisted records cross a trust boundary: an older build, a manual DevTools
 * edit or a partial write can all leave data that no longer matches the current
 * schema. Every load therefore runs the same migration + strict validation used
 * for untrusted JSON imports.
 */
function validatePersistedRecord(raw: unknown): ScenarioDocument | null {
  const result = ScenarioDocumentSchema.safeParse(raw);
  if (!result.success) return null;
  return result.data as ScenarioDocument;
}

/**
 * Runs the full migration + strict validation chain on a stored record,
 * throwing a descriptive error instead of casting it into trusted state.
 */
function resolveStoredRecord(id: string, raw: unknown): ScenarioDocument {
  let migrated: ScenarioDocument;
  try {
    migrated = migrateScenario(raw);
  } catch (err) {
    throw new Error(
      `Stored scenario "${id}" no longer validates against the current schema and was not loaded: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const revalidated = validatePersistedRecord(migrated);
  if (!revalidated) {
    throw new Error(`Stored scenario "${id}" failed final validation after migration.`);
  }
  return revalidated;
}

/**
 * Saves a scenario to local IndexedDB (or in-memory store in Node).
 * Resolves only when the transaction has actually committed.
 */
export async function saveScenario(scenario: ScenarioDocument): Promise<void> {
  const validated = ScenarioDocumentSchema.safeParse(scenario);
  if (!validated.success) {
    throw new Error(`Refusing to persist an invalid scenario: ${validated.error.message}`);
  }
  const doc = validated.data as ScenarioDocument;

  const idb = getIndexedDB();
  if (!idb) {
    inMemoryStore.set(doc.id, structuredClone(doc));
    return;
  }

  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(doc);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Scenario write transaction aborted"));
  });
}

/**
 * Loads a scenario by ID. Throws when the stored record does not validate
 * against the current schema (instead of casting it into trusted domain state).
 */
export async function loadScenario(id: string): Promise<ScenarioDocument | null> {
  const idb = getIndexedDB();
  if (!idb) {
    const raw = inMemoryStore.get(id);
    if (!raw) return null;
    return structuredClone(resolveStoredRecord(id, raw));
  }

  const db = await openDatabase();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    tx.oncomplete = () => resolve(req.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Scenario read transaction aborted"));
  });

  if (raw === null || raw === undefined) return null;

  return resolveStoredRecord(id, raw);
}

/**
 * Lists all stored scenarios metadata. Invalid records are skipped and counted
 * rather than being surfaced as trusted documents.
 */
export async function listScenarios(): Promise<ScenarioListResult> {
  const idb = getIndexedDB();
  if (!idb) {
    const scenarios: ScenarioMetadata[] = [];
    let skippedInvalid = 0;
    for (const doc of inMemoryStore.values()) {
      const valid = validatePersistedRecord(doc);
      if (!valid) {
        skippedInvalid++;
        continue;
      }
      scenarios.push(toMetadata(valid));
    }
    return { scenarios, skippedInvalid };
  }

  const db = await openDatabase();
  const raws = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    tx.oncomplete = () => resolve(req.result || []);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Scenario list transaction aborted"));
  });

  const scenarios: ScenarioMetadata[] = [];
  let skippedInvalid = 0;
  for (const raw of raws) {
    const valid = validatePersistedRecord(raw);
    if (!valid) {
      skippedInvalid++;
      continue;
    }
    scenarios.push(toMetadata(valid));
  }

  return { scenarios, skippedInvalid };
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
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Scenario delete transaction aborted"));
  });
}

/**
 * Clear in-memory store (for unit tests)
 */
export function clearInMemoryScenarios(): void {
  inMemoryStore.clear();
}

/**
 * TEST-ONLY: writes a raw (unvalidated) record straight into the in-memory
 * store, simulating data left behind by an older build or a manual edit.
 * Production code paths must always go through `saveScenario`.
 */
export function __putRawScenarioForTest(id: string, raw: unknown): void {
  inMemoryStore.set(id, raw as ScenarioDocument);
}
