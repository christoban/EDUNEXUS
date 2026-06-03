import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { api } from "@/lib/api";

import { Button } from "@/components/ui/button";
import type { Class, pagination } from "@/types";
import Search from "@/components/global/Search";
import CustomAlert from "@/components/global/CustomAlert";
import ClassTable from "@/components/classes/ClassTable";
import ClassForm from "@/components/classes/ClassForm";
import { useAuth } from "@/hooks/AuthProvider";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

const CLASSES_PAGE_SIZE = 15;

const Classes = () => {
  // it's the same as users/academics-year components
  const { user } = useAuth();
  const language = useUILanguage();
  const canView =
    user?.role === "admin" || user?.role === "teacher" || user?.role === "parent";
  const isAdmin = user?.role === "admin";
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // Delete Alert States
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPageNum(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // 2. Fetch Classes
  const fetchClasses = async () => {
    if (!canView) {
      setClasses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Construct Query Params
      const params = new URLSearchParams();
      params.append("page", pageNum.toString());
      params.append("limit", String(CLASSES_PAGE_SIZE));
      if (debouncedSearch) params.append("search", debouncedSearch);

      const { data } = (await api.get(`/classes?${params.toString()}`)) as {
        data: { classes: Class[]; pagination: pagination };
      };

      // Handle response structure { classes: [], pagination: {} }
      if (data.classes) {
        setClasses(data.classes);
        setTotalPages(data.pagination.pages);
      } else {
        setClasses([]);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("classes.loadFail", language));
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch when Page or Search changes
  useEffect(() => {
    fetchClasses();
  }, [pageNum, debouncedSearch, canView]);

  const handleCreate = () => {
    if (!isAdmin) return;
    setEditingClass(null);
    setIsFormOpen(true);
  };

  const handleEdit = (cls: Class) => {
    if (!isAdmin) return;
    setEditingClass(cls);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    if (!isAdmin) return;
    setDeleteId(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!isAdmin) return;
    if (!deleteId) return;
    try {
      await api.delete(`/classes/delete/${deleteId}`);
      toast.success(t("classes.deleteSuccess", language));
      fetchClasses(); // to refresh the list
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("classes.deleteFail", language));
    } finally {
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("classes.title", language)}</h1>
          <p className="text-muted-foreground">
            {!canView
              ? t("classes.subtitle.noAccess", language)
              : isAdmin
              ? t("classes.subtitle.admin", language)
              : t("classes.subtitle.viewer", language)}
          </p>
        </div>
        <div className="flex gap-2">
          <Search search={search} setSearch={setSearch} title={t("classes.title", language)} />
          {isAdmin && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("classes.create", language)}
            </Button>
          )}
        </div>
      </div>
      {/* table */}
      <ClassTable
        data={classes}
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
        <ClassForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          initialData={editingClass}
          onSuccess={fetchClasses}
        />
      )}
      {/* alert */}
      <CustomAlert
        handleDelete={confirmDelete}
        isOpen={isAdmin && isDeleteOpen}
        setIsOpen={setIsDeleteOpen}
        title={t("classes.delete.title", language)}
        description={t("classes.delete.description", language)}
      />
    </div>
  );
};

export default Classes;
