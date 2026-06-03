import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Grade = {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  sequenceAverage: number | null;
  maxValue: number;
  validationStatus: string;
  student: { id: string; firstName: string; lastName: string };
  subject: { id: string; name: string; code: string | null };
  class: { id: string; name: string };
  recordedBy: { id: string; firstName: string; lastName: string } | null;
};

type ClassItem = { id: string; name: string };
type Subject = { id: string; name: string };
type AcademicSequence = { id: string; name: string; isCurrent: boolean };

const GradeValidation = () => {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Record<string, Grade[]>>>({});
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sequences, setSequences] = useState<AcademicSequence[]>([]);

  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedSequence, setSelectedSequence] = useState("");

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; gradeId: string | null }>({ open: false, gradeId: null });
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
    api.get("/subjects").then(({ data }) => setSubjects(data.subjects || [])).catch(() => {});
    api.get("/academic-years/sequences").then(({ data }) => {
      const seqs = data.sequences || data || [];
      setSequences(seqs);
      const current = seqs.find((s: AcademicSequence) => s.isCurrent);
      if (current) setSelectedSequence(current.id);
    }).catch(() => {});
  }, []);

  const fetchPending = async () => {
    if (!selectedSequence) return;
    setLoading(true);
    try {
      const params: any = { sequenceId: selectedSequence };
      if (selectedClass !== "all") params.classId = selectedClass;
      if (selectedSubject !== "all") params.subjectId = selectedSubject;

      const { data } = await api.get("/grades/pending", { params });
      setGrades(data.grades || []);
      setGrouped(data.grouped || {});
    } catch {
      toast.error("Impossible de charger les notes en attente");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [selectedSequence, selectedClass, selectedSubject]);

  const handleValidate = async (gradeId: string) => {
    setProcessing((prev) => ({ ...prev, [gradeId]: true }));
    try {
      await api.post(`/grades/${gradeId}/validate`);
      toast.success("Note validée");
      await fetchPending();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally {
      setProcessing((prev) => ({ ...prev, [gradeId]: false }));
    }
  };

  const handleBulkValidate = async (classId: string, subjectId?: string) => {
    const key = `bulk-${classId}-${subjectId ?? "all"}`;
    setProcessing((prev) => ({ ...prev, [key]: true }));
    try {
      await api.post("/grades/bulk-validate", {
        sequenceId: selectedSequence,
        classId,
        ...(subjectId ? { subjectId } : {}),
      });
      toast.success("Validation en bloc effectuée");
      await fetchPending();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally {
      setProcessing((prev) => ({ ...prev, [key]: false }));
    }
  };

  const openRejectDialog = (gradeId: string) => {
    setRejectDialog({ open: true, gradeId });
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectDialog.gradeId || !rejectReason.trim()) {
      toast.error("Le motif est obligatoire");
      return;
    }
    setProcessing((prev) => ({ ...prev, [rejectDialog.gradeId!]: true }));
    try {
      await api.post(`/grades/${rejectDialog.gradeId}/reject`, { reason: rejectReason });
      toast.success("Note rejetée");
      setRejectDialog({ open: false, gradeId: null });
      setRejectReason("");
      await fetchPending();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally {
      setProcessing((prev) => ({ ...prev, [rejectDialog.gradeId!]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Validation des notes</h1>
          <p className="mt-1 text-slate-400">
            {grades.length} note(s) en attente de validation
          </p>
        </div>

        {/* Filtres */}
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
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-48 border-border bg-background text-foreground">
                <SelectValue placeholder="Toutes les matières" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les matières</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : grades.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Aucune note en attente de validation.
          </div>
        ) : (
          Object.entries(grouped).map(([classId, bySubject]) => {
            const className = grades.find((g) => g.classId === classId)?.class?.name ?? classId;
            return (
              <Card key={classId} className="border-white/10 bg-slate-900/90 text-white">
                <CardHeader className="flex flex-row items-center justify-between border-b border-white/10">
                  <CardTitle>{className}</CardTitle>
                  <Button
                    size="sm"
                    className="bg-emerald-400 text-black hover:bg-emerald-300"
                    disabled={processing[`bulk-${classId}-all`]}
                    onClick={() => handleBulkValidate(classId)}
                  >
                    {processing[`bulk-${classId}-all`] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" />Valider toute la classe</>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {Object.entries(bySubject).map(([subjectId, subjectGrades]) => {
                    const subjectName = subjectGrades[0]?.subject?.name ?? subjectId;
                    return (
                      <div key={subjectId} className="border-b border-white/10 last:border-0">
                        <div className="flex items-center justify-between px-6 py-3 bg-white/5">
                          <span className="font-semibold text-slate-200">{subjectName}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-white/10 bg-transparent text-white hover:bg-white/10"
                            disabled={processing[`bulk-${classId}-${subjectId}`]}
                            onClick={() => handleBulkValidate(classId, subjectId)}
                          >
                            Valider cette matière
                          </Button>
                        </div>
                        <table className="w-full">
                          <tbody className="divide-y divide-white/5">
                            {subjectGrades.map((grade) => (
                              <tr key={grade.id} className="hover:bg-white/5">
                                <td className="px-6 py-3 font-medium">
                                  {grade.student.lastName} {grade.student.firstName}
                                </td>
                                <td className="px-6 py-3 text-center">
                                  <span className="text-lg font-bold text-emerald-400">
                                    {grade.sequenceAverage?.toFixed(2) ?? "—"} / {grade.maxValue}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-400">
                                  Saisi par {grade.recordedBy
                                    ? `${grade.recordedBy.firstName} ${grade.recordedBy.lastName}`
                                    : "—"}
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-400 text-black hover:bg-emerald-300"
                                      disabled={processing[grade.id]}
                                      onClick={() => handleValidate(grade.id)}
                                    >
                                      {processing[grade.id] ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <><CheckCircle2 className="h-3 w-3" />Valider</>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={processing[grade.id]}
                                      onClick={() => openRejectDialog(grade.id)}
                                    >
                                      <XCircle className="h-3 w-3" />
                                      Rejeter
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog rejet */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, gradeId: null })}>
        <DialogContent className="border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>Motif de rejet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-400">
              Le motif sera affiché à l'enseignant. Il est obligatoire.
            </p>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Note manquante pour l'élève X"
              className="border-border bg-background text-foreground"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/10 bg-transparent text-white"
              onClick={() => setRejectDialog({ open: false, gradeId: null })}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || processing[rejectDialog.gradeId ?? ""]}
              onClick={handleReject}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GradeValidation;
