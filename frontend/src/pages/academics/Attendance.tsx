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

const prettyStatus = (status: AttendanceStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1);

// Helper to ensure ID is string
const ensureString = (id: any): string => {
  if (typeof id === "string") return id;
  if (typeof id === "object" && id?._id) return String(id._id);
  return String(id || "");
};

export default function AttendancePage() {
  const { user } = useAuth();

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
      toast.error(error?.response?.data?.message || "Failed to load classes");
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
      toast.error(error?.response?.data?.message || "Failed to load students");
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

      const attendanceRecords = data.records || [];
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
      toast.error(error?.response?.data?.message || "Failed to load attendance");
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
      toast.error("Please select a class");
      return;
    }

    if (!filteredStudents.length) {
      toast.error("No students found in this class");
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
      toast.success("Attendance saved successfully");
      loadAttendance();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.errors?.[0]?.message ||
        error?.response?.data?.message ||
        "Failed to save attendance";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          {isManager
            ? "Mark daily attendance for classes and track records."
            : "View attendance history."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Date</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>

        {isManager && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Class</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">-- Select a class --</option>
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
              {submitting ? "Saving..." : "Save Attendance"}
            </Button>
          </div>
        )}
      </div>

      {isManager ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Loading attendance...
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No students found for this class.
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
                              {prettyStatus(status)}
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
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Marked By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading attendance...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No attendance records found.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      {new Date(record.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{record.class?.name || "N/A"}</TableCell>
                    <TableCell>{prettyStatus(record.status)}</TableCell>
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
