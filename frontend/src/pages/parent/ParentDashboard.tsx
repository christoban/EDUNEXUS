import { useState } from "react";
import { ParentDashboardStats, ParentChildrenGrid } from "@/components/dashboard/parent-dashboard";
import type { user } from "@/types";
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";

const ParentDashboard = () => {
  const [children] = useState<user[]>([]);
  const language = useUILanguage();

  // This is a simple wrapper page that will show the parent dashboard
  // The actual data fetching happens in ParentChildrenGrid component

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("parent.dashboard.title", language)}</h1>
        <p className="text-muted-foreground mt-1">
          {t("parent.dashboard.subtitle", language)}
        </p>
      </div>

      {/* Stats Section - Updated when children are loaded */}
      <ParentDashboardStats children={children} />

      {/* Children Grid Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">{t("parent.dashboard.childrenTitle", language)}</h2>
        <ParentChildrenGrid />
      </div>
    </div>
  );
};

export default ParentDashboard;
