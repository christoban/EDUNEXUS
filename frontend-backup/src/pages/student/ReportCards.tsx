import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ReportCard = {
  id: string;
  generalAverage: number | null;
  rank: number | null;
  totalStudents: number | null;
  mention: string | null;
  absenceCount: number;
  isGenerated: boolean;
  academicYear: { id: string; name: string };
  academicPeriod: { id: string; name: string };
};

const StudentReportCards = () => {
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api.get("/report-cards/my").then(({ data }) => {
      setReportCards(data.reportCards || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const downloadPdf = async (rcId: string, periodName: string) => {
    setDownloading(rcId);
    try {
      const response = await api.get(`/report-cards/${rcId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mon-bulletin-${periodName}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* silently */ } finally { setDownloading(null); }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Mes bulletins</h1>
          <p className="mt-1 text-slate-400">Consultez vos résultats par période</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />Chargement...
          </div>
        ) : reportCards.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
            Aucun bulletin disponible pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {reportCards.map((rc) => (
              <Card key={rc.id} className="border-white/10 bg-slate-900/90 text-white">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {rc.academicPeriod?.name} — {rc.academicYear?.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
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
                      {rc.absenceCount > 0 && (
                        <span className="text-xs text-amber-300">{rc.absenceCount} absence(s)</span>
                      )}
                    </div>
                  </div>
                  {rc.isGenerated && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white hover:bg-white/10"
                      disabled={downloading === rc.id}
                      onClick={() => downloadPdf(rc.id, rc.academicPeriod?.name)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentReportCards;
