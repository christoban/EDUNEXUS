import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Building2, Copy, Eye, Loader2, RefreshCcw, Search, ShieldCheck, Sparkles } from "lucide-react";
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
import type { MasterSchoolSummary, SchoolOnboardingStatus } from "@/types";

const statusOptions: Array<{ value: SchoolOnboardingStatus | "all"; label: string }> = [
  { value: "all", label: "Tous les statuts" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "provisioning", label: "Provisioning" },
  { value: "active", label: "Active" },
  { value: "rejected", label: "Rejected" },
];

const toneByStatus: Record<SchoolOnboardingStatus, string> = {
  draft: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  approved: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  provisioning: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  rejected: "border-red-400/30 bg-red-400/10 text-red-100",
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const MasterSchools = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<MasterSchoolSummary[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SchoolOnboardingStatus | "all">("all");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setLoading(true);
        const { data } = await api.get<{ schools: MasterSchoolSummary[] }>("/master/schools");
        setSchools(Array.isArray(data?.schools) ? data.schools : []);
      } catch (error: any) {
        const message = error?.response?.data?.message || "Impossible de charger les écoles.";
        toast.error(message);
        setSchools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, [reloadTick]);

  const filteredSchools = useMemo(() => {
    const query = search.trim().toLowerCase();
    return schools.filter((school) => {
      const matchesStatus = status === "all" || school.onboardingStatus === status;
      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        school.schoolName,
        school.dbName,
        school.systemType,
        school.structure,
        school.requestedAdminName,
        school.requestedAdminEmail,
        school.location,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [schools, search, status]);

  const counts = useMemo(() => {
    return filteredSchools.reduce(
      (accumulator, school) => {
        accumulator.total += 1;
        accumulator[school.onboardingStatus] += 1;
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
  }, [filteredSchools]);

  const copyDbName = async (dbName: string) => {
    await navigator.clipboard.writeText(dbName);
    toast.success("Nom de base copié.");
  };

  const logout = async () => {
    try {
      await api.post("/master/auth/logout");
    } catch {
      // Ignore logout errors.
    } finally {
      navigate(MASTER_LOGIN_PATH, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary" className="w-fit border-white/10 bg-sky-400/10 text-sky-100">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Portail master
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Établissements</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                Inventaire des écoles connectées à la plateforme, avec accès direct au tenant, aux statuts d'onboarding et à l'identifiant de base.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => setReloadTick((value) => value + 1)}>
                <RefreshCcw className="h-4 w-4" />
                Actualiser
              </Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/master/onboarding/requests")}>Demandes</Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/master/security")}>Sécurité MFA</Button>
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={logout}>Déconnexion</Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {[
              { label: "Visibles", value: counts.total, tone: "text-white" },
              { label: "Active", value: counts.active, tone: "text-emerald-200" },
              { label: "Approved", value: counts.approved, tone: "text-sky-200" },
              { label: "Pending", value: counts.pending, tone: "text-amber-200" },
              { label: "Provisioning", value: counts.provisioning, tone: "text-violet-200" },
              { label: "Rejected", value: counts.rejected, tone: "text-red-200" },
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
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Liste des écoles</CardTitle>
            <CardDescription className="text-slate-400">
              Recherche locale, filtre de statut et copie rapide du nom de base.
            </CardDescription>
            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une école..."
                  className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                />
              </div>
              <Select value={status} onValueChange={(value) => setStatus(value as SchoolOnboardingStatus | "all") }>
                <SelectTrigger className="w-full border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
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
                Chargement des écoles...
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="px-6 py-10 text-sm text-slate-300">Aucune école trouvée pour ces filtres.</div>
            ) : (
              <div className="overflow-hidden rounded-b-[2rem]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>École</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Créée le</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSchools.map((school) => (
                          <TableRow
                            key={school._id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/master/schools/${school._id}`)}
                          >
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-white">{school.schoolName}</div>
                            <div className="text-xs text-slate-400">{school.schoolMotto}</div>
                            <div className="text-xs text-slate-500">{school.location || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-slate-300">
                            <div>{school.dbName}</div>
                            <div>{school.foundedYear || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={toneByStatus[school.onboardingStatus]} variant="outline">
                            {school.onboardingStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-slate-300">
                            <div>{school.requestedAdminName || "-"}</div>
                            <div>{school.requestedAdminEmail || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-slate-300">
                            <div>{school.systemType}</div>
                            <div>{school.structure}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs text-slate-300">
                            <div>{school.contactEmail || "-"}</div>
                            <div>{school.contactPhone || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">{formatDate(school.createdAt)}</TableCell>
                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10 bg-transparent text-white hover:bg-white/10"
                              onClick={() => navigate(`/master/schools/${school._id}`)}
                            >
                              <Eye className="h-4 w-4" />
                              Ouvrir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10 bg-transparent text-white hover:bg-white/10"
                              onClick={() => copyDbName(school.dbName)}
                            >
                              <Copy className="h-4 w-4" />
                              Copier
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MasterSchools;
