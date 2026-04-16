import {
  MoreHorizontal,
  Loader2,
  Pencil,
  Trash2,
  BookOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import CustomPagination from "@/components/global/CustomPagination";
import type { subject } from "@/types";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

interface Props {
  data: subject[];
  loading: boolean;
  onEdit: (item: subject) => void;
  onDelete: (id: string) => void;
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  canManage?: boolean;
}

export function SubjectTable({
  data,
  loading,
  onEdit,
  onDelete,
  page,
  setPage,
  totalPages,
  canManage = true,
}: Props) {
  const language = useUILanguage();

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("subjects.table.code", language)}</TableHead>
            <TableHead>{t("subjects.table.name", language)}</TableHead>
            <TableHead>{t("subjects.table.teachers", language)}</TableHead>
            <TableHead>{t("subjects.table.status", language)}</TableHead>
            {canManage && <TableHead className="text-right">{t("common.actions", language)}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={canManage ? 6 : 4} className="h-24 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canManage ? 6 : 4}
                className="h-24 text-center text-muted-foreground"
              >
                {t("subjects.table.empty", language)}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item._id}>
                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                <TableCell className="font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  {item.name}
                </TableCell>
                <TableCell>{item.teacherCount ?? item.teacher?.length ?? 0}</TableCell>
                <TableCell>
                  {item.isActive ? (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                      {t("exams.active", language)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">{t("status.archived", language)}</Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t("common.actions", language)}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Pencil className="mr-2 h-4 w-4" /> {t("common.editDetails", language)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onDelete(item._id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> {t("common.delete", language)}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <CustomPagination
          loading={loading}
          page={page}
          setPage={setPage}
          totalPages={totalPages}
        />
      )}
    </div>
  );
}
