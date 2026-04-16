import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { user } from "@/types";
import CustomPagination from "@/components/global/CustomPagination";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

// ?page=${pageNum}&limit=10
interface Props {
  role: string;
  loading: boolean;
  setDeleteId: (id: string) => void;
  setIsDeleteOpen: (open: boolean) => void;
  setEditingUser: (user: user | null) => void;
  setIsFormOpen: (open: boolean) => void;
  users: user[];
  pageNum: number;
  setPageNum: (page: number) => void;
  totalPages: number;
}

const UserTable = ({
  role,
  loading,
  setDeleteId,
  setIsDeleteOpen,
  setEditingUser,
  setIsFormOpen,
  pageNum,
  setPageNum,
  users,
  totalPages,
}: Props) => {
  const language = useUILanguage();

  const handleEdit = (user: user) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const getStudentClassName = (studentClass: user["studentClass"]) => {
    if (studentClass && typeof studentClass === "object" && "name" in studentClass) {
      return studentClass.name;
    }
    return "";
  };

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("users.table.name", language)}</TableHead>
            <TableHead>{t("users.table.email", language)}</TableHead>
            {role === "teacher" && <TableHead>{t("users.table.subjects", language)}</TableHead>}
            {/* Show Class only for students */}
            {role === "student" && <TableHead>{t("users.table.class", language)}</TableHead>}
            <TableHead className="text-right">{t("common.actions", language)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </TableCell>
            </TableRow>
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                {t("users.table.empty", language, { role: t(`users.role.${role}s`, language) })}
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user._id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-slate-500" />
                  </div>
                  {user.name}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                {role === "teacher" && (
                  <TableCell>
                    {user.teacherSubjects?.length ? (
                      <div className="flex gap-1">
                        {user.teacherSubjects.map((subject) => (
                          <Badge variant="outline" key={subject._id}>
                            {subject.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">
                        {t("common.unassigned", language)}
                      </span>
                    )}
                  </TableCell>
                )}
                {role === "student" && (
                  <TableCell>
                    {getStudentClassName(user.studentClass) ? (
                      <Badge variant="outline">
                        {getStudentClassName(user.studentClass)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">
                        {t("common.unassigned", language)}
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>{t("common.actions", language)}</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleEdit(user)}>
                        <Pencil className="mr-2 h-4 w-4" /> {t("common.edit", language)}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setDeleteId(user._id);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> {t("common.delete", language)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <CustomPagination
          loading={loading}
          page={pageNum}
          setPage={setPageNum}
          totalPages={totalPages}
        />
      )}
    </div>
  );
};

export default UserTable;
