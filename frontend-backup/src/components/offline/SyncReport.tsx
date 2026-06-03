import { useEffect, useState } from "react";
import { dbGetAll } from "@/lib/offlineDB";
import type { SyncReport } from "@/lib/offlineQueue";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const SyncReportView = () => {
  const [reports, setReports] = useState<SyncReport[]>([]);

  useEffect(() => {
    void dbGetAll<SyncReport>("sync_reports").then(setReports);
  }, []);

  if (reports.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Aucun rapport de synchronisation disponible.</div>;
  }

  return (
    <div className="space-y-4">
      {[...reports].reverse().map((report, index) => (
        <Card key={report.id || index}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {new Date(report.timestamp).toLocaleString("fr-FR")}
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300">
                  {report.accepted} accepté(s)
                </Badge>
                {report.rejected > 0 && (
                  <Badge variant="outline" className="border-red-400/30 bg-red-400/10 text-red-700 dark:text-red-300">
                    {report.rejected} rejeté(s)
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {report.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-start gap-3 px-4 py-3">
                  {item.status === "accepted" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{item.type}</p>
                    {item.reason && <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};