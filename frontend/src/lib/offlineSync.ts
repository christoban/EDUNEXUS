import { dbDelete, dbGetAll, dbSet, type OfflineStore } from "@/lib/offlineDB";

type CachedResponseRecord = {
  id: string;
  kind: "cache";
  cacheKey: string;
  data: unknown;
  savedAt: string;
};

type QueuedMutationRecord = {
  id: string;
  kind: "mutation";
  url: string;
  method: string;
  data: unknown;
  params?: unknown;
  headers?: Record<string, string>;
  store: OfflineStore;
  queuedAt: string;
};

type QueueTarget = {
  store: OfflineStore;
  shouldReplay: boolean;
};

type RequestLike = {
  url?: string;
  method?: string;
  data?: unknown;
  params?: unknown;
  headers?: unknown;
};

const normalizePath = (url: string) => {
  const withoutApiPrefix = url.startsWith("/api/") ? url.slice(4) : url;
  return withoutApiPrefix.startsWith("/") ? withoutApiPrefix : `/${withoutApiPrefix}`;
};

const stableStringify = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return JSON.stringify(value ?? null);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(",")}}`;
};

const getCacheStoreForPath = (path: string): OfflineStore => {
  if (path.startsWith("/classes")) return "classes_cache";
  if (path.startsWith("/users") && path.includes("role=student")) return "students_cache";
  if (path.startsWith("/timetables") || path.startsWith("/timetable")) return "timetable_cache";
  return "sync_reports";
};

const getQueueTarget = (path: string): QueueTarget | null => {
  if (path.startsWith("/attendance")) {
    return { store: "attendance_queue", shouldReplay: true };
  }

  if (path.startsWith("/grades")) {
    return { store: "grades_queue", shouldReplay: true };
  }

  if (path.startsWith("/timetables")) {
    return { store: "sync_reports", shouldReplay: true };
  }

  return null;
};

const buildCacheKey = (url: string, params: unknown) => {
  return `${normalizePath(url)}::${stableStringify(params ?? null)}`;
};

const buildRequestUrl = (url: string, params: unknown) => {
  const normalizedPath = normalizePath(url);
  const requestUrl = new URL(`/api${normalizedPath}`, window.location.origin);

  if (params && typeof params === "object" && !Array.isArray(params)) {
    const entries = Object.entries(params as Record<string, unknown>);
    entries.forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      requestUrl.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    });
  }

  return requestUrl.toString();
};

const getHeaders = (headers?: unknown): Record<string, string> => {
  if (!headers || typeof headers !== "object") {
    return {};
  }

  return Object.entries(headers as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key] = value;
    }

    return acc;
  }, {});
};

export const shouldCacheApiResponse = (url: string) => {
  const path = normalizePath(url);
  return (
    path.startsWith("/classes") ||
    path.startsWith("/users") ||
    path.startsWith("/timetables") ||
    path.startsWith("/attendance") ||
    path.startsWith("/grades") ||
    path.startsWith("/subjects") ||
    path.startsWith("/academic-years") ||
    path.startsWith("/core-domain")
  );
};

export const shouldQueueOfflineMutation = (url: string, method: string) => {
  const normalizedMethod = method.toLowerCase();
  const path = normalizePath(url);

  if (!["post", "put", "patch", "delete"].includes(normalizedMethod)) {
    return false;
  }

  return path.startsWith("/attendance") || path.startsWith("/grades") || path.startsWith("/timetables");
};

export const cacheApiResponse = async (url: string, params: unknown, data: unknown) => {
  const path = normalizePath(url);
  const store = getCacheStoreForPath(path);
  const id = buildCacheKey(url, params);

  await dbSet<CachedResponseRecord>(store, {
    id,
    kind: "cache",
    cacheKey: id,
    data,
    savedAt: new Date().toISOString(),
  });
};

export const getCachedApiResponse = async (url: string, params: unknown) => {
  const path = normalizePath(url);
  const store = getCacheStoreForPath(path);
  const id = buildCacheKey(url, params);
  const entries = await dbGetAll<CachedResponseRecord | QueuedMutationRecord>(store);
  const hit = entries.find((entry) => entry.kind === "cache" && entry.id === id) as CachedResponseRecord | undefined;

  return hit?.data ?? null;
};

export const queueOfflineMutation = async (request: RequestLike) => {
  const path = normalizePath(request.url || "");
  const target = getQueueTarget(path);

  if (!target) {
    return;
  }

  const id = crypto.randomUUID();
  await dbSet<QueuedMutationRecord>(target.store, {
    id,
    kind: "mutation",
    url: path,
    method: String(request.method || "POST").toUpperCase(),
    data: request.data,
    params: request.params,
    headers: getHeaders(request.headers),
    store: target.store,
    queuedAt: new Date().toISOString(),
  });
};

const replayMutation = async (record: QueuedMutationRecord) => {
  const response = await fetch(buildRequestUrl(record.url, record.params), {
    method: record.method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...record.headers,
    },
    body: record.data === undefined ? undefined : JSON.stringify(record.data),
  });

  if (!response.ok) {
    throw new Error(`Replay failed for ${record.url} (${response.status})`);
  }
};

export const flushOfflineQueue = async () => {
  const queueStores: OfflineStore[] = ["attendance_queue", "grades_queue", "sync_reports"];
  const results = [] as Array<{ store: OfflineStore; id: string; ok: boolean }>;

  for (const store of queueStores) {
    const entries = await dbGetAll<CachedResponseRecord | QueuedMutationRecord>(store);
    const mutations = entries.filter((entry): entry is QueuedMutationRecord => entry.kind === "mutation");

    for (const mutation of mutations) {
      try {
        if (mutation.store === "sync_reports" || mutation.store === "attendance_queue" || mutation.store === "grades_queue") {
          await replayMutation(mutation);
        }

        await dbDelete(store, mutation.id);
        results.push({ store, id: mutation.id, ok: true });
      } catch {
        results.push({ store, id: mutation.id, ok: false });
      }
    }
  }

  return results;
};

export const getOfflineQueueSize = async () => {
  const [attendance, grades, reports] = await Promise.all([
    dbGetAll<CachedResponseRecord | QueuedMutationRecord>("attendance_queue"),
    dbGetAll<CachedResponseRecord | QueuedMutationRecord>("grades_queue"),
    dbGetAll<CachedResponseRecord | QueuedMutationRecord>("sync_reports"),
  ]);

  return [attendance, grades, reports]
    .flat()
    .filter((entry): entry is QueuedMutationRecord => entry.kind === "mutation").length;
};

export const getOfflineCacheSummary = async () => {
  const [classes, students, timetable] = await Promise.all([
    dbGetAll<CachedResponseRecord>("classes_cache"),
    dbGetAll<CachedResponseRecord>("students_cache"),
    dbGetAll<CachedResponseRecord>("timetable_cache"),
  ]);

  return {
    classes: classes.length,
    students: students.length,
    timetable: timetable.length,
  };
};