// ─── EDUNEXUS OFFLINE DB ─────────────────────────────────────
// IndexedDB pour stocker : présences, notes, listes élèves, EDT

const DB_NAME = "edunexus-offline";
const DB_VERSION = 1;

export type OfflineStore =
  | "attendance_queue"
  | "grades_queue"
  | "students_cache"
  | "classes_cache"
  | "timetable_cache"
  | "sync_reports";

const STORES: OfflineStore[] = [
  "attendance_queue",
  "grades_queue",
  "students_cache",
  "classes_cache",
  "timetable_cache",
  "sync_reports",
];

let db: IDBDatabase | null = null;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      STORES.forEach((store) => {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      });
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => reject(request.error);
  });
};

export const dbSet = async <T>(store: OfflineStore, value: T & { id?: string | number }): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    const record = value as T & { id?: string | number };
    if (record.id === undefined || record.id === null || record.id === "") {
      record.id = crypto.randomUUID();
    }

    tx.objectStore(store).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const dbGetAll = async <T>(store: OfflineStore): Promise<T[]> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const request = tx.objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
};

export const dbDelete = async (store: OfflineStore, id: string | number): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const dbClear = async (store: OfflineStore): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const dbCount = async (store: OfflineStore): Promise<number> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, "readonly");
    const request = tx.objectStore(store).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};