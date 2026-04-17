import { useEffect, useMemo, useState } from "react";
import { Users, BookOpen, Clock, TrendingUp, Layers3 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthProvider";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";
import type { user } from "@/types";

export interface ChildWithStats extends user {
  class?: { _id: string; name: string; section?: { name: string; language?: string; cycle?: string; subSystem?: { code: string; name: string } } | null };
  attendanceRate?: number;
  latestGrade?: string;
  schoolSection?: string;
  section?: { name: string; language?: string; cycle?: string; subSystem?: { code: string; name: string } } | null;
}

export function ParentChildrenGrid({
  children: externalChildren,
  loading: externalLoading,
}: {
  children?: ChildWithStats[];
  loading?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const language = useUILanguage();

  const effectiveChildren = externalChildren ?? children;
  const effectiveLoading = typeof externalLoading === "boolean" ? externalLoading : loading;

  useEffect(() => {
    if (externalChildren) return;
    if (user?.role !== "parent") return;
    fetchChildren();
  }, [user, externalChildren]);

  const fetchChildren = async () => {
    try {
      setLoading(true);
      const response = await api.get("/parent/children");
      setChildren(response.data?.children || []);
    } catch (error) {
      toast.error("Failed to load children");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (effectiveLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted rounded-t" />
            <CardContent className="h-32 bg-muted mt-2" />
          </Card>
        ))}
      </div>
    );
  }

  if (effectiveChildren.length === 0) {
    return (
      <Card className="col-span-full text-center py-10">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">{t("parent.dashboard.noChildren", language)}</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {effectiveChildren.map((child) => (
        <Card
          key={child._id}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate(`/parent/children/${child._id}`)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{child.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {child.class?.name || t("parent.dashboard.noClass", language)}
                </p>
              </div>
              <Badge variant="outline" className="ml-2">
                {child.latestGrade || "—"}
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {child.section?.cycle || child.class?.section?.cycle || child.schoolSection || "—"}
              </Badge>
              <Badge variant="outline">
                {child.section?.subSystem?.code || child.class?.section?.subSystem?.code || "—"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>{t("parent.dashboard.attendance", language)}: <strong>{child.attendanceRate || 0}%</strong></span>
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/parent/children/${child._id}`);
                }}
              >
                {t("parent.dashboard.viewDetails", language)}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ParentDashboardStats({
  children,
}: {
  children: ChildWithStats[];
}) {
  const language = useUILanguage();
  const avgAttendance =
    children.length > 0
      ? Math.round(
          children.reduce((sum, c) => sum + (c.attendanceRate || 0), 0) /
            children.length
        )
      : 0;
  const sectionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    children.forEach((child) => {
      const key = child.section?.name || child.class?.section?.name || child.schoolSection || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  }, [children]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("parent.dashboard.myChildren", language)}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{children.length}</div>
          <p className="text-xs text-muted-foreground">{t("parent.dashboard.enrolledStudents", language)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("parent.dashboard.avgAttendance", language)}</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgAttendance}%</div>
          <p className="text-xs text-muted-foreground">{t("parent.dashboard.allChildren", language)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("parent.dashboard.performance", language)}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{t("parent.dashboard.performanceValue", language)}</div>
          <p className="text-xs text-muted-foreground">{t("parent.dashboard.overallStatus", language)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t("parent.dashboard.platform", language)}</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{t("parent.dashboard.platformValue", language)}</div>
          <p className="text-xs text-muted-foreground">{t("parent.dashboard.parentPortal", language)}</p>
        </CardContent>
      </Card>

      {sectionSummary.length > 1 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("parent.dashboard.crossSection", language)}</CardTitle>
            <Layers3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sectionSummary.map((item) => (
              <Badge key={item.label} variant="secondary">
                {item.label}: {item.count}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
