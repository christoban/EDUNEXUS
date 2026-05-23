import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Edit2, Trash2, Plus } from "lucide-react";
import { getId } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";
import { FieldLabel } from "@/components/ui/field";

interface Subject {
  _id?: string;
  id?: string;
  name: string;
  code: string;
  coefficient?: number;
  appreciation?: string;
  isActive: boolean;
}

const defaultForm = {
  name: "",
  code: "",
  coefficient: "1",
  appreciation: "",
  isActive: true,
};

export default function SubjectsPage() {
  const language = useUILanguage();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    void fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await api.get("/subjects?page=1&limit=100");
      setSubjects(res.data?.subjects || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("settings.subjects.loadFail", language));
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setForm(defaultForm);
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (subject: Subject) => {
    setForm({
      name: subject.name,
      code: subject.code,
      coefficient: String(subject.coefficient || 1),
      appreciation: subject.appreciation || "",
      isActive: subject.isActive,
    });
    setEditingId(getId(subject));
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) {
      toast.error(t("settings.subjects.validation.nameCodeRequired", language));
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name,
        code: form.code,
        coefficient: Number(form.coefficient) || 1,
        appreciation: form.appreciation || "",
        isActive: form.isActive,
      };

      if (editingId) {
        await api.patch(`/subjects/update/${editingId}`, payload);
        toast.success(t("settings.subjects.updateSuccess", language));
      } else {
        await api.post("/subjects/create", payload);
        toast.success(t("settings.subjects.createSuccess", language));
      }

      setIsDialogOpen(false);
      await fetchSubjects();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("settings.subjects.saveFail", language));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.confirmDelete", language))) return;

    try {
      await api.delete(`/subjects/delete/${id}`);
      toast.success(t("settings.subjects.deleteSuccess", language));
      await fetchSubjects();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("settings.subjects.deleteFail", language));
    }
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("settings.subjects.title", language)}</h2>
          <p className="text-muted-foreground">
            {t("settings.subjects.subtitle", language)}
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          {t("settings.subjects.new", language)}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.subjects.current", language)}</CardTitle>
          <CardDescription>
            {t("settings.subjects.currentDescription", language)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {t("common.loading", language)}
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              {t("settings.subjects.empty", language)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.subjects.table.name", language)}</TableHead>
                    <TableHead>{t("settings.subjects.table.code", language)}</TableHead>
                    <TableHead>{t("settings.subjects.table.coefficient", language)}</TableHead>
                    <TableHead>{t("settings.subjects.table.appreciation", language)}</TableHead>
                    <TableHead>{t("settings.subjects.table.status", language)}</TableHead>
                    <TableHead className="text-right">{t("settings.subjects.table.actions", language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={getId(subject)}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>{subject.code}</TableCell>
                      <TableCell>{subject.coefficient || 1}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {subject.appreciation || "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            subject.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {subject.isActive
                            ? t("settings.subjects.status.active", language)
                            : t("settings.subjects.status.inactive", language)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(subject)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(getId(subject))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t("settings.subjects.dialog.editTitle", language)
                : t("settings.subjects.dialog.newTitle", language)}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("settings.subjects.dialog.editDescription", language)
                : t("settings.subjects.dialog.newDescription", language)}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>Nom de la matière</FieldLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("settings.subjects.form.namePlaceholder", language)}
                required
                className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Code</FieldLabel>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={t("settings.subjects.form.codePlaceholder", language)}
                required
                className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Coefficient</FieldLabel>
              <Input
                type="number"
                value={form.coefficient}
                onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
                min="1"
                max="20"
                placeholder="1"
                className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel>Appréciation</FieldLabel>
              <Input
                value={form.appreciation}
                onChange={(e) => setForm({ ...form, appreciation: e.target.value })}
                placeholder={t("settings.subjects.form.appreciationPlaceholder", language)}
                maxLength={500}
                className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                {form.appreciation.length}/500
              </p>
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="isActive">Statut</FieldLabel>
              <label htmlFor="isActive" className="flex items-center gap-3 rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400"
                />
                <span>{t("settings.subjects.form.active", language)}</span>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {t("common.cancel", language)}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving", language) : t("common.save", language)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
