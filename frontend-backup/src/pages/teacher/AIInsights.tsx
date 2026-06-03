import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Loader2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StudentHealth = {
  studentId: string;
  name: string;
  className: string;
  healthScore: number;
  alertLevel: "critical" | "warning" | "recommendation" | "good" | "excellent";
};

type Summary = {
  critical: number;
  warning: number;
  recommendation: number;
  good: number;
  excellent: number;
};

const alertConfig = {
  critical:       { label: "Critique",      color: "text-red-500",     bg: "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-300",          icon: <AlertTriangle className="h-4 w-4" /> },
  warning:        { label: "Préoccupant",   color: "text-orange-500",  bg: "border-orange-400/30 bg-orange-400/10 text-orange-700 dark:text-orange-300", icon: <TrendingDown className="h-4 w-4" /> },
  recommendation: { label: "À surveiller", color: "text-amber-500",   bg: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",   icon: <Brain className="h-4 w-4" /> },
  good:           { label: "Bien",          color: "text-sky-500",     bg: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300",           icon: <CheckCircle2 className="h-4 w-4" /> },
  excellent:      { label: "Excellent",     color: "text-emerald-500", bg: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300", icon: <TrendingUp className="h-4 w-4" /> },
};

const TeacherAIInsights = () => {
  const [students, setStudents] = useState<StudentHealth[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<any | null>(null);
  const [analyzingRisk, setAnalyzingRisk] = useState(false);
  const [filterLevel, setFilterLevel] = useState("all");
  const [aiInsight, setAiInsight] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
  }, []);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ai/students-health", {
        params: selectedClass !== "all" ? { classId: selectedClass } : {},
      });
      setStudents(data.students || []);
      setSummary(data.summary || null);
    } catch { toast.error("Erreur de chargement"); }
    finally { setLoading(false); }
  }, [selectedClass]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const analyzeRisk = async (studentId: string) => {
    setSelectedStudent(studentId);
    setAnalyzingRisk(true);
    setRiskAnalysis(null);
    try {
      const { data } = await api.get(`/ai/risk-detection/${studentId}`);
      setRiskAnalysis(data);
    } catch { toast.error("Erreur analyse de risque"); }
    finally { setAnalyzingRisk(false); }
  };

  const getInsight = async () => {
    setInsightLoading(true);
    try {
      const { data } = await api.post("/ai/generate-insight");
      setAiInsight(data.insight);
    } catch { toast.error("Erreur génération insight"); }
    finally { setInsightLoading(false); }
  };

  const filtered = students.filter((s) => filterLevel === "all" || s.alertLevel === filterLevel);

  const scoreColor = (score: number) => {
    if (score <= 30) return "text-red-500";
    if (score <= 50) return "text-orange-500";
    if (score <= 70) return "text-amber-500";
    if (score <= 85) return "text-sky-500";
    return "text-emerald-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Artificielle</h1>
          <p className="text-muted-foreground mt-1">Tableau de bord IA — Suivi santé scolaire des élèves</p>
        </div>
        <Button onClick={getInsight} disabled={insightLoading} variant="outline">
          {insightLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          Insight IA
        </Button>
      </div>

      {/* Insight IA */}
      {aiInsight && (
        <Card className="border-violet-400/30 bg-violet-400/5">
          <CardContent className="p-4 flex gap-3">
            <Brain className="h-5 w-5 text-violet-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{aiInsight}</p>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          {(Object.entries(alertConfig) as [keyof typeof alertConfig, typeof alertConfig[keyof typeof alertConfig]][]).map(([level, cfg]) => (
            <Card key={level} className="cursor-pointer" onClick={() => setFilterLevel(filterLevel === level ? "all" : level)}>
              <CardContent className="p-4 text-center">
                <div className={`flex justify-center mb-2 ${cfg.color}`}>{cfg.icon}</div>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className={`text-2xl font-black mt-1 ${cfg.color}`}>{summary[level]}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtre classe */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Liste élèves */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />Élèves ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 p-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />Calcul des indices...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Aucun élève trouvé.</div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {filtered.map((s) => {
                  const cfg = alertConfig[s.alertLevel];
                  return (
                    <div
                      key={s.studentId}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 cursor-pointer ${selectedStudent === s.studentId ? "bg-muted" : ""}`}
                      onClick={() => analyzeRisk(s.studentId)}
                    >
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.className}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cfg.bg}>{cfg.label}</Badge>
                        <span className={`text-lg font-black ${scoreColor(s.healthScore)}`}>{s.healthScore}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analyse de risque */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4" />Analyse de risque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedStudent ? (
              <div className="p-8 text-center text-muted-foreground">
                Clique sur un élève pour voir son analyse de risque.
              </div>
            ) : analyzingRisk ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />Analyse en cours...
              </div>
            ) : riskAnalysis ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{riskAnalysis.studentName}</h3>
                  <Badge variant="outline" className={
                    riskAnalysis.riskLevel === "high"
                      ? "border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-300"
                      : riskAnalysis.riskLevel === "medium"
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300"
                      : "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                  }>
                    Risque {riskAnalysis.riskLevel === "high" ? "élevé" : riskAnalysis.riskLevel === "medium" ? "moyen" : "faible"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Moyenne</p>
                    <p className={`text-xl font-black ${Number(riskAnalysis.avgGrade) >= 10 ? "text-emerald-500" : "text-red-500"}`}>
                      {riskAnalysis.avgGrade}/20
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Présence</p>
                    <p className={`text-xl font-black ${Number(riskAnalysis.attendanceRate) >= 80 ? "text-emerald-500" : "text-red-500"}`}>
                      {riskAnalysis.attendanceRate}%
                    </p>
                  </div>
                </div>
                {riskAnalysis.weakSubjects?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">MATIÈRES EN DIFFICULTÉ</p>
                    <div className="flex flex-wrap gap-2">
                      {riskAnalysis.weakSubjects.map((s: string) => (
                        <Badge key={s} variant="outline" className="border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-300">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">ANALYSE IA</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{riskAnalysis.analysis}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherAIInsights;
