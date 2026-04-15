import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthProvider";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ChildData {
  _id: string;
  name: string;
  email: string;
  class?: { name: string };
}

interface ExamData {
  _id: string;
  title: string;
  subject: { name: string; code: string };
  teacher: { name: string };
  dueDate: string;
  duration: number;
  grade?: { score: number; maxScore: number; percentage: number };
}

interface ReportCardData {
  _id: string;
  year: { name: string };
  period: string;
  aggregates: {
    average: number;
    passedExams: number;
    failedExams: number;
  };
  mention: string;
}

interface AttendanceRecord {
  _id: string;
  date: string;
  student: { name: string };
  class: { name: string };
  status: string;
}

interface TimetableData {
  _id: string;
  class: string;
  schedule: Array<{
    day: string;
    periods: Array<{
      period: number;
      subject: { name: string; code: string };
      teacher: { name: string };
      startTime: string;
      endTime: string;
    }>;
  }>;
}

const ChildDetails = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [childData, setChildData] = useState<ChildData | null>(null);
  const [exams, setExams] = useState<ExamData[]>([]);
  const [reportCards, setReportCards] = useState<ReportCardData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("exams");

  useEffect(() => {
    if (!childId) return;
    loadChildData();
  }, [childId]);

  const loadChildData = async () => {
    if (!childId) return;
    try {
      setLoading(true);
      
      // Fetch exams (includes child name implicitly)
      const examsRes = await api.get(`/parent/children/${childId}/exams`);
      setExams(examsRes.data?.exams || []);

      // Fetch report cards
      const rcRes = await api.get(
        `/parent/children/${childId}/report-card`
      );
      setReportCards(rcRes.data?.reportCards || []);

      // Fetch attendance
      const attRes = await api.get(
        `/parent/children/${childId}/attendance`
      );
      setAttendance(attRes.data?.records || []);

      // Fetch timetable
      const ttRes = await api.get(
        `/parent/children/${childId}/timetable`
      );
      setTimetable(ttRes.data || null);
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
        "Failed to load child data"
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const getGradeColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-100 text-green-800";
    if (percentage >= 70) return "bg-blue-100 text-blue-800";
    if (percentage >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/parent/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Academic Progress
          </h1>
          <p className="text-muted-foreground">
            Comprehensive view of your child's performance
          </p>
        </div>
      </div>

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="grades">Report Cards</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
        </TabsList>

        {/* Exams Tab */}
        <TabsContent value="exams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exams & Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No exams found
                </p>
              ) : (
                <div className="space-y-3">
                  {exams.map((exam) => (
                    <div
                      key={exam._id}
                      className="flex justify-between items-start p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium">{exam.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {exam.subject.name} ({exam.subject.code}) •{" "}
                          {exam.teacher.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Due:{" "}
                          {new Date(exam.dueDate).toLocaleDateString()} •{" "}
                          {exam.duration} min
                        </p>
                      </div>
                      {exam.grade ? (
                        <Badge className={getGradeColor(exam.grade.percentage)}>
                          {exam.grade.percentage}%
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Report Cards Tab */}
        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Cards</CardTitle>
            </CardHeader>
            <CardContent>
              {reportCards.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No report cards available yet
                </p>
              ) : (
                <div className="space-y-4">
                  {reportCards.map((rc) => (
                    <div key={rc._id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h3 className="font-medium">{rc.year.name}</h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {rc.period}
                          </p>
                        </div>
                        <Badge variant="outline">{rc.mention}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Average</p>
                          <p className="font-bold">
                            {rc.aggregates.average.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Passed</p>
                          <p className="font-bold text-green-600">
                            {rc.aggregates.passedExams}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Failed</p>
                          <p className="font-bold text-red-600">
                            {rc.aggregates.failedExams}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Record</CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No attendance records found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Class</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.slice(0, 20).map((record) => (
                        <TableRow key={record._id}>
                          <TableCell>
                            {new Date(record.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.status === "present"
                                  ? "default"
                                  : record.status === "absent"
                                    ? "destructive"
                                    : "outline"
                              }
                            >
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.class.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timetable Tab */}
        <TabsContent value="timetable" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Timetable</CardTitle>
            </CardHeader>
            <CardContent>
              {!timetable ? (
                <p className="text-muted-foreground text-center py-8">
                  No timetable available
                </p>
              ) : (
                <div className="space-y-4">
                  {timetable.schedule?.map((day, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <h3 className="font-bold mb-3 capitalize">{day.day}</h3>
                      <div className="space-y-2">
                        {day.periods?.map((period, pidx) => (
                          <div
                            key={pidx}
                            className="flex justify-between items-start text-sm p-2 bg-muted rounded"
                          >
                            <div>
                              <p className="font-medium">
                                Period {period.period}: {period.subject?.name} (
                                {period.subject?.code})
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {period.teacher?.name}
                              </p>
                            </div>
                            <p className="text-xs">
                              {period.startTime} - {period.endTime}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChildDetails;
