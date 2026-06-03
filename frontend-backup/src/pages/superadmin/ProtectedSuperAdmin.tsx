import React from "react";
import { Navigate } from "react-router";
import { Loader2 } from "lucide-react";
import { useMasterAuth } from "@/hooks/useMasterAuth";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";

const ProtectedSuperAdmin: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isMasterAuthenticated, masterLoading } = useMasterAuth();

  // Redirect immediately if not authenticated, even while loading
  if (!isMasterAuthenticated) {
    return <Navigate to={MASTER_LOGIN_PATH} replace />;
  }

  if (masterLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#080c18]">
        <Loader2 className="h-8 w-8 animate-spin text-[#60a5fa]" />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedSuperAdmin;