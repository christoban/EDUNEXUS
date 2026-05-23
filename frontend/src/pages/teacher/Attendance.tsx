import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Student = { id: string; firstName: string; lastName: string };
type ClassItem = { id: string; name: string };
type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PRESENT: { label: "Présent", color: "bg-emerald-400 hover:bg-emerald-300 text-black", icon: <CheckCircle2 className="h-4 w-4" /> },
  LATE: { label: "Retard", color: "bg-amber-400 hover:bg-amber-300 text-black", icon: <Clock className="h-4 w-4" /> },
  ABSENT: { label: "Absent", color: "bg-red-500 hover:bg-red-400 text-white", icon: <XCircle className="h-4 w-4" /> },
};

const TeacherAttendance = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const initStatuses = (studentList: Student[]) => {
    const initial: Record<string, AttendanceStatus> = {};
    studentList.forEach((s) => { initial[s.id] = "PRESENT"; });
    setStatuses(initial);
  };

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
  }, []);

  const fetchStudents = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    try {
      const { data } = await api.get(`/classes/${selectedClass}/students`);
      const list = data.students || [];
      setStudents(list);
      initStatuses(list);
    } catch {
      toast.error("Impossible de charger les élèves");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (!selectedClass || !date) return;
    api.get("/attendance", { params: { classId: selectedClass, date } })
      .then(({ data }) => {
        const existing = data.records || [];
        if (!existing.length) return;
        const map: Record<string, AttendanceStatus> = { ...statuses };
        existing.forEach((r: any) => {
          if (r.period === selectedPeriod) {
            map[r.studentId] = r.status as AttendanceStatus;
          }
        });
        setStatuses(map);
      })
      .catch(() => {});
  }, [selectedClass, date, selectedPeriod]);

  const toggle = (studentId: string) => {
    setStatuses((prev) => {
      const current = prev[studentId] ?? "PRESENT";
      const next: Record<AttendanceStatus, AttendanceStatus> = {
        PRESENT: "LATE",
        LATE: "ABSENT",
        ABSENT: "PRESENT",
      };
      return { ...prev, [studentId]: next[current] };
    });
  };

  const setAll = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { all[s.id] = status; });
    setStatuses(all);
  };

  const handleSave = async () => {
    if (!selectedClass || !date || !students.length) {
      toast.error("Sélectionne une classe et une date");
      return;
    }
    setSaving(true);
    try {
      const records = students.map((s) => ({
        studentId: s.id,
        status: statuses[s.id] ?? "PRESENT",
        period: selectedPeriod,
      }));
      await api.post("/attendance/mark", {
        classId: selectedClass,
        date,
        period: selectedPeriod,
        records,
      });
      toast.success(`Présences enregistrées — ${records.filter((r) => r.status === "ABSENT").length} absent(s)`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    present: students.filter((s) => (statuses[s.id] ?? "PRESENT") === "PRESENT").length,
    late: students.filter((s) => statuses[s.id] === "LATE").length,
    absent: students.filter((s) => statuses[s.id] === "ABSENT").length,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Prise de présences</h1>
          <p className="mt-1 text-slate-400">Enregistrer les présences par classe et période</p>
        </div>

        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardContent className="grid gap-3 pt-6 md:grid-cols-2 lg:grid-cols-4">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-border bg-background p-2.5 text-foreground"
            />

            <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
              <SelectTrigger className="border-border bg-background text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MORNING">Matin</SelectItem>
                <SelectItem value="AFTERNOON">Après-midi</SelectItem>
              </SelectContent>
            </Select>

            <Button
              className="bg-emerald-400 text-black hover:bg-emerald-300"
              disabled={saving || !students.length}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sauvegarder
            </Button>
          </CardContent>
        </Card>

        {students.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Présents", value: counts.present, color: "text-emerald-300" },
              { label: "Retards", value: counts.late, color: "text-amber-300" },
              { label: "Absents", value: counts.absent, color: "text-red-300" },
            ].map((item) => (
              <Card key={item.label} className="border-white/10 bg-slate-900 text-white">
                <CardContent className="p-4 text-center">
                  <p className="text-xs uppercase tracking-widest text-slate-400">{item.label}</p>
                  <p className={`mt-1 text-3xl font-black ${item.color}`}>{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {students.length > 0 && (
          <div className="flex gap-3">
            <Button size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => setAll("PRESENT")}>
              Tous présents
            </Button>
            <Button size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => setAll("ABSENT")}>
              Tous absents
            </Button>
          </div>
        )}

        {loadingStudents ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement des élèves...
          </div>
        ) : !selectedClass ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Sélectionne une classe pour commencer.
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Aucun élève dans cette classe.
          </div>
        ) : (
          <Card className="border-white/10 bg-slate-900/90 text-white">
            <CardHeader>
              <CardTitle className="text-base">
                {students.length} élève(s) — {selectedPeriod === "MORNING" ? "Matin" : "Après-midi"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {students.map((student, index) => {
                  const status = statuses[student.id] ?? "PRESENT";
                  const config = statusConfig[status];
                  return (
                    <div key={student.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 w-6">{index + 1}</span>
                        <span className="font-medium">{student.lastName} {student.firstName}</span>
                      </div>
                      <button
                        onClick={() => toggle(student.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${config.color}`}
                      >
                        {config.icon}
                        {config.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TeacherAttendance;
