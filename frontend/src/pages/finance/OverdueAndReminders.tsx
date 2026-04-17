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
import { Badge } from "@/components/ui/badge";
import { useSmsDeliveryStatus, type SmsLiveStatus } from "@/hooks/useSmsDeliveryStatus";

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
  const [lastSmsMsgIdByStudent, setLastSmsMsgIdByStudent] = useState<Record<string, string>>({});
  const [lastSmsPersistedStatusByStudent, setLastSmsPersistedStatusByStudent] =
    useState<Record<string, SmsLiveStatus>>({});
  const { statusByMsgId, startTracking } = useSmsDeliveryStatus();

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

      const seededMsgIds: Record<string, string> = {};
      const seededStatuses: Record<string, SmsLiveStatus> = {};

      (overdueRes.data?.overdueStudents || []).forEach((item: any) => {
        const msgId = item?.lastSms?.providerMessageId;
        const persistedStatus = String(item?.lastSms?.status || "").toLowerCase();

        if (msgId) {
          seededMsgIds[item.studentId] = msgId;
        }

        if (persistedStatus === "delivered") {
          seededStatuses[item.studentId] = "delivered";
        } else if (persistedStatus === "failed") {
          seededStatuses[item.studentId] = "failed";
        } else if (persistedStatus === "sent") {
          seededStatuses[item.studentId] = "sent";
        }
      });

      setLastSmsMsgIdByStudent(seededMsgIds);
      setLastSmsPersistedStatusByStudent(seededStatuses);

      Object.entries(seededMsgIds).forEach(([, msgId]) => {
        startTracking(msgId);
      });
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
      const smsMsgId = data?.result?.sms?.providerMessageId as string | undefined;

      if (smsMsgId) {
        setLastSmsMsgIdByStudent((prev) => ({
          ...prev,
          [student.studentId]: smsMsgId,
        }));
        setLastSmsPersistedStatusByStudent((prev) => ({
          ...prev,
          [student.studentId]: "sent",
        }));
        startTracking(smsMsgId);
      }

      toast.success(t("finance.overdue.reminderSuccess", language, {
        email: emailStatus || t("common.na", language),
        sms: smsStatus || t("common.na", language),
      }));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("finance.overdue.reminderFail", language));
    }
  };

  const resolveSmsStatus = (studentId: string): SmsLiveStatus | "not_sent" => {
    const msgId = lastSmsMsgIdByStudent[studentId];
    if (!msgId) {
      return lastSmsPersistedStatusByStudent[studentId] || "not_sent";
    }
    return statusByMsgId[msgId] || lastSmsPersistedStatusByStudent[studentId] || "sent";
  };

  const getSmsStatusLabel = (status: SmsLiveStatus | "not_sent") => {
    if (status === "not_sent") return t("finance.overdue.sms.notSent", language);
    if (status === "checking") return t("finance.overdue.sms.checking", language);
    if (status === "delivered") return t("finance.overdue.sms.delivered", language);
    if (status === "failed") return t("finance.overdue.sms.failed", language);
    return t("finance.overdue.sms.sent", language);
  };

  const getSmsStatusClassName = (status: SmsLiveStatus | "not_sent") => {
    if (status === "delivered") return "bg-green-100 text-green-700 border-green-200";
    if (status === "failed") return "bg-red-100 text-red-700 border-red-200";
    if (status === "checking") return "bg-amber-100 text-amber-700 border-amber-200";
    if (status === "sent") return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-muted text-muted-foreground border-border";
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
                  <TableHead>{t("finance.overdue.table.bulletinStatus", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.smsStatus", language)}</TableHead>
                  <TableHead>{t("finance.overdue.table.action", language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueStudents.map((item) => {
                  const smsStatus = resolveSmsStatus(item.studentId);
                  return (
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
                      <Badge
                        variant="outline"
                        className={
                          item.bulletinBlocked
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-green-100 text-green-700 border-green-200"
                        }
                      >
                        {item.bulletinBlocked
                          ? t("finance.overdue.bulletin.blocked", language)
                          : t("finance.overdue.bulletin.eligible", language)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getSmsStatusClassName(smsStatus)}>
                        {getSmsStatusLabel(smsStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => sendReminder(item)}>
                        {t("finance.overdue.remind", language)}
                      </Button>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
