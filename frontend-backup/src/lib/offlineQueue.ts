import { api } from "@/lib/api";
import { dbGetAll, dbDelete, dbSet, type OfflineStore } from "@/lib/offlineDB";

export type QueueItem = {
  id?: string | number;
  type: "attendance" | "grade";
  payload: any;
  createdAt: string;
  retries: number;
};

export type SyncReport = {
  id?: string | number;
  timestamp: string;
  total: number;
  accepted: number;
  rejected: number;
  items: {
    type: string;
    status: "accepted" | "rejected";
    reason?: string;
    payload: any;
  }[];
};

export const enqueue = async (item: Omit<QueueItem, "id" | "retries" | "createdAt">): Promise<void> => {
  const store: OfflineStore = item.type === "attendance" ? "attendance_queue" : "grades_queue";
  await dbSet<QueueItem>(store, {
    ...item,
    retries: 0,
    createdAt: new Date().toISOString(),
  });
};

export const syncAll = async (): Promise<SyncReport> => {
  const report: SyncReport = {
    timestamp: new Date().toISOString(),
    total: 0,
    accepted: 0,
    rejected: 0,
    items: [],
  };

  const [attendanceItems, gradeItems] = await Promise.all([
    dbGetAll<QueueItem>("attendance_queue"),
    dbGetAll<QueueItem>("grades_queue"),
  ]);

  const allItems = [...attendanceItems, ...gradeItems];
  report.total = allItems.length;

  if (allItems.length === 0) {
    await dbSet<SyncReport>("sync_reports", report);
    return report;
  }

  for (const item of allItems) {
    const store: OfflineStore = item.type === "attendance" ? "attendance_queue" : "grades_queue";

    try {
      if (item.type === "attendance") {
        await api.post("/attendance", item.payload);
        report.accepted += 1;
        report.items.push({ type: "Présence", status: "accepted", payload: item.payload });
      } else if (item.type === "grade") {
        const existing = await api.get(`/grades/${item.payload.gradeId}`).catch(() => null);
        if (existing?.data?.validationStatus === "VALIDATED" || existing?.data?.validationStatus === "LOCKED") {
          report.rejected += 1;
          report.items.push({
            type: "Note",
            status: "rejected",
            reason: "Note déjà validée — modification hors ligne rejetée",
            payload: item.payload,
          });
        } else {
          await api.post("/grades", item.payload);
          report.accepted += 1;
          report.items.push({ type: "Note", status: "accepted", payload: item.payload });
        }
      }

      if (item.id !== undefined) {
        await dbDelete(store, item.id);
      }
    } catch (error: any) {
      report.rejected += 1;
      report.items.push({
        type: item.type === "attendance" ? "Présence" : "Note",
        status: "rejected",
        reason: error?.response?.data?.message || "Erreur réseau",
        payload: item.payload,
      });

      if (item.id !== undefined) {
        await dbSet(store, { ...item, retries: (item.retries || 0) + 1 });
      }
    }
  }

  await dbSet<SyncReport>("sync_reports", report);
  return report;
};

export const getPendingCount = async (): Promise<number> => {
  const [attendance, grades] = await Promise.all([
    dbGetAll<QueueItem>("attendance_queue"),
    dbGetAll<QueueItem>("grades_queue"),
  ]);

  return attendance.length + grades.length;
};