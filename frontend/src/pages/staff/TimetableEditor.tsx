import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Slot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: string;
  subject: { id: string; name: string; code: string | null } | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
  subGroup: { id: string; name: string } | null;
};

type Timetable = {
  id: string;
  status: string;
  slots: Slot[];
  class: { id: string; name: string };
  academicYear: { id: string; name: string };
};

type ClassItem = { id: string; name: string };
type AcademicYear = { id: string; name: string; isCurrent: boolean };
type Subject = { id: string; name: string; code: string | null };
type Teacher = { id: string; firstName: string; lastName: string };

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAY_COLORS = [
  "border-sky-400/20 bg-sky-400/5",
  "border-violet-400/20 bg-violet-400/5",
  "border-emerald-400/20 bg-emerald-400/5",
  "border-amber-400/20 bg-amber-400/5",
  "border-pink-400/20 bg-pink-400/5",
  "border-slate-400/20 bg-slate-400/5",
];

const kindColors: Record<string, string> = {
  CLASS: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  BREAK: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  ACTIVITY: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  TD: "border-amber-400/30 bg-amber-400/10 text-amber-100",
};

const TimetableEditor = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [addDialog, setAddDialog] = useState(false);
  const [slotForm, setSlotForm] = useState({
    dayOfWeek: "0",
    startTime: "07:30",
    endTime: "09:00",
    subjectId: "",
    teacherId: "",
    room: "",
    kind: "CLASS",
    subGroupId: "",
  });
  const [addingSlot, setAddingSlot] = useState(false);
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null);

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
    api.get("/academic-years").then(({ data }) => {
      const ys = data.years || data || [];
      setYears(ys);
      const current = ys.find((y: AcademicYear) => y.isCurrent);
      if (current) setSelectedYear(current.id);
    }).catch(() => {});
    api.get("/subjects").then(({ data }) => setSubjects(data.subjects || data || [])).catch(() => {});
    api.get("/users?role=TEACHER&limit=100").then(({ data }) => {
      setTeachers((data.users || []).map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })));
    }).catch(() => {});
  }, []);

  const fetchTimetable = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/timetables/${selectedClass}/full`);
      setTimetable(data.timetable);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setTimetable(null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  const createTimetable = async () => {
    if (!selectedClass || !selectedYear) {
      toast.error("Sélectionne une classe et une année");
      return;
    }
    try {
      await api.post("/timetables/manual", { classId: selectedClass, academicYearId: selectedYear });
      toast.success("EDT créé");
      await fetchTimetable();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    }
  };

  const handleAddSlot = async () => {
    if (!timetable) return;
    if (!slotForm.startTime || !slotForm.endTime) {
      toast.error("Heure de début et fin requises");
      return;
    }

    setAddingSlot(true);
    try {
      await api.post(`/timetables/${timetable.id}/slots`, {
        dayOfWeek: Number(slotForm.dayOfWeek),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        subjectId: slotForm.subjectId || null,
        teacherId: slotForm.teacherId || null,
        room: slotForm.room || null,
        kind: slotForm.kind,
        subGroupId: slotForm.subGroupId || null,
      });
      toast.success("Créneau ajouté");
      setAddDialog(false);
      setSlotForm({ dayOfWeek: "0", startTime: "07:30", endTime: "09:00", subjectId: "", teacherId: "", room: "", kind: "CLASS", subGroupId: "" });
      await fetchTimetable();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erreur";
      if (err?.response?.data?.conflict) {
        toast.error(`⚠️ ${msg}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!timetable) return;
    setDeletingSlot(slotId);
    try {
      await api.delete(`/timetables/${timetable.id}/slots/${slotId}`);
      toast.success("Créneau supprimé");
      await fetchTimetable();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeletingSlot(null);
    }
  };

  const handlePublish = async () => {
    if (!timetable) return;
    setPublishing(true);
    try {
      await api.put(`/timetables/${timetable.id}/publish`);
      toast.success("EDT publié — visible par tous");
      await fetchTimetable();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally {
      setPublishing(false);
    }
  };

  // Grouper les créneaux par jour
  const slotsByDay = DAYS.map((_, dayIndex) =>
    (timetable?.slots ?? [])
      .filter((s) => s.dayOfWeek === dayIndex)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  );

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Emploi du temps</h1>
            <p className="mt-1 text-slate-400">Créer et gérer les créneaux manuellement</p>
          </div>
          {timetable && (
            <div className="flex gap-3">
              <Badge variant="outline" className={timetable.status === "PUBLISHED"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : "border-amber-400/30 bg-amber-400/10 text-amber-100"
              }>
                {timetable.status === "PUBLISHED" ? "Publié" : "Brouillon"}
              </Badge>
              <Button
                size="sm"
                className="bg-sky-400 text-black hover:bg-sky-300"
                onClick={() => setAddDialog(true)}
              >
                <Plus className="h-4 w-4" />Ajouter un créneau
              </Button>
              {timetable.status !== "PUBLISHED" && (
                <Button
                  size="sm"
                  className="bg-emerald-400 text-black hover:bg-emerald-300"
                  disabled={publishing}
                  onClick={handlePublish}
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Publier
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Sélection */}
        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-48 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Année scolaire" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* État */}
        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : !selectedClass ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Sélectionne une classe pour voir ou créer son emploi du temps.
          </div>
        ) : !timetable ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
            <p className="text-slate-400">Aucun emploi du temps pour cette classe.</p>
            <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={createTimetable}>
              <Plus className="h-4 w-4" />Créer l'emploi du temps
            </Button>
          </div>
        ) : (
          /* Grille des créneaux par jour */
          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {DAYS.map((day, dayIndex) => (
              <Card key={day} className={`border text-white ${DAY_COLORS[dayIndex]}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-slate-200">{day}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3">
                  {slotsByDay[dayIndex].length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-2">—</p>
                  ) : (
                    slotsByDay[dayIndex].map((slot) => (
                      <div key={slot.id} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">{slot.startTime}–{slot.endTime}</span>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`text-xs px-1 py-0 ${kindColors[slot.kind] ?? ""}`}>
                              {slot.kind}
                            </Badge>
                            {timetable.status !== "PUBLISHED" && (
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                disabled={deletingSlot === slot.id}
                                className="text-red-400 hover:text-red-300 ml-1"
                              >
                                {deletingSlot === slot.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <Trash2 className="h-3 w-3" />
                                }
                              </button>
                            )}
                          </div>
                        </div>
                        {slot.subject && (
                          <p className="text-xs font-semibold text-white truncate">{slot.subject.name}</p>
                        )}
                        {slot.teacher && (
                          <p className="text-xs text-slate-400 truncate">
                            {slot.teacher.firstName} {slot.teacher.lastName}
                          </p>
                        )}
                        {slot.room && (
                          <p className="text-xs text-slate-500">Salle {slot.room}</p>
                        )}
                        {slot.subGroup && (
                          <p className="text-xs text-amber-300">{slot.subGroup.name}</p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog ajout créneau */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="border-white/10 bg-slate-900 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un créneau</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Jour</label>
                <Select value={slotForm.dayOfWeek} onValueChange={(v) => setSlotForm((f) => ({ ...f, dayOfWeek: v }))}>
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day, i) => <SelectItem key={i} value={String(i)}>{day}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Type</label>
                <Select value={slotForm.kind} onValueChange={(v) => setSlotForm((f) => ({ ...f, kind: v }))}>
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLASS">Cours</SelectItem>
                    <SelectItem value="BREAK">Pause</SelectItem>
                    <SelectItem value="ACTIVITY">Activité</SelectItem>
                    <SelectItem value="TD">TP / TD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Début</label>
                <Input type="time" value={slotForm.startTime} onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Fin</label>
                <Input type="time" value={slotForm.endTime} onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
              </div>
            </div>

            {slotForm.kind === "CLASS" || slotForm.kind === "TD" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Matière</label>
                  <Select value={slotForm.subjectId} onValueChange={(v) => setSlotForm((f) => ({ ...f, subjectId: v }))}>
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Sélectionner une matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Enseignant</label>
                  <Select value={slotForm.teacherId} onValueChange={(v) => setSlotForm((f) => ({ ...f, teacherId: v }))}>
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Sélectionner un enseignant" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.lastName} {t.firstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <Input
              placeholder="Salle (optionnel)"
              value={slotForm.room}
              onChange={(e) => setSlotForm((f) => ({ ...f, room: e.target.value }))}
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={() => setAddDialog(false)}>
              Annuler
            </Button>
            <Button className="bg-sky-400 text-black hover:bg-sky-300" disabled={addingSlot} onClick={handleAddSlot}>
              {addingSlot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimetableEditor;