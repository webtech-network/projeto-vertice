import { openDB, deleteDB } from 'idb';

// Renomeado com o produto (CanvasTools → Vértice). O banco antigo é migrado
// uma vez por migrateLegacyDb() abaixo — ver ADR-0018.
const DB_NAME = 'vertice';
const LEGACY_DB_NAME = 'canvastools';
// NOTE: bumped straight from 6 to 8, skipping 7 — during development some
// browsers ran openDB(..., 7) in the narrow window between the version bump
// and the STORE_WORKSPACES/STORE_WORKSPACE_LINKS createObjectStore calls
// being added below, which permanently records "version 7, without those
// stores" for that origin (IndexedDB only re-runs `upgrade` when the
// requested version goes *up* from whatever's already stored — no amount of
// reloading re-triggers it once a browser is stuck at 7). Bumping to 8
// forces `upgrade` to run again everywhere; the `if (!contains(...))` guards
// below make that a no-op for anything that already has the stores.
const DB_VERSION = 8;

export const STORE_SHORTCUTS = 'shortcuts';
export const STORE_CACHE = 'cache';
export const STORE_PROMPTS = 'prompts';
export const STORE_GITHUB = 'github';
export const STORE_GOOGLE = 'google';
export const STORE_TASKS = 'tasks';
export const STORE_PROJECTS = 'projects';
export const STORE_COURSE_NOTES = 'courseNotes';
export const STORE_WORKSPACES = 'workspaces';
export const STORE_WORKSPACE_LINKS = 'workspaceLinks';

let dbPromise = null;

// SSR-safe: Next.js can evaluate a 'use client' module's imports during a
// server bundle pass even though only client code ever calls these — resolve
// to null on the server instead of touching `indexedDB` (which doesn't exist
// there) so every helper below can just check for a null db and no-op.
function getDb() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SHORTCUTS)) {
          db.createObjectStore(STORE_SHORTCUTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_PROMPTS)) {
          db.createObjectStore(STORE_PROMPTS, { keyPath: 'capability' });
        }
        if (!db.objectStoreNames.contains(STORE_GITHUB)) {
          db.createObjectStore(STORE_GITHUB, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_GOOGLE)) {
          db.createObjectStore(STORE_GOOGLE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_TASKS)) {
          db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_COURSE_NOTES)) {
          // keyPath 'id' (not 'courseCode') so mergeRecords (recordMerge.js,
          // reused as-is for course notes) can operate on it identically to
          // tasks/projects — id is set to the course code.
          db.createObjectStore(STORE_COURSE_NOTES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
          // The "Base" workspace is never stored here — it's a synthetic
          // constant (see workspaces/workspacesRepo.js's BASE_WORKSPACE) that
          // always exists on every device without needing sync or storage.
          db.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_WORKSPACE_LINKS)) {
          // No secondary index (see every other store above — this app
          // never uses one, `dbGetAll` + in-memory filter is enough at
          // personal-scale). `id` is deterministic
          // (`${workspaceId}:${resourceType}:${resourceId}`), not a random
          // UUID like every other store's records — see
          // workspaces/workspacesRepo.js for why that matters for merging.
          db.createObjectStore(STORE_WORKSPACE_LINKS, { keyPath: 'id' });
        }
      },
    }).then(async (db) => {
      // Capped: opening `canvastools` waits indefinitely while a previous
      // deleteDB of it is still pending (another tab keeps it open) — and
      // since every IndexedDB read here goes through getDb(), that froze the
      // whole app (e.g. Painel de Cursos stuck on "Carregando cursos…").
      // Best-effort migration: give up and retry on the next load.
      await Promise.race([migrateLegacyDb(db), new Promise((resolve) => setTimeout(resolve, 2000))]);
      return db;
    });
  }
  return dbPromise;
}

// Copia o banco do nome antigo (`canvastools`) para este, uma vez: tokens de
// conexão GitHub/Google e os stores legados que a importação manual de
// src/lib/migration ainda lê. O store `cache` fica de fora — é reconstruído
// sozinho e pode ser de outro usuário. Só acrescenta registros que ainda não
// existem aqui (nunca sobrescreve um mais novo), então repetir é inofensivo:
// se a exclusão do banco antigo ficar bloqueada por outra aba aberta, o
// próximo carregamento tenta de novo. Sem `indexedDB.databases()` (navegador
// antigo), não há como saber se o banco antigo existe sem criá-lo: pula.
async function migrateLegacyDb(db) {
  try {
    if (typeof indexedDB.databases !== 'function') return;
    const existing = await indexedDB.databases();
    if (!existing.some((info) => info.name === LEGACY_DB_NAME)) return;

    // `blocking`: if a newer tab wants to delete/upgrade it, let go at once.
    const legacy = await openDB(LEGACY_DB_NAME, undefined, { blocking: (_c, _v, e) => e.target.close() });
    try {
      for (const storeName of Array.from(legacy.objectStoreNames)) {
        if (storeName === STORE_CACHE || !db.objectStoreNames.contains(storeName)) continue;
        const records = await legacy.getAll(storeName);
        if (records.length === 0) continue;
        const tx = db.transaction(storeName, 'readwrite');
        const { keyPath } = tx.store;
        const present = new Set(await tx.store.getAllKeys());
        for (const record of records) {
          if (!present.has(record[keyPath])) await tx.store.put(record);
        }
        await tx.done;
      }
    } finally {
      legacy.close();
    }
    // Sem await: se outra aba (com o código antigo) mantém o banco aberto,
    // a exclusão espera em segundo plano em vez de travar o app.
    deleteDB(LEGACY_DB_NAME).catch(() => {});
  } catch {
    // Migração é best-effort: o app segue com o banco novo.
  }
}

export async function dbGet(storeName, key) {
  const db = await getDb();
  return db ? db.get(storeName, key) : undefined;
}

export async function dbGetAll(storeName) {
  const db = await getDb();
  return db ? db.getAll(storeName) : [];
}

export async function dbGetAllKeys(storeName) {
  const db = await getDb();
  return db ? db.getAllKeys(storeName) : [];
}

export async function dbPut(storeName, value) {
  const db = await getDb();
  if (!db) return;
  return db.put(storeName, value);
}

// Atomic read-modify-write: `dbGet` + `dbPut` are each their own transaction,
// so two calls updating the same record close together race (both read the
// same pre-update value, the second write silently clobbers the first's
// change). tasksRepo.js's updateTask hit this for real — two drags fired
// close together (Kanban status + Eisenhower priority) each read the same
// stale task and wrote back only their own field, losing the other's
// change. A single readwrite transaction spanning both the read and the
// write closes that gap — IndexedDB serializes readwrite transactions
// against the same store, so a second call can't read until the first's
// write has committed. `updater` returning undefined skips the write
// (used when the record no longer exists).
export async function dbUpdate(storeName, key, updater) {
  const db = await getDb();
  if (!db) return undefined;
  const tx = db.transaction(storeName, 'readwrite');
  const existing = await tx.store.get(key);
  const updated = updater(existing);
  if (updated !== undefined) await tx.store.put(updated);
  await tx.done;
  return updated;
}

export async function dbDelete(storeName, key) {
  const db = await getDb();
  if (!db) return;
  return db.delete(storeName, key);
}

export async function dbClear(storeName) {
  const db = await getDb();
  if (!db) return;
  return db.clear(storeName);
}
