import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatXAF = (v: number) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(v || 0);

type RevenueData = {
  totalExpected: number;
  totalReceived: number;
  totalOverdue: number;
  recoveryRate: number;
  byMonth: { month: string; expected: number; received: number }[];
};

type OverdueStudent = {
  studentId: string;
  studentName: string;
  className: string;
  totalDue: number;
  overdueCount: number;
};

const StaffFinance = () => {
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [overdueStudents, setOverdueStudents] = useState<OverdueStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [revenueRes, overdueRes] = await Promise.allSettled([
          api.get(`/finance/reports/revenue?period=${period}`),
          api.get("/finance/reports/overdue-students"),
        ]);
        if (revenueRes.status === "fulfilled") setRevenue(revenueRes.value.data);
        if (overdueRes.status === "fulfilled") setOverdueStudents(overdueRes.value.data?.students || []);
      } catch { toast.error("Erreur de chargement"); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [period]);

  const sendReminder = async (studentId: string) => {
    setSending(studentId);
    try {
      await api.post("/finance/reminders/send", {
        studentId,
        channels: ["email"],
      });
      toast.success("Relance envoyée");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur");
    } finally { setSending(null); }
  };

  const recoveryColor = (rate: number) =>
    rate >= 80 ? "text-emerald-500" : rate >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tableau de bord Finance</h1>
          <p className="text-muted-foreground mt-1">Vue globale des finances de l'établissement</p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="trimester">Ce trimestre</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />Chargement...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Attendu", value: formatXAF(revenue?.totalExpected ?? 0), icon: <DollarSign className="h-5 w-5" />, color: "text-sky-500" },
              { label: "Reçu", value: formatXAF(revenue?.totalReceived ?? 0), icon: <CheckCircle2 className="h-5 w-5" />, color: "text-emerald-500" },
              { label: "En retard", value: formatXAF(revenue?.totalOverdue ?? 0), icon: <AlertTriangle className="h-5 w-5" />, color: "text-red-500" },
              { label: "Taux recouvrement", value: `${(revenue?.recoveryRate ?? 0).toFixed(1)}%`, icon: <TrendingUp className="h-5 w-5" />, color: recoveryColor(revenue?.recoveryRate ?? 0) },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                      <p className={`mt-2 text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                    </div>
                    <div className={kpi.color}>{kpi.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Élèves en retard */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Élèves en retard de paiement</CardTitle>
              <Badge variant="destructive">{overdueStudents.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {overdueStudents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Aucun élève en retard</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b">
                    <tr>
                      {["Élève", "Classe", "Montant dû", "Factures", "Action"].map((h) => (
                        <th key={h} className="p-4 text-left text-sm font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overdueStudents.map((s) => (
                      <tr key={s.studentId} className="hover:bg-muted/50">
                        <td className="p-4 font-medium">{s.studentName}</td>
                        <td className="p-4 text-muted-foreground text-sm">{s.className}</td>
                        <td className="p-4 font-bold text-red-500">{formatXAF(s.totalDue)}</td>
                        <td className="p-4">
                          <Badge variant="outline">{s.overdueCount} facture(s)</Badge>
                        </td>
                        <td className="p-4">
                          <Button size="sm" variant="outline" disabled={sending === s.studentId}
                            onClick={() => sendReminder(s.studentId)}>
                            {sending === s.studentId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Relancer"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default StaffFinance;
