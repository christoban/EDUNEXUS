import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useMasterAuth } from "@/hooks/useMasterAuth";
import MasterLogin from "./MasterLogin";

export default function MasterEntry() {
  const { isMasterAuthenticated, masterLoading } = useMasterAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (masterLoading) return;

    if (isMasterAuthenticated) {
      navigate("/superadmin", { replace: true });
    }
  }, [isMasterAuthenticated, masterLoading, navigate]);

  if (masterLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#080c18]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3b82f6] border-t-transparent" />
      </div>
    );
  }

  if (isMasterAuthenticated) {
    return null;
  }

  return <MasterLogin />;
}