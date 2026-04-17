import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthProvider";
import type { ReportCard, ReportPeriod, pagination } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getPeriodLabel, t } from "@/lib/i18n";
import { useUISchoolContext } from "@/hooks/useUILanguage";

const periodOptions: ReportPeriod[] = ["term1", "term2", "term3", "annual"];

export default function ReportCardsPage() {
  const { user, year } = useAuth();
  const { language, academicCalendarType } = useUISchoolContext();
  const isStudent = user?.role === "student";
  const isManager = user?.role === "admin" || user?.role === "teacher";

  const [period, setPeriod] = useState<ReportPeriod>("term1");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [blockedStudents, setBlockedStudents] = useState<
    Array<{ studentId: string; studentName: string; totalOutstanding: number }>
  >([]);
  const [pagination, setPagination] = useState<pagination>({
    total: 0,
    page: 1,
    pages: 0,
    limit: 15,
  });

  const activeYearId = year?._id;

  const fetchStudentReportCards = async () => {
    if (!activeYearId) return;

    try {
      setLoading(true);
      const { data } = await api.get(
        `/report-cards/my?yearId=${activeYearId}&period=${period}`
      );
      setReportCards(data.reportCards || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("reportCards.loading", language));
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerReportCards = async (page = 1) => {
    if (!activeYearId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("yearId", activeYearId);
      params.set("period", period);
      params.set("page", String(page));
      params.set("limit", "15");
      if (search.trim()) params.set("search", search.trim());

      const { data } = await api.get(`/report-cards?${params.toString()}`);
      setReportCards(data.reportCards || []);
      setPagination(
        data.pagination || {
          total: 0,
          page,
          pages: 0,
            limit: 15,
        }
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("reportCards.loading", language));
    } finally {
      setLoading(false);
    }
  };

  const fetchBlockedStudents = async () => {
    if (!isManager) return;

    try {
      const { data } = await api.get("/finance/reports/overdue-students");
      const blocked = Array.isArray(data?.overdueStudents)
        ? data.overdueStudents.filter((item: any) => Boolean(item?.bulletinBlocked))
        : [];
      setBlockedStudents(blocked);
    } catch {
      setBlockedStudents([]);
    }
  };

  const triggerGeneration = async () => {
    if (!activeYearId) {
      toast.error(t("timetable.error.selectClassYear", language));
      return;
    }

    try {
      setGenerating(true);
      await api.post("/report-cards/generate", {
        yearId: activeYearId,
        period,
      });
      toast.success(t("timetable.defaultQueued", language));

      if (isManager) {
        fetchManagerReportCards(1);
        fetchBlockedStudents();
      }
      if (isStudent) {
        fetchStudentReportCards();
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t("timetable.error.generation", language)
      );
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (isStudent) {
      fetchStudentReportCards();
      return;
    }

    if (isManager) {
      fetchManagerReportCards(1);
      fetchBlockedStudents();
    }
  }, [isStudent, isManager, period, activeYearId]);

  const blockedByStudentId = useMemo(() => {
    const map = new Map<string, { studentName: string; totalOutstanding: number }>();
    blockedStudents.forEach((student) => {
      map.set(String(student.studentId), {
        studentName: student.studentName,
        totalOutstanding: Number(student.totalOutstanding || 0),
      });
    });
    return map;
  }, [blockedStudents]);

  const headingDescription = useMemo(() => {
    if (isStudent) {
      return t("reportCards.description.student", language);
    }
    return t("reportCards.description.manager", language);
  }, [isStudent, language]);

  const downloadPdf = async (reportCardId: string, studentName: string) => {
    try {
      const response = await api.get(`/report-cards/${reportCardId}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${studentName || "report-card"}.pdf`.replace(/\s+/g, "-");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("timetable.error.load", language));
    }
  };

  const formatNumber = (value: number | undefined, digits = 2) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return "0";
    return Number(numeric.toFixed(digits)).toString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("reportCards.title", language)}</h1>
          <p className="text-muted-foreground">{headingDescription}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={period}
            onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
          >
            {periodOptions.map((value) => (
              <option key={value} value={value}>
                {getPeriodLabel(value, language, academicCalendarType)}
              </option>
            ))}
          </select>

          {isManager && (
            <Button onClick={triggerGeneration} disabled={generating || !activeYearId}>
              {generating ? t("reportCards.generating", language) : t("reportCards.generate", language)}
            </Button>
          )}
        </div>
      </div>

      {isManager && (
        <div className="max-w-sm">
          <Input
            placeholder={t("reportCards.searchPlaceholder", language)}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                fetchManagerReportCards(1);
              }
            }}
          />
        </div>
      )}

      {isManager && blockedStudents.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">
            {t("reportCards.financeHold.title", language, {
              count: String(blockedStudents.length),
            })}
          </div>
          <div className="mt-1 text-amber-800">{t("reportCards.financeHold.subtitle", language)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {blockedStudents.slice(0, 6).map((item) => (
              <Badge key={item.studentId} variant="outline" className="border-amber-300 bg-white text-amber-900">
                {item.studentName}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t("reportCards.loading", language)}</div>
      ) : reportCards.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          {t("reportCards.none", language)}
        </div>
      ) : (
        <div className="space-y-4">
          {reportCards.map((reportCard) => (
            <div key={reportCard._id} className="rounded-md border p-4 space-y-2">
              {(() => {
                const holdInfo = blockedByStudentId.get(String((reportCard.student as any)?._id || ""));
                if (!holdInfo) return null;

                return (
                  <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <span>{t("reportCards.financeHold.badge", language)}</span>
                    <span>{holdInfo.totalOutstanding.toLocaleString(language === "fr" ? "fr-CM" : "en-GB")} XAF</span>
                  </div>
                );
              })()}
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">
                    {reportCard.student?.name || t("reportCards.student", language)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {reportCard.year?.name || t("reportCards.year", language)} - {getPeriodLabel(reportCard.period, language, academicCalendarType)}
                  </div>
                </div>
                <div className="text-sm font-medium">{t("reportCards.mention", language)}: {reportCard.mention}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 lg:grid-cols-6">
                <div>{t("reportCards.average", language)}: {formatNumber(reportCard.aggregates.average)}%</div>
                <div>{t("reportCards.averageOn20", language)}: {formatNumber(reportCard.aggregates.averageScoreOn20)}</div>
                <div>{t("reportCards.totalExams", language)}: {reportCard.aggregates.totalExams}</div>
                <div>{t("reportCards.passed", language)}: {reportCard.aggregates.passedExams}</div>
                <div>{t("reportCards.failed", language)}: {reportCard.aggregates.failedExams}</div>
                <div>{t("reportCards.highest", language)}: {reportCard.aggregates.highestPercentage}%</div>
                <div>{t("reportCards.lowest", language)}: {reportCard.aggregates.lowestPercentage}%</div>
              </div>

              {reportCard.grades?.length ? (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-left">
                      <tr>
                        <th className="px-3 py-2">{t("reportCards.subject", language)}</th>
                        <th className="px-3 py-2">{t("reportCards.teacher", language)}</th>
                        <th className="px-3 py-2">{t("reportCards.score", language)}</th>
                        <th className="px-3 py-2">{t("reportCards.max", language)}</th>
                        <th className="px-3 py-2">{t("reportCards.scoreOn20", language)}</th>
                        <th className="px-3 py-2">{t("reportCards.displayGrade", language)}</th>
                        <th className="px-3 py-2">%</th>
                        <th className="px-3 py-2">{t("reportCards.coef", language)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportCard.grades.map((grade: any) => {
                        const subject = grade.subject || grade.exam?.subject;
                        const teacher = grade.exam?.teacher || subject?.teacher?.[0];
                        const coefficient = Number(grade.coefficient || subject?.coefficient || 1);
                        const scoreOn20 = Number(grade.scoreOn20 ?? (Number(grade.percentage || 0) / 5));
                        const gradeLabel = grade.gradeLabel || `${formatNumber(grade.percentage)}%`;
                        return (
                          <tr key={grade._id} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">{subject?.name || t("reportCards.subject", language)}</div>
                              <div className="text-xs text-muted-foreground">{subject?.code || ""}</div>
                            </td>
                            <td className="px-3 py-2">{teacher?.name || "-"}</td>
                            <td className="px-3 py-2">{grade.score}</td>
                            <td className="px-3 py-2">{grade.maxScore}</td>
                            <td className="px-3 py-2">{formatNumber(scoreOn20)}</td>
                            <td className="px-3 py-2">{gradeLabel}</td>
                            <td className="px-3 py-2">{formatNumber(grade.percentage)}%</td>
                            <td className="px-3 py-2">{coefficient}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadPdf(reportCard._id, reportCard.student?.name || "report-card")
                  }
                >
                  {t("reportCards.downloadPdf", language)}
                </Button>
              </div>
            </div>
          ))}

          {isManager && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => fetchManagerReportCards(pagination.page - 1)}
              >
                {t("reportCards.previous", language)}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("reportCards.pageOf", language, {
                  page: String(pagination.page),
                  pages: String(pagination.pages || 1),
                })}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchManagerReportCards(pagination.page + 1)}
              >
                {t("reportCards.next", language)}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
