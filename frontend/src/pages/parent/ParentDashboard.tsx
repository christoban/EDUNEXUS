import { useEffect, useState } from "react";
import { ParentDashboardStats, ParentChildrenGrid, type ChildWithStats } from "@/components/dashboard/parent-dashboard";
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ParentDashboard = () => {
  const [children, setChildren] = useState<ChildWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const language = useUILanguage();

  useEffect(() => {
    const loadChildren = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/parent/children");
        setChildren(data?.children || []);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("parent.dashboard.loadFail", language));
      } finally {
        setLoading(false);
      }
    };

    void loadChildren();
  }, [language]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("parent.dashboard.title", language)}</h1>
        <p className="text-muted-foreground mt-1">
          {t("parent.dashboard.subtitle", language)}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-lg border bg-card py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <ParentDashboardStats children={children} />
      )}

      {/* Children Grid Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">{t("parent.dashboard.childrenTitle", language)}</h2>
        <ParentChildrenGrid children={children} loading={loading} />
      </div>
    </div>
  );
};

export default ParentDashboard;
