import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusStats = {
  total: number;
  DRAFT: number;
  SUBMITTED: number;
  VALIDATED: number;
  LOCKED: number;
  REJECTED: number;
};

type ClassItem = { id: string; name: string };
type AcademicSequence = { id: string; name: string; isCurrent: boolean };

const GradeStatus = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sequences, setSequences] = useState<AcademicSequence[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSequence, setSelectedSequence] = useState("");
  const [stats, setStats] = useState<StatusStats | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
    api.get("/academic-years/sequences").then(({ data }) => {
      const seqs = data.sequences || data || [];
      setSequences(seqs);
      const current = seqs.find((s: AcademicSequence) => s.isCurrent);
      if (current) setSelectedSequence(current.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass || !selectedSequence) return;
    setLoading(true);
    api.get(`/grades/status/${selectedClass}`, { params: { sequenceId: selectedSequence } })
      .then(({ data }) => {
        setStats(data.stats);
        setCanGenerate(data.canGenerateReportCard);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedClass, selectedSequence]);

  const pct = (n: number) => stats?.total ? Math.round((n / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Statut des notes</h1>
          <p className="mt-1 text-slate-400">Vue globale de l'avancement de saisie par classe</p>
        </div>

        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Select value={selectedSequence} onValueChange={setSelectedSequence}>
              <SelectTrigger className="w-48 border-border bg-background text-foreground">
                <SelectValue placeholder="Séquence" />
              </SelectTrigger>
              <SelectContent>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48 border-border bg-background text-foreground">
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : !stats ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Sélectionne une séquence et une classe.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bulletin générable ? */}
            <div className={`rounded-2xl border p-4 ${canGenerate
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
              : "border-amber-400/30 bg-amber-400/10 text-amber-100"
            }`}>
              {canGenerate ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold">Toutes les notes sont validées — bulletin générable</span>
                </div>
              ) : (
                <span className="font-semibold">
                  {stats.DRAFT + stats.SUBMITTED + stats.REJECTED} note(s) non encore validées — bulletin non générable
                </span>
              )}
            </div>

            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Total", value: stats.total, color: "text-white" },
                { label: "Brouillon", value: stats.DRAFT, color: "text-slate-300" },
                { label: "Soumis", value: stats.SUBMITTED, color: "text-amber-300" },
                { label: "Validé", value: stats.VALIDATED, color: "text-emerald-300" },
                { label: "Rejeté", value: stats.REJECTED, color: "text-red-300" },
              ].map((item) => (
                <Card key={item.label} className="border-white/10 bg-slate-900 text-white">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">{item.label}</p>
                    <p className={`mt-1 text-3xl font-black ${item.color}`}>{item.value}</p>
                    {item.label !== "Total" && (
                      <p className="text-xs text-slate-500">{pct(item.value)}%</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Barre de progression */}
            <Card className="border-white/10 bg-slate-900/90 text-white">
              <CardHeader>
                <CardTitle className="text-base">Progression de validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Validées", value: stats.VALIDATED + stats.LOCKED, color: "bg-emerald-400" },
                  { label: "En attente", value: stats.SUBMITTED, color: "bg-amber-400" },
                  { label: "Brouillon", value: stats.DRAFT, color: "bg-slate-500" },
                  { label: "Rejetées", value: stats.REJECTED, color: "bg-red-400" },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.label}</span>
                      <span className="text-slate-400">{item.value} ({pct(item.value)}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full ${item.color} transition-all`}
                        style={{ width: `${pct(item.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeStatus;
