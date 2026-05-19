import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ClassItem = {
  id: string;
  name: string;
  level: string | null;
  capacity: number;
  studentCount?: number;
};

const AdminClasses = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: "", level: "", capacity: "40" });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/classes");
      setClasses(data.classes || []);
    } catch { toast.error("Impossible de charger les classes"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Le nom est requis"); return; }
    setCreating(true);
    try {
      await api.post("/classes/create", { name: form.name, level: form.level || null, capacity: Number(form.capacity) || 40 });
      toast.success("Classe créée");
      setCreateDialog(false);
      setForm({ name: "", level: "", capacity: "40" });
      await fetchClasses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setCreating(false); }
  };

  const handleDelete = async (classId: string) => {
    if (!confirm("Supprimer cette classe ?")) return;
    setDeleting(classId);
    try {
      await api.delete(`/classes/delete/${classId}`);
      toast.success("Classe supprimée");
      await fetchClasses();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setDeleting(null); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Classes</h1>
            <p className="mt-1 text-slate-400">{classes.length} classe(s) dans l'établissement</p>
          </div>
          <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => setCreateDialog(true)}>
            <Plus className="h-4 w-4" />Nouvelle classe
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300"><Loader2 className="h-5 w-5 animate-spin" />Chargement...</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <Card key={cls.id} className="border-white/10 bg-slate-900/90 text-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">{cls.name}</CardTitle>
                  <Button size="sm" variant="destructive" disabled={deleting === cls.id} onClick={() => handleDelete(cls.id)}>
                    {deleting === cls.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Users className="h-4 w-4" />
                    <span>{cls.studentCount ?? 0} élèves · capacité {cls.capacity}</span>
                  </div>
                  {cls.level && <p className="mt-1 text-xs text-slate-500">Niveau : {cls.level}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="border-white/10 bg-slate-900 text-white">
          <DialogHeader><DialogTitle>Nouvelle classe</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <Input placeholder='Nom (ex: "6e A", "Form 1", "CAP1 MAEL")' value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            <Input placeholder="Niveau (optionnel)" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            <Input type="number" placeholder="Capacité" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
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

export default AdminClasses;
