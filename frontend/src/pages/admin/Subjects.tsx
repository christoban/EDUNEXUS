import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  coefficient: number;
  hoursPerWeek: number;
  subjectType: string;
};

const AdminSubjects = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", coefficient: "1", hoursPerWeek: "2", subjectType: "THEORETICAL" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/subjects");
      setSubjects(data.subjects || data || []);
    } catch { toast.error("Impossible de charger les matières"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    setCreating(true);
    try {
      await api.post("/subjects/create", {
        name: form.name,
        code: form.code || null,
        coefficient: Number(form.coefficient) || 1,
        hoursPerWeek: Number(form.hoursPerWeek) || 2,
        subjectType: form.subjectType,
      });
      toast.success("Matière créée");
      setCreateDialog(false);
      setForm({ name: "", code: "", coefficient: "1", hoursPerWeek: "2", subjectType: "THEORETICAL" });
      await fetchSubjects();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setCreating(false); }
  };

  const handleDelete = async (subjectId: string) => {
    if (!confirm("Supprimer cette matière ?")) return;
    setDeleting(subjectId);
    try {
      await api.delete(`/subjects/delete/${subjectId}`);
      toast.success("Matière supprimée");
      await fetchSubjects();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setDeleting(null); }
  };

  const typeColors: Record<string, string> = {
    THEORETICAL: "border-sky-400/30 bg-sky-400/10 text-sky-100",
    PRACTICAL: "border-orange-400/30 bg-orange-400/10 text-orange-100",
    MIXED: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Matières</h1>
            <p className="mt-1 text-slate-400">{subjects.length} matière(s)</p>
          </div>
          <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => setCreateDialog(true)}>
            <Plus className="h-4 w-4" />Nouvelle matière
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" />Chargement...</div>
        ) : (
          <Card className="border-white/10 bg-slate-900/90 text-white">
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="p-4 text-left text-sm font-semibold text-slate-400">Matière</th>
                    <th className="p-4 text-center text-sm font-semibold text-slate-400">Code</th>
                    <th className="p-4 text-center text-sm font-semibold text-slate-400">Coeff</th>
                    <th className="p-4 text-center text-sm font-semibold text-slate-400">H/sem</th>
                    <th className="p-4 text-center text-sm font-semibold text-slate-400">Type</th>
                    <th className="p-4 text-right text-sm font-semibold text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {subjects.map((subject) => (
                    <tr key={subject.id} className="hover:bg-white/5">
                      <td className="p-4 font-medium">{subject.name}</td>
                      <td className="p-4 text-center text-slate-400 text-sm">{subject.code ?? "—"}</td>
                      <td className="p-4 text-center font-bold text-emerald-300">{subject.coefficient}</td>
                      <td className="p-4 text-center text-slate-400">{subject.hoursPerWeek}h</td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className={typeColors[subject.subjectType] ?? ""}>
                          {subject.subjectType}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button size="sm" variant="destructive" disabled={deleting === subject.id} onClick={() => handleDelete(subject.id)}>
                          {deleting === subject.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="border-white/10 bg-slate-900 text-white">
          <DialogHeader><DialogTitle>Nouvelle matière</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Input placeholder="Nom (ex: Mathématiques)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            <Input placeholder="Code (ex: MATH)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Coefficient" value={form.coefficient} onChange={(e) => setForm((f) => ({ ...f, coefficient: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
              <Input type="number" placeholder="Heures/semaine" value={form.hoursPerWeek} onChange={(e) => setForm((f) => ({ ...f, hoursPerWeek: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            </div>
            <select className="rounded-md border border-white/10 bg-white/5 p-3 text-white" value={form.subjectType} onChange={(e) => setForm((f) => ({ ...f, subjectType: e.target.value }))}>
              <option value="THEORETICAL">Théorique</option>
              <option value="PRACTICAL">Pratique</option>
              <option value="MIXED">Mixte</option>
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={() => setCreateDialog(false)}>Annuler</Button>
            <Button className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={creating} onClick={handleCreate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubjects;
