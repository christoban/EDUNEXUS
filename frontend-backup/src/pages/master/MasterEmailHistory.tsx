import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { EmailEventType, EmailLog, EmailStatus, pagination } from "@/types";

type MasterEmailLogsResponse = {
  logs: EmailLog[];
  pagination: pagination;
  filters?: {
    schoolId?: string | null;
    eventType?: string | null;
    status?: string | null;
    search?: string | null;
  };
};

const eventTypeOptions: Array<{ value: "" | EmailEventType; label: string }> = [
  { value: "", label: "Tous les types" },
  { value: "school_invite", label: "School invite" },
  { value: "master_login_otp", label: "Master login OTP" },
  { value: "master_password_change_otp", label: "Master password change OTP" },
  { value: "payment_reminder", label: "Payment reminder" },
  { value: "exam_result", label: "Exam result" },
  { value: "report_card_available", label: "Report card" },
];

const eventTypeLabel = (value: EmailEventType) => {
  if (value === "school_invite") return "School Invite";
  if (value === "master_login_otp") return "Master Login OTP";
  if (value === "master_password_change_otp") return "Master Password Change OTP";
  if (value === "payment_reminder") return "Payment Reminder";
  if (value === "exam_result") return "Exam Result";
  return "Report Card";
};

const MasterEmailHistory = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialEventType = (searchParams.get("eventType") || "") as "" | EmailEventType;
  const initialSchoolId = searchParams.get("schoolId") || "";
  const initialSearch = searchParams.get("search") || "";

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<pagination>({ total: 0, page: 1, pages: 1, limit: 15 });
  const [search, setSearch] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [status, setStatus] = useState<"" | EmailStatus>("");
  const [eventType, setEventType] = useState<"" | EmailEventType>(initialEventType);
  const [schoolId, setSchoolId] = useState(initialSchoolId);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setEventType("");
    setSchoolId("");
    setPage(1);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timeout);
  }, [search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "15");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status) params.set("status", status);
    if (eventType) params.set("eventType", eventType);
    if (schoolId) params.set("schoolId", schoolId);
    return params.toString();
  }, [page, debouncedSearch, status, eventType, schoolId]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count += 1;
    if (status) count += 1;
    if (eventType) count += 1;
    if (schoolId) count += 1;
    return count;
  }, [debouncedSearch, status, eventType, schoolId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<MasterEmailLogsResponse>(`/master/email-logs?${queryString}`);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setPagination(data.pagination || { total: 0, page: 1, pages: 1, limit: 15 });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Impossible de charger les logs email master.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (eventType) next.set("eventType", eventType); else next.delete("eventType");
      if (schoolId) next.set("schoolId", schoolId); else next.delete("schoolId");
      if (status) next.set("status", status); else next.delete("status");
      if (debouncedSearch) next.set("search", debouncedSearch); else next.delete("search");
      return next;
    });
  }, [queryString, eventType, schoolId, status, debouncedSearch, setSearchParams]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit border-white/10 bg-sky-400/10 text-sky-100">
                <Mail className="mr-2 h-4 w-4" />
                Portail master
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Historique Email</h1>
              <p className="text-sm text-slate-300">Vue centralisée des envois email plateforme.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/master/security")}>Sécurité MFA</Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher destinataire/sujet"
              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
            <Input
              value={schoolId}
              onChange={(event) => {
                setSchoolId(event.target.value.trim());
                setPage(1);
              }}
              placeholder="Filtre schoolId"
              className="border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
            <select
              className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "" | EmailStatus);
                setPage(1);
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
            </select>
            <select
              className="h-10 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              value={eventType}
              onChange={(event) => {
                setEventType(event.target.value as "" | EmailEventType);
                setPage(1);
              }}
            >
              {eventTypeOptions.map((option) => (
                <option key={option.label} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex justify-end">
            {activeFilterCount > 0 && (
              <Badge variant="outline" className="mr-2 border-amber-400/30 bg-amber-400/10 text-amber-100">
                Filtres actifs: {activeFilterCount}
              </Badge>
            )}
            <Button
              variant="outline"
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
              onClick={clearFilters}
            >
              Effacer les filtres
            </Button>
          </div>
        </section>

        <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
          <CardHeader className="border-b border-white/10">
            <CardTitle>Logs email</CardTitle>
            <CardDescription className="text-slate-400">Total: {pagination.total}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center gap-3 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement des logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-sm text-slate-300">Aucun email trouvé.</div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log._id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={log.status === "sent" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-red-400/30 bg-red-400/10 text-red-100"}>
                          {log.status}
                        </Badge>
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                          {eventTypeLabel(log.eventType)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">{new Date(log.sentAt).toLocaleString("fr-FR")}</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{log.subject}</p>
                    <p className="text-sm text-slate-300">{log.recipientEmail}</p>
                    {log.errorMessage && <p className="mt-1 text-xs text-red-300">{log.errorMessage}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Précédent
              </Button>
              <p className="text-sm text-slate-400">Page {pagination.page} / {pagination.pages}</p>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                disabled={page >= pagination.pages || loading}
                onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}
              >
                Suivant
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MasterEmailHistory;
