import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Plus, Search, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
};

const ROLES = ["all", "ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT"];
const roleColors: Record<string, string> = {
  ADMIN: "border-red-400/30 bg-red-400/10 text-red-100",
  STAFF: "border-violet-400/30 bg-violet-400/10 text-violet-100",
  TEACHER: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  STUDENT: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  PARENT: "border-amber-400/30 bg-amber-400/10 text-amber-100",
};

const AdminUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    role: "STUDENT", password: "Edunexus2025!",
    title: "", sectionId: "", studentClassId: "",
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users", {
        params: {
          page,
          limit: 20,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(selectedRole !== "all" ? { role: selectedRole } : {}),
        },
      });
      setUsers(data.users || []);
      setTotalPages(data.pagination?.pages ?? 1);
    } catch {
      toast.error("Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedRole]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      toast.error("Prénom, nom et email sont requis");
      return;
    }
    setCreating(true);
    try {
      await api.post("/users/register", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        role: form.role,
        password: form.password,
        title: form.role === "STAFF" ? form.title : undefined,
        studentClassId: form.role === "STUDENT" ? form.studentClassId || undefined : undefined,
        teacherSubjectIds: form.role === "TEACHER" ? [] : undefined,
      });
      toast.success("Utilisateur créé");
      setCreateDialog(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", role: "STUDENT", password: "Edunexus2025!", title: "", sectionId: "", studentClassId: "" });
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Supprimer cet utilisateur définitivement ?")) return;
    setDeleting(userId);
    try {
      await api.delete(`/users/${userId}`);
      toast.success("Utilisateur supprimé");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally {
      setDeleting(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get("/users/export", {
        params: { role: selectedRole },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Utilisateurs</h1>
            <p className="mt-1 text-slate-400">Gérer tous les comptes de l'établissement</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={handleExport}>
              <Download className="h-4 w-4" />Export CSV
            </Button>
            <Button className="bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => setCreateDialog(true)}>
              <Plus className="h-4 w-4" />Nouveau
            </Button>
          </div>
        </div>

        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardContent className="flex flex-wrap gap-3 pt-6">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Rechercher..."
                className="border-white/10 bg-white/5 pl-9 text-white"
              />
            </div>
            <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); setPage(1); }}>
              <SelectTrigger className="w-44 border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r === "all" ? "Tous les rôles" : r}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/90 text-white">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center gap-3 p-8 text-slate-300">
                <Loader2 className="h-5 w-5 animate-spin" />Chargement...
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Aucun utilisateur trouvé.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-white/10">
                    <tr>
                      <th className="p-4 text-left text-sm font-semibold text-slate-400">Nom</th>
                      <th className="p-4 text-left text-sm font-semibold text-slate-400">Email</th>
                      <th className="p-4 text-center text-sm font-semibold text-slate-400">Rôle</th>
                      <th className="p-4 text-center text-sm font-semibold text-slate-400">Statut</th>
                      <th className="p-4 text-right text-sm font-semibold text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-white/5">
                        <td className="p-4 font-medium">{user.lastName} {user.firstName}</td>
                        <td className="p-4 text-slate-300 text-sm">{user.email ?? "—"}</td>
                        <td className="p-4 text-center">
                          <Badge variant="outline" className={roleColors[user.role] ?? "border-slate-500/30 bg-slate-500/10 text-slate-200"}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4 text-center">
                          <Badge variant="outline" className={user.isActive ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-red-400/30 bg-red-400/10 text-red-100"}>
                            {user.isActive ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleting === user.id}
                            onClick={() => handleDelete(user.id)}
                          >
                            {deleting === user.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" className="border-white/10 bg-transparent text-white" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Précédent
            </Button>
            <span className="flex items-center px-4 text-slate-400 text-sm">Page {page} / {totalPages}</span>
            <Button variant="outline" className="border-white/10 bg-transparent text-white" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </div>

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="border-white/10 bg-slate-900 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Prénom" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
              <Input placeholder="Nom" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            </div>
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            <Input placeholder="Téléphone (optionnel)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Rôle" />
              </SelectTrigger>
              <SelectContent>
                {["ADMIN", "STAFF", "TEACHER", "STUDENT", "PARENT"].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.role === "STAFF" && (
              <Input placeholder="Titre (ex: Censeur, Intendant...)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
            )}
            <Input placeholder="Mot de passe" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="border-white/10 bg-white/5 text-white" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-white/10 bg-transparent text-white" onClick={() => setCreateDialog(false)}>Annuler</Button>
            <Button className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={creating} onClick={handleCreate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
