import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Copy, ExternalLink, Loader2, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CustomPagination from "@/components/global/CustomPagination";
import type {
  SchoolOnboardingRequestSummary,
  SchoolOnboardingRequestsResponse,
  SchoolOnboardingStatus,
} from "@/types";

const PAGE_SIZE = 10;
const STATUS_OPTIONS: Array<{ value: SchoolOnboardingStatus | "all"; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "provisioning", label: "Provisioning" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

const statusTone: Record<SchoolOnboardingStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  approved: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  provisioning: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  rejected: "border-red-400/30 bg-red-400/10 text-red-100",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const SchoolOnboardingRequests = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<SchoolOnboardingRequestSummary[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<SchoolOnboardingStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    limit: PAGE_SIZE,
  });
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const currentPageCounts = useMemo(() => {
    return requests.reduce(
      (accumulator, request) => {
        accumulator.total += 1;
        accumulator[request.onboardingStatus] += 1;
        return accumulator;
      },
      {
        total: 0,
        draft: 0,
        pending: 0,
        approved: 0,
        provisioning: 0,
        active: 0,
        rejected: 0,
      } as Record<SchoolOnboardingStatus | "total", number>
    );
  }, [requests]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));

    if (status !== "all") {
      params.set("status", status);
    }

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    return params.toString();
  }, [debouncedSearch, page, status]);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await api.get<SchoolOnboardingRequestsResponse>(
          `/onboarding/requests?${queryString}`
        );
        setRequests(Array.isArray(data?.requests) ? data.requests : []);
        setPagination(data?.pagination || { total: 0, page, pages: 1, limit: PAGE_SIZE });
      } catch (requestError: any) {
        const message = requestError?.response?.data?.message || "Impossible de charger les demandes d'onboarding.";
        setError(message);
        setRequests([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchRequests();
  }, [queryString, reloadTick]);

  const refresh = () => {
    setRefreshing(true);
    setReloadTick((current) => current + 1);
  };

  const copyInviteLink = async (token?: string | null) => {
    if (!token) return;
    const link = `${window.location.origin}/onboarding/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Lien d'invitation copié.");
  };

  const logoutMaster = async () => {
    try {
      await api.post("/master/auth/logout");
    } catch {
      // Ignore logout errors and still leave the page.
    } finally {
      navigate(MASTER_LOGIN_PATH, { replace: true });
    }
  };

  const handleRequestAction = async (schoolId: string, action: "approve" | "reject") => {
    const password = window.prompt("Confirme ton mot de passe master pour cette action sensible:") || "";
    if (!password.trim()) {
      toast.error("Mot de passe requis.");
      return;
    }

    const code = window.prompt("Entre ton code MFA (6 chiffres) ou un recovery code:") || "";
    if (!code.trim()) {
      toast.error("Code MFA/recovery requis.");
      return;
    }

    try {
      setBusyRequestId(schoolId);
      await api.post(`/onboarding/requests/${schoolId}/${action}`, {
        sensitiveAuth: {
          password,
          code,
        },
      });
      toast.success(action === "approve" ? "Demande approuvée." : "Demande rejetée.");
      setReloadTick((current) => current + 1);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || "Action impossible.";
      toast.error(message);
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit border-white/10 bg-emerald-400/10 text-emerald-100">
                Master admin
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Demandes d'établissement</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Revue des demandes d'onboarding, suivi des statuts et accès rapide aux liens d'activation temporaires.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={refresh}
                disabled={loading || refreshing}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Rafraîchir
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={() => navigate("/master/schools")}
              >
                Établissements
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={() => navigate("/master/security")}
              >
                Sécurité MFA
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                onClick={logoutMaster}
              >
                Déconnexion master
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {[
              { label: "Résultats visibles", value: currentPageCounts.total, tone: "text-white" },
              { label: "Pending", value: currentPageCounts.pending, tone: "text-amber-200" },
              { label: "Approved", value: currentPageCounts.approved, tone: "text-sky-200" },
              { label: "Provisioning", value: currentPageCounts.provisioning, tone: "text-violet-200" },
              { label: "Active", value: currentPageCounts.active, tone: "text-emerald-200" },
              { label: "Rejected", value: currentPageCounts.rejected, tone: "text-red-200" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <Card className="border-white/10 bg-slate-900/90 text-white shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-3 border-b border-white/10">
            <CardTitle>Filtres</CardTitle>
            <CardDescription className="text-slate-400">
              Recherche rapide par école, base, email ou nom d'administrateur.
            </CardDescription>
            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une demande..."
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                />
              </div>
              <Select value={status} onValueChange={(value) => setStatus(value as SchoolOnboardingStatus | "all") }>
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 px-6 py-10 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                Chargement des demandes...
              </div>
            ) : error ? (
              <div className="px-6 py-10 text-sm text-red-200">
                {error}
              </div>
            ) : requests.length === 0 ? (
              <div className="px-6 py-10 text-sm text-slate-300">
                Aucune demande trouvée pour ces filtres.
              </div>
            ) : (
              <div className="overflow-hidden rounded-b-[2rem]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Établissement</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Admin demandé</TableHead>
                      <TableHead>Dernier lien</TableHead>
                      <TableHead>Créée le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const latestInvite = request.latestInvite || null;
                      const inviteToken = latestInvite?.token || null;
                      const inviteUrl = inviteToken ? `${window.location.origin}/onboarding/invite/${inviteToken}` : null;

                      return (
                        <TableRow key={request._id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-semibold text-white">{request.schoolName}</div>
                              <div className="text-xs text-slate-400">{request.dbName}</div>
                              <div className="text-xs text-slate-400">{request.systemType} · {request.structure}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-200">{request.templateKey || "-"}</TableCell>
                          <TableCell>
                            <Badge className={statusTone[request.onboardingStatus]} variant="outline">
                              {request.onboardingStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-slate-100">{request.requestedAdminName || "-"}</div>
                              <div className="text-xs text-slate-400">{request.requestedAdminEmail || "-"}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs text-slate-300">
                              <div>{latestInvite ? latestInvite.status : "-"}</div>
                              <div>{latestInvite ? formatDateTime(latestInvite.expiresAt) : "-"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-300">{formatDateTime(request.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {request.onboardingStatus !== "active" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-400 text-black hover:bg-emerald-300"
                                    disabled={busyRequestId === request._id}
                                    onClick={() => handleRequestAction(request._id, "approve")}
                                  >
                                    {busyRequestId === request._id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Approuver"
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={busyRequestId === request._id}
                                    onClick={() => handleRequestAction(request._id, "reject")}
                                  >
                                    {busyRequestId === request._id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Rejeter"
                                    )}
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                                disabled={!inviteToken}
                                onClick={() => copyInviteLink(inviteToken)}
                              >
                                <Copy className="h-4 w-4" />
                                Copier
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-white/10 bg-transparent text-white hover:bg-white/10"
                                disabled={!inviteUrl}
                                onClick={() => {
                                  if (inviteUrl) {
                                    window.open(inviteUrl, "_blank", "noopener,noreferrer");
                                  }
                                }}
                              >
                                <ExternalLink className="h-4 w-4" />
                                Ouvrir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <CustomPagination
                  loading={loading || refreshing}
                  page={pagination.page}
                  setPage={setPage}
                  totalPages={pagination.pages}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SchoolOnboardingRequests;
