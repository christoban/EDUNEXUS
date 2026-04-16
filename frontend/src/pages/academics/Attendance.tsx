import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/AuthProvider";
import { api } from "@/lib/api";
import type {
  AttendanceRecord,
  AttendanceStatus,
  Class,
  pagination,
  user,
} from "@/types";
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
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";

const statusOptions: AttendanceStatus[] = [
  "present",
  "absent",
  "late",
  "excused",
];

const formatDateInput = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const prettyStatus = (status: AttendanceStatus, language: "fr" | "en") =>
  t(`status.${status}`, language);

const ensureString = (id: any): string => {
  if (typeof id === "string") return id;
  if (typeof id === "object" && id?._id) return String(id._id);
  return String(id || "");
};

export default function AttendancePage() {
  const { user } = useAuth();
  const language = useUILanguage();
  const dateLocale = language === "fr" ? "fr-CM" : "en-GB";

  const isManager = user?.role === "admin" || user?.role === "teacher";

  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<user[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusByStudent, setStatusByStudent] = useState<
    Record<string, AttendanceStatus>
  >({});

  const filteredStudents = useMemo(() => {
    if (!selectedClassId) {
      return [];
    }
    return students.filter((student) => {
      const studentClassId =
        typeof student.studentClass === "string"
          ? student.studentClass
          : (student.studentClass as any)?._id;
      return ensureString(studentClassId) === ensureString(selectedClassId);
    });
  }, [students, selectedClassId]);

  const loadClasses = async () => {
    if (!isManager) {
      return;
    }
    try {
      const { data } = (await api.get("/classes?page=1&limit=100")) as {
        data: { classes: Class[]; pagination: pagination };
      };
      setClasses(data.classes || []);
      if (!selectedClassId && data.classes?.length) {
        setSelectedClassId(data.classes[0]._id);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("attendance.error.loadClasses", language));
    }
  };

  const loadStudents = async () => {
    if (!isManager) {
      return;
    }
    try {
      const { data } = (await api.get("/users?role=student&page=1&limit=500")) as {
        data: { users: user[] };
      };
      setStudents(data.users || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("attendance.error.loadStudents", language));
    }
  };

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDate) {
        params.append("date", selectedDate);
      }
      if (selectedClassId) {
        params.append("classId", selectedClassId);
      }

      const { data } = (await api.get(`/attendance?${params.toString()}`)) as {
        data: { records: AttendanceRecord[] };
      };

      let attendanceRecords = data.records || [];

      if (!isManager && selectedDate && attendanceRecords.length === 0) {
        const fallback = await api.get("/attendance");
        attendanceRecords = fallback.data?.records || [];
      }

      setRecords(attendanceRecords);

      if (isManager && filteredStudents.length) {
        const nextMap: Record<string, AttendanceStatus> = {};
        for (const student of filteredStudents) {
          const studentIdStr = ensureString(student._id);
          const existing = attendanceRecords.find(
            (record) => ensureString(record.student?._id) === studentIdStr
          );
          nextMap[studentIdStr] = existing?.status || "present";
        }
        setStatusByStudent(nextMap);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("attendance.error.loadAttendance", language));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [isManager]);

  useEffect(() => {
    loadStudents();
  }, [isManager]);

  useEffect(() => {
    if (selectedDate && (selectedClassId || !isManager)) {
      loadAttendance();
    }
  }, [selectedDate, selectedClassId, isManager]);

  useEffect(() => {
    if (!isManager || !filteredStudents.length) {
      return;
    }

    const nextMap: Record<string, AttendanceStatus> = {};
    for (const student of filteredStudents) {
      const studentIdStr = ensureString(student._id);
      const existing = records.find(
        (record) => ensureString(record.student?._id) === studentIdStr
      );
      nextMap[studentIdStr] = existing?.status || "present";
    }
    setStatusByStudent(nextMap);
  }, [isManager, filteredStudents, records]);

  const handleSave = async () => {
    if (!selectedClassId) {
      toast.error(t("attendance.error.selectClass", language));
      return;
    }

    if (!filteredStudents.length) {
      toast.error(t("attendance.error.noStudents", language));
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        classId: ensureString(selectedClassId),
        date: selectedDate,
        records: filteredStudents.map((student) => {
          const studentIdStr = ensureString(student._id);
          return {
            studentId: studentIdStr,
            status: statusByStudent[studentIdStr] || "present",
          };
        }),
      };

      await api.post("/attendance/mark", payload);
      toast.success(t("attendance.saved", language));
      loadAttendance();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.errors?.[0]?.message ||
        error?.response?.data?.message ||
        t("attendance.error.save", language);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("attendance.title", language)}</h1>
        <p className="text-muted-foreground">
          {isManager
            ? t("attendance.subtitle.manager", language)
            : t("attendance.subtitle.viewer", language)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("attendance.date", language)}</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>

        {isManager && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("attendance.class", language)}</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">-- {t("attendance.selectClass", language)} --</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass._id} value={schoolClass._id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {isManager && (
          <div className="flex items-end">
            <Button onClick={handleSave} disabled={submitting || loading}>
              {submitting ? t("attendance.saving", language) : t("attendance.save", language)}
            </Button>
          </div>
        )}
      </div>

      {isManager ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("attendance.student", language)}</TableHead>
                <TableHead>{t("attendance.email", language)}</TableHead>
                <TableHead>{t("attendance.status", language)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    {t("attendance.loading", language)}
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("attendance.noStudents", language)}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const studentIdStr = ensureString(student._id);
                  return (
                    <TableRow key={studentIdStr}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                          value={statusByStudent[studentIdStr] || "present"}
                          onChange={(event) =>
                            setStatusByStudent((previous) => ({
                              ...previous,
                              [studentIdStr]: event.target.value as AttendanceStatus,
                            }))
                          }
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {prettyStatus(status, language)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("attendance.date", language)}</TableHead>
                <TableHead>{t("attendance.student", language)}</TableHead>
                <TableHead>{t("attendance.class", language)}</TableHead>
                <TableHead>{t("attendance.status", language)}</TableHead>
                <TableHead>{t("attendance.markedBy", language)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    {t("attendance.loading", language)}
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {t("attendance.noRecords", language)}
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      {new Date(record.date).toLocaleDateString(dateLocale)}
                    </TableCell>
                    <TableCell>{record.student?.name || "N/A"}</TableCell>
                    <TableCell>{record.class?.name || "N/A"}</TableCell>
                    <TableCell>{prettyStatus(record.status, language)}</TableCell>
                    <TableCell>{record.markedBy?.name || "N/A"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
