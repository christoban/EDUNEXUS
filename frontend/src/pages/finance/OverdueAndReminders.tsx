import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { useUILanguage } from "@/hooks/useUILanguage";

const formatXAF = (value: number) =>
  new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function OverdueAndRemindersPage() {
  const language = useUILanguage();
  const [overdueStudents, setOverdueStudents] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [overdueRes, revenueRes] = await Promise.all([
        api.get("/finance/reports/overdue-students"),
        api.get("/finance/reports/revenue"),
      ]);

      setOverdueStudents(overdueRes.data?.overdueStudents || []);
      setRevenue(revenueRes.data?.summary || null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.overdue.loadFail", language));
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (student: any) => {
    const smsPhone = window.prompt(t("finance.overdue.promptPhone", language), "");

    const channels: string[] = ["email"];
    if (smsPhone && smsPhone.trim()) {
      channels.push("sms");
    }

    try {
      const { data } = await api.post("/finance/reminders/send", {
        studentId: student.studentId,
        channels,
        phoneNumber: smsPhone?.trim() || undefined,
      });

      const emailStatus = data?.result?.email?.status;
      const smsStatus = data?.result?.sms?.status;
      toast.success(t("finance.overdue.reminderSuccess", language, {
        email: emailStatus || t("common.na", language),
        sms: smsStatus || t("common.na", language),
      }));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.overdue.reminderFail", language));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("finance.overdue.title", language)}</h1>
        <p className="text-muted-foreground">{t("finance.overdue.subtitle", language)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("finance.overdue.totalRevenue", language)}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatXAF(Number(revenue?.totalRevenue || 0))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("finance.overdue.cash", language)}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatXAF(Number(revenue?.cashTotal || 0))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("finance.overdue.transfer", language)}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatXAF(Number(revenue?.bankTotal || 0))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("finance.overdue.mtn", language)}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatXAF(Number(revenue?.momoMtnTotal || 0))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("finance.overdue.orange", language)}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{formatXAF(Number(revenue?.momoOrangeTotal || 0))}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("finance.overdue.studentsTitle", language)}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading", language)}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance.overdue.table.student", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.email", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.amountDue", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.invoiceCount", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.latestDue", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.action", language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueStudents.map((item) => (
                  <TableRow key={item.studentId}>
                    <TableCell>{item.studentName}</TableCell>
                    <TableCell>{item.studentEmail}</TableCell>
                    <TableCell>{formatXAF(Number(item.totalOutstanding))}</TableCell>
                    <TableCell>{item.invoiceCount}</TableCell>
                    <TableCell>
                      {item.latestDueDate
                        ? new Date(item.latestDueDate).toLocaleDateString(
                            language === "fr" ? "fr-CM" : "en-GB"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => sendReminder(item)}>
                        {t("finance.overdue.remind", language)}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
