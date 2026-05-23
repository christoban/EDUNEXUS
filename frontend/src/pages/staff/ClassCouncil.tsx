import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Decision = "PASS" | "REPEAT" | "DELIBERATION";
type CouncilDecision = {
  id: string; studentId: string; decision: Decision; observations: string | null;
  student: { id: string; firstName: string; lastName: string };
};
type Session = {
  id: string; status: string; classId: string; academicPeriodId: string;
  class: { id: string; name: string };
  academicPeriod: { id: string; name: string };
  decisions: CouncilDecision[];
};
type ClassItem = { id: string; name: string };
type AcademicPeriod = { id: string; name: string; isCurrent: boolean };
type Student = { id: string; firstName: string; lastName: string };

const decisionConfig: Record<Decision, { label: string; active: string; inactive: string }> = {
  PASS: { label: "Admis", active: "bg-emerald-400 text-black", inactive: "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10" },
  DELIBERATION: { label: "Délibération", active: "bg-amber-400 text-black", inactive: "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10" },
  REPEAT: { label: "Redouble", active: "bg-red-500 text-white", inactive: "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10" },
};

const ClassCouncil = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [locking, setLocking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
    api.get("/core-domain/periods").then(({ data }) => {
      const ps = data.periods || [];
      setPeriods(ps);
      const current = ps.find((p: AcademicPeriod) => p.isCurrent);
      if (current) setSelectedPeriod(current.id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    api.get(`/classes/${selectedClass}/students`).then(({ data }) => setStudents(data.students || [])).catch(() => {});
  }, [selectedClass]);

  const fetchSession = useCallback(async () => {
    if (!selectedClass || !selectedPeriod) return;
    setLoading(true);
    try {
      const { data } = await api.get("/class-councils", { params: { classId: selectedClass, academicPeriodId: selectedPeriod } });
      const found = (data.sessions || [])[0] ?? null;
      if (found) {
        const { data: full } = await api.get(`/class-councils/${found.id}`);
        setSession(full.session);
        const decMap: Record<string, Decision> = {};
        const obsMap: Record<string, string> = {};
        (full.session.decisions || []).forEach((d: CouncilDecision) => {
          decMap[d.studentId] = d.decision;
          obsMap[d.studentId] = d.observations ?? "";
        });
        setDecisions(decMap);
        setObservations(obsMap);
      } else {
        setSession(null);
        setDecisions({});
        setObservations({});
      }
    } catch { setSession(null); }
    finally { setLoading(false); }
  }, [selectedClass, selectedPeriod]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const createSession = async () => {
    setCreating(true);
    try {
      await api.post("/class-councils", { classId: selectedClass, academicPeriodId: selectedPeriod });
      toast.success("Session créée");
      await fetchSession();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setCreating(false); }
  };

  const saveAll = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const bulk = students.map((s) => ({
        studentId: s.id,
        decision: decisions[s.id] ?? "PASS",
        observations: observations[s.id] || null,
      }));
      await api.post(`/class-councils/${session.id}/decisions/bulk`, { decisions: bulk });
      toast.success("Décisions enregistrées");
      await fetchSession();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setSaving(false); }
  };

  const lockSession = async () => {
    if (!session || !confirm("Verrouiller la session ? Aucune modification ne sera possible après.")) return;
    setLocking(true);
    try {
      await api.post(`/class-councils/${session.id}/lock`);
      toast.success("Session verrouillée");
      await fetchSession();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setLocking(false); }
  };

  const downloadReport = async () => {
    if (!session) return;
    setDownloading(true);
    try {
      const response = await api.get(`/class-councils/${session.id}/report`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `conseil-${session.class?.name}-${session.academicPeriod?.name}.pdf`.replace(/\s+/g, "-");
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Erreur lors du téléchargement"); }
    finally { setDownloading(false); }
  };

  const isLocked = session?.status === "LOCKED";
  const passCount = students.filter((s) => (decisions[s.id] ?? "PASS") === "PASS").length;
  const repeatCount = students.filter((s) => decisions[s.id] === "REPEAT").length;
  const deliberationCount = students.filter((s) => decisions[s.id] === "DELIBERATION").length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Conseil de Classe</h1>
            <p className="mt-1 text-slate-400">Saisir les décisions et générer le rapport officiel</p>
          </div>
          {session && (
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" disabled={downloading} onClick={downloadReport}>
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Rapport PDF
              </Button>
              {!isLocked && (
                <>
                  <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" disabled={saving} onClick={saveAll}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Sauvegarder
                  </Button>
                  <Button className="bg-red-500 text-white hover:bg-red-400" disabled={locking} onClick={lockSession}>
                    {locking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Verrouiller
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48 border-border bg-background text-foreground"><SelectValue placeholder="Classe" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48 border-border bg-background text-foreground"><SelectValue placeholder="Période" /></SelectTrigger>
              <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" />Chargement...</div>
        ) : !selectedClass || !selectedPeriod ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">Sélectionne une classe et une période.</div>
        ) : !session ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
            <p className="text-slate-400">Aucune session de Conseil de Classe pour cette classe et période.</p>
            <Button className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={creating} onClick={createSession}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer la session"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="outline" className={isLocked ? "border-red-400/30 bg-red-400/10 text-red-100" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}>
                {isLocked ? "🔒 Verrouillée" : "✏️ En cours"}
              </Badge>
              <div className="flex gap-3 text-sm">
                <span className="text-emerald-300 font-bold">{passCount} admis</span>
                <span className="text-amber-300 font-bold">{deliberationCount} délibération</span>
                <span className="text-red-300 font-bold">{repeatCount} redoublant(s)</span>
              </div>
            </div>

            <Card className="border-white/10 bg-slate-900/90 text-white">
              <CardHeader><CardTitle className="text-base">{session.class?.name} — {session.academicPeriod?.name}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {students.map((student, index) => {
                    const dec = decisions[student.id] ?? "PASS";
                    return (
                      <div key={student.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 flex-wrap">
                        <span className="text-sm text-slate-500 w-6">{index + 1}</span>
                        <span className="font-medium flex-1 min-w-32">{student.lastName} {student.firstName}</span>
                        <div className="flex gap-2">
                          {(["PASS", "DELIBERATION", "REPEAT"] as Decision[]).map((d) => (
                            <button key={d} disabled={isLocked} onClick={() => setDecisions((prev) => ({ ...prev, [student.id]: d }))}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${dec === d ? decisionConfig[d].active : decisionConfig[d].inactive} disabled:opacity-50 disabled:cursor-not-allowed`}>
                              {decisionConfig[d].label}
                            </button>
                          ))}
                        </div>
                        <input type="text" disabled={isLocked} value={observations[student.id] ?? ""}
                          onChange={(e) => setObservations((prev) => ({ ...prev, [student.id]: e.target.value }))}
                          placeholder="Observations..." className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground disabled:opacity-50" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassCouncil;