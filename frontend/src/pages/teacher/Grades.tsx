import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, Clock, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ValidationStatus = "DRAFT" | "SUBMITTED" | "VALIDATED" | "LOCKED" | "REJECTED";

type Grade = {
  id: string;
  studentId: string;
  subjectId: string;
  sequenceId: string;
  sequenceScore: number | null;
  classTestScore: number | null;
  terminalExamScore: number | null;
  theoreticalScore: number | null;
  practicalScore: number | null;
  sequenceAverage: number | null;
  maxValue: number;
  coefficient: number;
  validationStatus: ValidationStatus;
  rejectionReason: string | null;
  student: { id: string; firstName: string; lastName: string };
  subject: { id: string; name: string; code: string | null; coefficient: number };
};

type Subject = { id: string; name: string; code: string | null };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type AcademicPeriod = { id: string; name: string; isCurrent: boolean };
type AcademicSequence = { id: string; name: string; isCurrent: boolean; academicPeriodId: string };
type ClassItem = { id: string; name: string };
type Student = { id: string; firstName: string; lastName: string };

const statusConfig: Record<ValidationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: "Brouillon", color: "border-slate-500/30 bg-slate-500/10 text-slate-200", icon: <Clock className="h-3 w-3" /> },
  SUBMITTED: { label: "Soumis", color: "border-amber-400/30 bg-amber-400/10 text-amber-100", icon: <Send className="h-3 w-3" /> },
  VALIDATED: { label: "Validé", color: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100", icon: <CheckCircle2 className="h-3 w-3" /> },
  LOCKED: { label: "Verrouillé", color: "border-sky-400/30 bg-sky-400/10 text-sky-100", icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED: { label: "Rejeté", color: "border-red-400/30 bg-red-400/10 text-red-100", icon: <XCircle className="h-3 w-3" /> },
};

const scoreColor = (score: number | null, max: number) => {
  if (score === null) return "text-slate-400";
  const ratio = score / max;
  if (ratio >= 0.7) return "text-emerald-400";
  if (ratio >= 0.5) return "text-amber-400";
  return "text-red-400";
};

const TeacherGrades = () => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [sequences, setSequences] = useState<AcademicSequence[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  const [selectedYear, setSelectedYear] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedSequence, setSelectedSequence] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  // Scores locaux (avant sauvegarde)
  const [localScores, setLocalScores] = useState<Record<string, Partial<Grade>>>({});

  // Charger les années scolaires
  useEffect(() => {
    api.get("/academic-years").then(({ data }) => {
      setYears(data.years || data || []);
      const current = (data.years || data || []).find((y: AcademicYear) => y.isCurrent);
      if (current) setSelectedYear(current.id);
    }).catch(() => {});
  }, []);

  // Charger les périodes quand l'année change
  useEffect(() => {
    if (!selectedYear) return;
    api.get(`/core-domain/periods?academicYearId=${selectedYear}`).then(({ data }) => {
      setPeriods(data.periods || []);
      const current = (data.periods || []).find((p: AcademicPeriod) => p.isCurrent);
      if (current) setSelectedPeriod(current.id);
    }).catch(() => {});
  }, [selectedYear]);

  // Charger les séquences quand la période change
  useEffect(() => {
    if (!selectedPeriod) return;
    api.get(`/academic-years/sequences?academicPeriodId=${selectedPeriod}`).then(({ data }) => {
      setSequences(data.sequences || data || []);
      const current = (data.sequences || data || []).find((s: AcademicSequence) => s.isCurrent);
      if (current) setSelectedSequence(current.id);
    }).catch(() => {});
  }, [selectedPeriod]);

  // Charger les classes et matières
  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
    api.get("/subjects").then(({ data }) => setSubjects(data.subjects || [])).catch(() => {});
  }, []);

  // Charger les élèves de la classe sélectionnée
  useEffect(() => {
    if (!selectedClass) return;
    api.get(`/classes/${selectedClass}/students`).then(({ data }) => {
      setStudents(data.students || []);
    }).catch(() => {});
  }, [selectedClass]);

  // Charger les notes
  const fetchGrades = useCallback(async () => {
    if (!selectedSequence || !selectedClass || !selectedSubject) return;
    setLoading(true);
    try {
      const { data } = await api.get("/grades", {
        params: {
          sequenceId: selectedSequence,
          classId: selectedClass,
          subjectId: selectedSubject,
          limit: 100,
        },
      });
      setGrades(data.grades || []);
      setLocalScores({});
    } catch {
      toast.error("Impossible de charger les notes");
    } finally {
      setLoading(false);
    }
  }, [selectedSequence, selectedClass, selectedSubject]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const getGradeForStudent = (studentId: string) =>
    grades.find((g) => g.studentId === studentId) || null;

  const getLocalScore = (studentId: string) =>
    localScores[studentId] || {};

  const handleScoreChange = (studentId: string, field: string, value: string) => {
    setLocalScores((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value === "" ? null : Number(value) },
    }));
  };

  const saveGrade = async (studentId: string) => {
    if (!selectedSequence || !selectedClass || !selectedSubject || !selectedYear) return;

    const local = getLocalScore(studentId);
    const existing = getGradeForStudent(studentId);

    if (Object.keys(local).length === 0) return;

    setSaving((prev) => ({ ...prev, [studentId]: true }));
    try {
      const payload = {
        studentId,
        subjectId: selectedSubject,
        classId: selectedClass,
        academicYearId: selectedYear,
        sequenceId: selectedSequence,
        ...local,
      };

      if (existing) {
        await api.put(`/grades/${existing.id}`, payload);
      } else {
        await api.post("/grades", payload);
      }

      toast.success("Note sauvegardée");
      await fetchGrades();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const submitGrade = async (studentId: string) => {
    const existing = getGradeForStudent(studentId);
    if (!existing) {
      toast.error("Sauvegarde la note d'abord");
      return;
    }

    setSubmitting((prev) => ({ ...prev, [studentId]: true }));
    try {
      await api.post(`/grades/${existing.id}/submit`);
      toast.success("Note soumise pour validation");
      await fetchGrades();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la soumission");
    } finally {
      setSubmitting((prev) => ({ ...prev, [studentId]: false }));
    }
  };

  const canEdit = (studentId: string) => {
    const grade = getGradeForStudent(studentId);
    if (!grade) return true;
    return grade.validationStatus === "DRAFT" || grade.validationStatus === "REJECTED";
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Saisie des notes</h1>
          <p className="mt-1 text-slate-400">Saisir, modifier et soumettre les notes pour validation</p>
        </div>

        {/* Filtres */}
        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardHeader>
            <CardTitle className="text-base">Sélection</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Année scolaire" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Trimestre / Term" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSequence} onValueChange={setSelectedSequence}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Séquence" />
              </SelectTrigger>
              <SelectContent>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Matière" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table des notes */}
        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : !selectedSequence || !selectedClass || !selectedSubject ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Sélectionne une séquence, une classe et une matière pour afficher les notes.
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Aucun élève dans cette classe.
          </div>
        ) : (
          <Card className="border-white/10 bg-slate-900/90 text-white">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/10">
                    <tr>
                      <th className="p-4 text-left text-sm font-semibold text-slate-400">Élève</th>
                      <th className="p-4 text-center text-sm font-semibold text-slate-400">Note /20</th>
                      <th className="p-4 text-center text-sm font-semibold text-slate-400">Moyenne</th>
                      <th className="p-4 text-center text-sm font-semibold text-slate-400">Statut</th>
                      <th className="p-4 text-right text-sm font-semibold text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map((student) => {
                      const grade = getGradeForStudent(student.id);
                      const local = getLocalScore(student.id);
                      const editable = canEdit(student.id);
                      const status = grade?.validationStatus ?? "DRAFT";
                      const statusInfo = statusConfig[status];
                      const hasLocalChanges = Object.keys(local).length > 0;

                      return (
                        <tr key={student.id} className="hover:bg-white/5">
                          <td className="p-4">
                            <span className="font-medium text-white">
                              {student.lastName} {student.firstName}
                            </span>
                            {grade?.rejectionReason && (
                              <p className="mt-1 text-xs text-red-300">
                                Rejeté : {grade.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <Input
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              disabled={!editable}
                              value={
                                local.sequenceScore !== undefined
                                  ? (local.sequenceScore ?? "")
                                  : (grade?.sequenceScore ?? "")
                              }
                              onChange={(e) => handleScoreChange(student.id, "sequenceScore", e.target.value)}
                              className="mx-auto w-24 border-white/10 bg-white/5 text-center text-white disabled:opacity-50"
                              placeholder="—"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <span className={`text-lg font-bold ${scoreColor(grade?.sequenceAverage ?? null, 20)}`}>
                              {grade?.sequenceAverage !== null && grade?.sequenceAverage !== undefined
                                ? grade.sequenceAverage.toFixed(2)
                                : "—"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <Badge className={`inline-flex items-center gap-1 ${statusInfo.color}`} variant="outline">
                              {statusInfo.icon}
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              {editable && hasLocalChanges && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-white/10 bg-transparent text-white hover:bg-white/10"
                                  disabled={saving[student.id]}
                                  onClick={() => saveGrade(student.id)}
                                >
                                  {saving[student.id] ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : "Sauvegarder"}
                                </Button>
                              )}
                              {grade && status === "DRAFT" && (
                                <Button
                                  size="sm"
                                  className="bg-amber-400 text-black hover:bg-amber-300"
                                  disabled={submitting[student.id]}
                                  onClick={() => submitGrade(student.id)}
                                >
                                  {submitting[student.id] ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <><Send className="h-3 w-3" />Soumettre</>
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TeacherGrades;
