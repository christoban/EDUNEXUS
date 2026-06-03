import { useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, Mail, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ClassItem = { id: string; name: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type AcademicPeriod = { id: string; name: string; isCurrent: boolean; academicYearId: string };
type ReadinessResult = {
  canGenerate: boolean;
  totalGrades: number;
  notValidatedCount: number;
  notValidated: { studentName: string; subjectName: string; status: string }[];
};

const AdminReportCards = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
    api.get("/academic-years").then(({ data }) => {
      const ys = data.years || data || [];
      setYears(ys);
      const current = ys.find((y: AcademicYear) => y.isCurrent);
      if (current) setSelectedYear(current.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedYear) return;
    api.get(`/core-domain/periods?academicYearId=${selectedYear}`).then(({ data }) => {
      const ps = data.periods || [];
      setPeriods(ps);
      const current = ps.find((p: AcademicPeriod) => p.isCurrent);
      if (current) setSelectedPeriod(current.id);
    }).catch(() => {});
  }, [selectedYear]);

  const checkReadiness = async () => {
    if (!selectedClass || !selectedPeriod) {
      toast.error("Sélectionne une classe et une période");
      return;
    }
    setCheckLoading(true);
    setReadiness(null);
    try {
      const { data } = await api.get(`/report-cards/check/${selectedClass}`, {
        params: { periodId: selectedPeriod },
      });
      setReadiness(data);
    } catch {
      toast.error("Erreur lors de la vérification");
    } finally {
      setCheckLoading(false);
    }
  };

  const generate = async () => {
    if (!selectedClass || !selectedPeriod || !selectedYear) return;
    setGenerating(true);
    try {
      const { data } = await api.post(`/report-cards/generate/${selectedClass}`, {
        academicYearId: selectedYear,
        academicPeriodId: selectedPeriod,
      });
      toast.success(data.message);
      await checkReadiness();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  const exportZip = async () => {
    if (!selectedClass || !selectedPeriod) return;
    setExporting(true);
    try {
      const response = await api.post(`/report-cards/export/${selectedClass}`, {
        academicPeriodId: selectedPeriod,
      }, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulletins-${selectedPeriod}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("ZIP téléchargé");
    } catch {
      toast.error("Erreur lors de l'export ZIP");
    } finally {
      setExporting(false);
    }
  };

  const sendToParents = async () => {
    if (!selectedClass || !selectedPeriod) return;
    setSending(true);
    try {
      const { data } = await api.post(`/report-cards/send/${selectedClass}`, {
        academicPeriodId: selectedPeriod,
      });
      toast.success(`${data.sent} email(s) envoyé(s)`);
    } catch {
      toast.error("Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Bulletins scolaires</h1>
          <p className="mt-1 text-slate-400">Générer, exporter et envoyer les bulletins par classe</p>
        </div>

        {/* Sélection */}
        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardHeader><CardTitle className="text-base">Sélection</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue placeholder="Année scolaire" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue placeholder="Trimestre / Période" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Vérification */}
        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10">
            <CardTitle className="text-base">Vérification pré-génération</CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
              disabled={checkLoading || !selectedClass || !selectedPeriod}
              onClick={checkReadiness}
            >
              {checkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Vérifier
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {!readiness ? (
              <p className="text-sm text-slate-400">Sélectionne une classe et une période puis clique sur Vérifier.</p>
            ) : readiness.canGenerate ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <p className="font-semibold">Prêt — {readiness.totalGrades} notes validées</p>
                  <p className="text-sm text-emerald-50/80">Les bulletins peuvent être générés.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">
                  <p className="font-semibold">{readiness.notValidatedCount} note(s) non validée(s)</p>
                </div>
                <div className="space-y-1">
                  {readiness.notValidated.slice(0, 10).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-300 text-xs">
                        {item.status}
                      </Badge>
                      {item.studentName} — {item.subjectName}
                    </div>
                  ))}
                  {readiness.notValidated.length > 10 && (
                    <p className="text-xs text-slate-500">... et {readiness.notValidated.length - 10} autres</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-emerald-400 text-black hover:bg-emerald-300"
            disabled={generating || !readiness?.canGenerate}
            onClick={generate}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Générer les bulletins
          </Button>

          <Button
            variant="outline"
            className="border-white/10 bg-transparent text-white hover:bg-white/10"
            disabled={exporting || !selectedClass || !selectedPeriod}
            onClick={exportZip}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter ZIP
          </Button>

          <Button
            variant="outline"
            className="border-white/10 bg-transparent text-white hover:bg-white/10"
            disabled={sending || !selectedClass || !selectedPeriod}
            onClick={sendToParents}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Envoyer aux parents
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminReportCards;
