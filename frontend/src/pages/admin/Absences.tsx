import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ClassItem = { id: string; name: string };
type StudentStats = {
  studentId: string;
  studentName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

const AdminAbsences = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [stats, setStats] = useState<{ summary: any; byStudent: StudentStats[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/classes").then(({ data }) => setClasses(data.classes || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    api.get("/attendance/stats", { params: { classId: selectedClass } })
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedClass]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Absences & Présences</h1>
          <p className="mt-1 text-slate-400">Vue consolidée par classe</p>
        </div>

        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-64 border-white/10 bg-white/5 text-white">
            <SelectValue placeholder="Sélectionner une classe" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : !stats ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Sélectionne une classe pour voir les statistiques.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Total appels", value: stats.summary.total, color: "text-white" },
                { label: "Présences", value: stats.summary.present, color: "text-emerald-300" },
                { label: "Absences", value: stats.summary.absent, color: "text-red-300" },
                { label: "Taux présence", value: `${stats.summary.attendanceRate}%`, color: "text-sky-300" },
              ].map((item) => (
                <Card key={item.label} className="border-white/10 bg-slate-900 text-white">
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400">{item.label}</p>
                    <p className={`mt-1 text-3xl font-black ${item.color}`}>{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {stats.byStudent && stats.byStudent.length > 0 && (
              <Card className="border-white/10 bg-slate-900/90 text-white">
                <CardHeader>
                  <CardTitle className="text-base">Détail par élève</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="p-4 text-left text-sm font-semibold text-slate-400">Élève</th>
                        <th className="p-4 text-center text-sm font-semibold text-slate-400">Présences</th>
                        <th className="p-4 text-center text-sm font-semibold text-slate-400">Absences</th>
                        <th className="p-4 text-center text-sm font-semibold text-slate-400">Retards</th>
                        <th className="p-4 text-center text-sm font-semibold text-slate-400">Taux</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stats.byStudent.map((row) => (
                        <tr key={row.studentId} className="hover:bg-white/5">
                          <td className="p-4 font-medium">{row.studentName}</td>
                          <td className="p-4 text-center text-emerald-300">{row.present}</td>
                          <td className="p-4 text-center text-red-300">{row.absent}</td>
                          <td className="p-4 text-center text-amber-300">{row.late}</td>
                          <td className="p-4 text-center">
                            <Badge
                              variant="outline"
                              className={
                                row.rate >= 80
                                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                                  : row.rate >= 60
                                  ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                                  : "border-red-400/30 bg-red-400/10 text-red-100"
                              }
                            >
                              {row.rate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAbsences;
