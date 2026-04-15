import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EmailEventType, EmailLog, EmailStatus, pagination } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PAGE_SIZE = 15;

type EmailLogsResponse = {
  logs: EmailLog[];
  pagination: pagination;
};

const eventTypeLabel = (type: EmailEventType) => {
  if (type === "exam_result") return "Exam Result";
  return "Report Card Available";
};

export default function EmailHistoryPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"" | EmailStatus>("");
  const [eventType, setEventType] = useState<"" | EmailEventType>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status) params.set("status", status);
      if (eventType) params.set("eventType", eventType);

      const { data } = await api.get<EmailLogsResponse>(`/email-logs?${params.toString()}`);
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load email history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, debouncedSearch, status, eventType]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email History</h1>
        <p className="text-muted-foreground">
          Audit simple des emails transactionnels envoyes par le systeme.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          placeholder="Search recipient or subject"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as "" | EmailStatus);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>

        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={eventType}
          onChange={(event) => {
            setEventType(event.target.value as "" | EmailEventType);
            setPage(1);
          }}
        >
          <option value="">All event types</option>
          <option value="exam_result">Exam result</option>
          <option value="report_card_available">Report card available</option>
        </select>

        <Button variant="outline" onClick={() => fetchLogs()}>
          Refresh
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Provider ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={6}>
                  Loading email history...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-muted-foreground" colSpan={6}>
                  No emails found for selected filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} className="border-t">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(log.sentAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{log.recipientEmail}</div>
                    {log.recipientUser?.name && (
                      <div className="text-xs text-muted-foreground">{log.recipientUser.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{eventTypeLabel(log.eventType)}</td>
                  <td className="px-4 py-3 max-w-[280px] truncate" title={log.subject}>
                    {log.subject}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        log.status === "sent"
                          ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                          : "rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-800"
                      }
                    >
                      {log.status}
                    </span>
                    {log.errorMessage && (
                      <div className="mt-1 text-xs text-rose-600">{log.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.providerMessageId || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
