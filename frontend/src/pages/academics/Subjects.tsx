import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Search from "@/components/global/Search";
import CustomAlert from "@/components/global/CustomAlert";
import type { pagination, subject } from "@/types";
import { SubjectTable } from "@/components/subjects/SubjectTable";
import { SubjectForm } from "@/components/subjects/SubjectForm";
import { useAuth } from "@/hooks/AuthProvider";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

const SUBJECTS_PAGE_SIZE = 15;

export const Subjects = () => {
  const { user } = useAuth();
  const language = useUILanguage();
  const canView = user?.role === "admin" || user?.role === "teacher";
  const isAdmin = user?.role === "admin";
  const [subjects, setSubjects] = useState<subject[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Search & Pagination State ---
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // --- Dialog States ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<subject | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 1. Handle Debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPageNum(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Fetch Subjects
  const fetchSubjects = async () => {
    if (!canView) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Construct Query Params
      const params = new URLSearchParams();
      params.append("page", pageNum.toString());
      params.append("limit", String(SUBJECTS_PAGE_SIZE));
      if (debouncedSearch) params.append("search", debouncedSearch);

      const { data } = (await api.get(`/subjects?${params.toString()}`)) as {
        data: { subjects: subject[]; pagination: pagination };
      };

      // Handle response structure { subjects: [], pagination: {} }
      if (data.subjects) {
        setSubjects(data.subjects);
        setTotalPages(data.pagination.pages);
      } else {
        setSubjects([]);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("subjects.loadFail", language));
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when Page or Search changes
  useEffect(() => {
    fetchSubjects();
  }, [pageNum, debouncedSearch, canView]);

  const handleCreate = () => {
    setEditingSubject(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: subject) => {
    setEditingSubject(item);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/subjects/delete/${deleteId}`);
      toast.success(t("subjects.deleteSuccess", language));
      fetchSubjects();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("subjects.deleteFail", language));
    } finally {
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("subjects.title", language)}</h1>
          <p className="text-muted-foreground">
            {!canView
              ? t("subjects.subtitle.noAccess", language)
              : isAdmin
              ? t("subjects.subtitle.admin", language)
              : t("subjects.subtitle.viewer", language)}
          </p>
        </div>
        <div className="flex gap-3">
          <Search search={search} setSearch={setSearch} title={t("subjects.title", language)} />
          {isAdmin && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("subjects.create", language)}
            </Button>
          )}
        </div>
      </div>
      {/* table */}
      <SubjectTable
        data={subjects}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        page={pageNum}
        setPage={setPageNum}
        totalPages={totalPages}
        canManage={isAdmin}
      />
      {/* form */}
      {isAdmin && (
        <SubjectForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialData={editingSubject}
          onSuccess={fetchSubjects}
        />
      )}
      <CustomAlert
        handleDelete={confirmDelete}
        isOpen={isAdmin && isDeleteOpen}
        setIsOpen={setIsDeleteOpen}
        title={t("subjects.delete.title", language)}
        description={t("subjects.delete.description", language)}
      />
    </div>
  );
};
