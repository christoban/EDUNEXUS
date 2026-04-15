import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthProvider";
import type { ReportCard, ReportPeriod, pagination } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const periodOptions: ReportPeriod[] = ["term1", "term2", "term3", "annual"];

const labelPeriod = (period: ReportPeriod) => {
  if (period === "term1") return "Term 1";
  if (period === "term2") return "Term 2";
  if (period === "term3") return "Term 3";
  return "Annual";
};

export default function ReportCardsPage() {
  const { user, year } = useAuth();
  const isStudent = user?.role === "student";
  const isManager = user?.role === "admin" || user?.role === "teacher";

  const [period, setPeriod] = useState<ReportPeriod>("term1");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
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
      toast.error(error?.response?.data?.message || "Failed to load report cards");
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
      toast.error(error?.response?.data?.message || "Failed to load report cards");
    } finally {
      setLoading(false);
    }
  };

  const triggerGeneration = async () => {
    if (!activeYearId) {
      toast.error("No active academic year found");
      return;
    }

    try {
      setGenerating(true);
      await api.post("/report-cards/generate", {
        yearId: activeYearId,
        period,
      });
      toast.success("Report card generation queued");

      if (isManager) {
        fetchManagerReportCards(1);
      }
      if (isStudent) {
        fetchStudentReportCards();
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to trigger report card generation"
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
    }
  }, [isStudent, isManager, period, activeYearId]);

  const headingDescription = useMemo(() => {
    if (isStudent) {
      return "View your report cards and grade aggregates by period.";
    }
    return "Generate and review period report cards across students.";
  }, [isStudent]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report Cards</h1>
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
                {labelPeriod(value)}
              </option>
            ))}
          </select>

          {isManager && (
            <Button onClick={triggerGeneration} disabled={generating || !activeYearId}>
              {generating ? "Generating..." : "Generate Report Cards"}
            </Button>
          )}
        </div>
      </div>

      {isManager && (
        <div className="max-w-sm">
          <Input
            placeholder="Search mention or period"
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

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading report cards...</div>
      ) : reportCards.length === 0 ? (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          No report cards found for this period.
        </div>
      ) : (
        <div className="space-y-4">
          {reportCards.map((reportCard) => (
            <div key={reportCard._id} className="rounded-md border p-4 space-y-2">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">
                    {reportCard.student?.name || "Student"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {reportCard.year?.name || "Year"} - {labelPeriod(reportCard.period)}
                  </div>
                </div>
                <div className="text-sm font-medium">Mention: {reportCard.mention}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 lg:grid-cols-6">
                <div>Average: {reportCard.aggregates.average}%</div>
                <div>Total Exams: {reportCard.aggregates.totalExams}</div>
                <div>Passed: {reportCard.aggregates.passedExams}</div>
                <div>Failed: {reportCard.aggregates.failedExams}</div>
                <div>Highest: {reportCard.aggregates.highestPercentage}%</div>
                <div>Lowest: {reportCard.aggregates.lowestPercentage}%</div>
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
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages || 1}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchManagerReportCards(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
