import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AcademicYear = { id: string; name: string; isCurrent: boolean; status: string };
type Blocker = { type: string; message: string; count?: number };
type CheckResult = {
  canClose: boolean;
  blockers: Blocker[];
  year: { id: string; name: string };
  summary: { totalBlockers: number; unvalidatedGrades: number; missingReportCards: number };
};

const blockerIcons: Record<string, string> = {
  UNVALIDATED_GRADES: "📝",
  MISSING_REPORT_CARDS: "📋",
  MISSING_COUNCIL_SESSIONS: "👥",
};

const AdminYearEnd = () => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    api.get("/academic-years").then(({ data }) => {
      const ys = (data.years || data || []).filter((y: AcademicYear) => y.status !== "ARCHIVED");
      setYears(ys);
      const current = ys.find((y: AcademicYear) => y.isCurrent);
      if (current) setSelectedYear(current.id);
    }).catch(() => {});
  }, []);

  const runCheck = useCallback(async () => {
    if (!selectedYear) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const { data } = await api.post(`/academic-years/${selectedYear}/pre-close-check`);
      setCheckResult(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la vérification");
    } finally {
      setChecking(false);
    }
  }, [selectedYear]);

  const closeYear = async () => {
    if (!selectedYear || !checkResult?.canClose) return;
    if (!confirm(`Clôturer l'année "${checkResult.year.name}" ? Cette action est irréversible.`)) return;
    setClosing(true);
    try {
      const { data } = await api.post(`/academic-years/${selectedYear}/close`);
      toast.success(`Année clôturée — ${data.promoted} promu(s), ${data.repeated} redoublant(s)`);
      setClosed(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la clôture");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Fin d'année scolaire</h1>
          <p className="mt-1 text-slate-400">Vérifier les prérequis et clôturer l'année</p>
        </div>

        {closed ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="text-xl font-bold text-emerald-100">Année clôturée avec succès</h2>
            <p className="text-emerald-50/70 text-sm">Les données sont archivées. Créez la nouvelle année scolaire pour continuer.</p>
          </div>
        ) : (
          <>
            <Card className="border-white/10 bg-slate-900/90 text-white">
              <CardContent className="flex flex-wrap gap-3 pt-6">
                <Select value={selectedYear} onValueChange={(v) => { setSelectedYear(v); setCheckResult(null); }}>
                  <SelectTrigger className="w-64 border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Année scolaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" disabled={checking || !selectedYear} onClick={runCheck}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Vérifier les prérequis
                </Button>
              </CardContent>
            </Card>

            {checkResult && (
              <div className="space-y-4">
                {checkResult.canClose ? (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <div>
                      <p className="font-bold text-emerald-100">Tous les prérequis sont remplis</p>
                      <p className="text-sm text-emerald-50/70">L'année peut être clôturée.</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <XCircle className="h-6 w-6 text-red-400" />
                      <p className="font-bold text-red-100">{checkResult.summary.totalBlockers} blocage(s) à résoudre</p>
                    </div>
                    <div className="space-y-2">
                      {checkResult.blockers.map((blocker, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2">
                          <span className="text-lg">{blockerIcons[blocker.type] ?? "⚠️"}</span>
                          <span className="text-sm text-red-100">{blocker.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Card className="border-white/10 bg-slate-900/90 text-white">
                  <CardHeader><CardTitle className="text-base">Checklist de clôture</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Toutes les notes validées", ok: checkResult.summary.unvalidatedGrades === 0 },
                      { label: "Tous les bulletins générés", ok: checkResult.summary.missingReportCards === 0 },
                      { label: "Conseils de classe tenus et verrouillés", ok: !checkResult.blockers.some((b) => b.type === "MISSING_COUNCIL_SESSIONS") },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        {item.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />}
                        <span className={`text-sm flex-1 ${item.ok ? "text-slate-200" : "text-amber-200"}`}>{item.label}</span>
                        <Badge variant="outline" className={item.ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}>
                          {item.ok ? "OK" : "À compléter"}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
                  <p className="text-sm font-semibold text-red-100">⚠️ Zone de clôture — Action irréversible</p>
                  <Button className="bg-red-500 text-white hover:bg-red-400 w-full" disabled={!checkResult.canClose || closing} onClick={closeYear}>
                    {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Clôturer l'année {checkResult.year.name}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminYearEnd;