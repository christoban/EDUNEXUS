import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/AuthProvider";
import { ParentDashboardStats, ParentChildrenGrid } from "@/components/dashboard/parent-dashboard";
import type { user } from "@/types";

const ParentDashboard = () => {
  const { user } = useAuth();
  const [children, setChildren] = useState<user[]>([]);

  // This is a simple wrapper page that will show the parent dashboard
  // The actual data fetching happens in ParentChildrenGrid component

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parent Portal</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your children's academic progress
        </p>
      </div>

      {/* Stats Section - Updated when children are loaded */}
      <ParentDashboardStats children={children} />

      {/* Children Grid Section */}
      <div>
        <h2 className="text-xl font-bold mb-4">Your Children</h2>
        <ParentChildrenGrid />
      </div>
    </div>
  );
};

export default ParentDashboard;
