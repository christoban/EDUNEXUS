import { Button } from "@/components/ui/button";
import type { pagination, user, UserRole } from "@/types";
import CustomAlert from "@/components/global/CustomAlert";
// import UserDialog from "@/components/users/user-dialog";
import Search from "@/components/global/Search";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import UserTable from "@/components/users/UserTable";
import UserDialog from "@/components/users/UserDialog";
import { useAuth } from "@/hooks/AuthProvider";

interface Props {
  role: UserRole;
  title: string;
  description: string;
}
export default function UserManagementPage({
  role,
  title,
  description,
}: Props) {
  const { user } = useAuth();
  const canManageUsers = user?.role === "admin";
  const [users, setUsers] = useState<user[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<user | null>(null);

  // Delete States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Handle Debounce (Wait 500ms after typing stops)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 when search changes
    }, 500);

    return () => clearTimeout(handler);
  }, [search]);

  const fetchUsers = async () => {
    if (!canManageUsers) {
      setUsers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Construct Query
      const searchParam = debouncedSearch ? `&search=${debouncedSearch}` : "";
      const roleParam = `&role=${role}`;
      const { data } = (await api.get(
        `/users?page=${page}&limit=10${roleParam}${searchParam}`
      )) as { data: { users: user[]; pagination: pagination } };
      // Handle response based on your new controller structure
      if (data.users) {
        setUsers(data.users);
        setTotalPages(data.pagination.pages);
      } else {
        setUsers([]);
      }
    } catch (error: any) {
      console.log(error);
      toast.error(
        error?.response?.data?.message || `Failed to load ${role}s`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [role, page, debouncedSearch, canManageUsers]); // Re-fetch if role changes

  const handleCreate = () => {
    if (!canManageUsers) return;
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!canManageUsers) return;
    if (!deleteId) return;
    try {
      await api.delete(`/users/delete/${deleteId}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
      console.log(error);
    } finally {
      setIsDeleteOpen(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            {title}
          </h1>
          <p className="text-muted-foreground">
            {canManageUsers ? description : "You are not authorized to manage users."}
          </p>
        </div>
        <div className="flex gap-2">
          <Search search={search} setSearch={setSearch} title={`${role}s`} />
          <Button onClick={handleCreate} disabled={!canManageUsers}>
            <Plus className="mr-2 h-4 w-4" /> Add{" "}
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </Button>
        </div>
      </div>

      {/* table */}
      <UserTable
        role={role}
        loading={loading}
        setDeleteId={setDeleteId}
        setIsDeleteOpen={setIsDeleteOpen}
        setEditingUser={setEditingUser}
        setIsFormOpen={setIsFormOpen}
        users={users}
        setPageNum={setPage}
        pageNum={page}
        totalPages={totalPages}
      />
      {/* create/update */}
      <UserDialog
        editingUser={editingUser}
        role={role}
        open={canManageUsers && isFormOpen}
        setOpen={setIsFormOpen}
        onSuccess={fetchUsers}
      />

      {/* alert */}
      <CustomAlert
        isOpen={canManageUsers && isDeleteOpen}
        setIsOpen={setIsDeleteOpen}
        handleDelete={handleDelete}
        title="Delete User?"
        description="This will permanently delete this user from the system."
      />
    </div>
  );
}
