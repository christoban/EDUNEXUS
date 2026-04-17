import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { api } from "@/lib/api";
import { Link, useNavigate } from "react-router";

// UI Imports
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Calendar, FileText, CheckCircle2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Section } from "@/types";
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";

// Custom Components
import { AiInsightWidget } from "@/components/dashboard/ai-insight-widget";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const language = useUILanguage();

  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>({});
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionId, setSectionId] = useState<string>("all");
  const [cycle, setCycle] = useState<string>("all");
  const [globalQuery, setGlobalQuery] = useState("");
  const [debouncedGlobalQuery, setDebouncedGlobalQuery] = useState("");
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [globalTotals, setGlobalTotals] = useState<any>(null);
  const [globalPagination, setGlobalPagination] = useState({
    total: 0,
    page: 1,
    pages: 0,
    limit: 8,
  });

  // 1. Fetch Data Logic
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // THE REAL CALL
        const params = new URLSearchParams();
        if (sectionId !== "all") params.set("sectionId", sectionId);
        if (cycle !== "all") params.set("cycle", cycle);
        const { data } = await api.get(`/dashboard/stats${params.toString() ? `?${params.toString()}` : ""}`);
        setStatsData(data);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchDashboardData();
  }, [user, sectionId, cycle]);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const { data } = await api.get("/core-domain/sections");
        setSections(data.sections || []);
      } catch (error) {
        console.error("Failed to load sections", error);
      }
    };

    fetchSections();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedGlobalQuery(globalQuery.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [globalQuery]);

  const fetchGlobalSearch = async (page = 1) => {
    if (user?.role !== "admin") {
      return;
    }

    if (!debouncedGlobalQuery) {
      setGlobalResults([]);
      setGlobalTotals(null);
      setGlobalPagination((prev) => ({ ...prev, total: 0, page: 1, pages: 0 }));
      return;
    }

    try {
      setGlobalSearchLoading(true);
      const { data } = await api.get(
        `/search/global?q=${encodeURIComponent(debouncedGlobalQuery)}&page=${page}&limit=8`
      );
      setGlobalResults(data.results || []);
      setGlobalTotals(data.totalsByType || null);
      setGlobalPagination(data.pagination || { total: 0, page, pages: 0, limit: 8 });
    } catch (error) {
      console.error("Failed to run global search", error);
    } finally {
      setGlobalSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalSearch(1);
  }, [debouncedGlobalQuery, user?.role]);

  // 2. Loading State
  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-7">
          <Skeleton className="col-span-4 h-100" />
          <Skeleton className="col-span-3 h-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("dashboard.title", language)}</h2>
          <p className="text-muted-foreground">
            {user?.name ? `${t("dashboard.welcome", language)}, ${user.name}!` : t("dashboard.welcome", language)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Role specific actions */}
          {user?.role === "admin" && (
            <Button onClick={() => navigate("/users/students")}>
              Manage Students
            </Button>
          )}
          {user?.role === "teacher" && (
            <Button onClick={() => navigate("/lms/exams") }>
              Create Quiz
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" /> {t("dashboard.filter.title", language)}
          </CardTitle>
          <CardDescription>
            {t("dashboard.filter.subtitle", language)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("dashboard.filter.section", language)}</p>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.filter.allSections", language)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.filter.allSections", language)}</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section._id} value={section._id}>
                    {section.name} · {section.cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("dashboard.filter.cycle", language)}</p>
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger>
                <SelectValue placeholder={t("dashboard.filter.allCycles", language)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.filter.allCycles", language)}</SelectItem>
                {(["maternelle", "primaire", "secondaire_1", "secondaire_2", "technique"] as const).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("dashboard.filter.scope", language)}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{sectionId === "all" ? t("dashboard.filter.allSections", language) : sections.find((section) => section._id === sectionId)?.name || t("dashboard.filter.section", language)}</Badge>
              <Badge variant="outline">{cycle === "all" ? t("dashboard.filter.allCycles", language) : cycle}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- TOP ROW: STATS --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStats role={user?.role || "student"} data={statsData} />
      </div>

      {user?.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>Global Search</CardTitle>
            <CardDescription>
              Search users, classes, subjects, exams, and activity logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              placeholder="Search across all modules..."
            />

            {globalTotals && (
              <div className="text-sm text-muted-foreground">
                Users: {globalTotals.users || 0} | Classes: {globalTotals.classes || 0} |
                Subjects: {globalTotals.subjects || 0} | Exams: {globalTotals.exams || 0} |
                Activities: {globalTotals.activities || 0}
              </div>
            )}

            {globalSearchLoading ? (
              <div className="text-sm text-muted-foreground">Searching...</div>
            ) : globalResults.length > 0 ? (
              <div className="space-y-3">
                {globalResults.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="rounded-md border p-3">
                    <div className="text-sm font-medium">
                      [{item.type.toUpperCase()}] {item.title}
                    </div>
                    {item.subtitle && (
                      <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    disabled={globalPagination.page <= 1}
                    onClick={() => fetchGlobalSearch(globalPagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {globalPagination.page} of {globalPagination.pages || 1}
                  </span>
                  <Button
                    variant="outline"
                    disabled={globalPagination.page >= globalPagination.pages}
                    onClick={() => fetchGlobalSearch(globalPagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : debouncedGlobalQuery ? (
              <div className="text-sm text-muted-foreground">No results found.</div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Type at least one keyword to search globally.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* --- MAIN CONTENT GRID --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* LEFT COLUMN (Content) */}
        <div className="col-span-4 space-y-4">
          {/* AI WIDGET */}
          <AiInsightWidget role={user?.role} />

          {/* RECENT ACTIVITY CARD */}
          {user?.role === "admin" && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Latest updates from the school system.
                  </CardDescription>
                </div>
                <Link to="/"></Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statsData.recentActivity?.map(
                    (activity: string, i: number) => (
                      <div
                        key={i}
                        className="flex items-start pb-4 last:mb-0 last:pb-0 border-b last:border-0"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-blue-500 mt-1" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {activity}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Just now
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT COLUMN (Schedule/Quick Links) */}
        <div className="col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate("/timetable")}
              >
                <Calendar className="mr-2 h-4 w-4" /> View Timetable
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate("/lms/materials")}
              >
                <FileText className="mr-2 h-4 w-4" /> Study Materials
              </Button>
              {user?.role === "admin" && (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate("/settings/academic-years")}
                >
                  <Calendar className="mr-2 h-4 w-4" /> Academic Settings
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
