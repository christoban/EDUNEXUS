import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ReportCard = {
  id: string;
  studentId: string;
  generalAverage: number | null;
  rank: number | null;
  totalStudents: number | null;
  mention: string | null;
  absenceCount: number;
  isGenerated: boolean;
  academicYear: { id: string; name: string };
  academicPeriod: { id: string; name: string };
  student: { id: string; firstName: string; lastName: string };
};

type AcademicYear = { id: string; name: string; isCurrent: boolean };

const ParentReportCards = () => {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("all");
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.get("/academic-years").then(({ data }) => {
      setYears(data.years || data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get("/report-cards", {
      params: { ...(selectedYear !== "all" ? { yearId: selectedYear } : {}) },
    }).then(({ data }) => {
      setReportCards(data.reportCards || []);
    }).catch(() => {
      setReportCards([]);
    }).finally(() => setLoading(false));
  }, [selectedYear]);

  const downloadPdf = async (reportCardId: string, studentName: string, periodName: string) => {
    setDownloading(reportCardId);
    try {
      const response = await api.get(`/report-cards/${reportCardId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulletin-${studentName}-${periodName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Bulletins</h1>
          <p className="mt-1 text-slate-400">Consultez et téléchargez les bulletins de vos enfants</p>
        </div>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-64 border-white/10 bg-white/5 text-white">
            <SelectValue placeholder="Toutes les années" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les années</SelectItem>
            {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : reportCards.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Aucun bulletin disponible.
          </div>
        ) : (
          <div className="space-y-3">
            {reportCards.map((rc) => {
              const studentName = `${rc.student.firstName} ${rc.student.lastName}`.trim();
              return (
                <Card key={rc.id} className="border-white/10 bg-slate-900/90 text-white">
                  <CardContent className="flex items-center justify-between p-5">
                    <div className="space-y-1">
                      <p className="font-semibold text-white">{studentName}</p>
                      <p className="text-sm text-slate-400">
                        {rc.academicPeriod?.name} — {rc.academicYear?.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {rc.generalAverage !== null && (
                          <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100">
                            {rc.generalAverage.toFixed(2)} / 20
                          </Badge>
                        )}
                        {rc.mention && (
                          <Badge variant="outline" className="border-sky-400/30 bg-sky-400/10 text-sky-100">
                            {rc.mention}
                          </Badge>
                        )}
                        {rc.rank && rc.totalStudents && (
                          <span className="text-xs text-slate-400">
                            Rang {rc.rank} / {rc.totalStudents}
                          </span>
                        )}
                      </div>
                    </div>
                    {rc.isGenerated && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white hover:bg-white/10"
                        disabled={downloading === rc.id}
                        onClick={() => downloadPdf(rc.id, studentName, rc.academicPeriod?.name)}
                      >
                        {downloading === rc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><Download className="h-4 w-4" />PDF</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentReportCards;
