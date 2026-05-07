import { createContext, useState, useEffect, useContext } from "react";
import { api } from "@/lib/api";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";

export type MasterUser = {
  id: string;
  email: string;
  role: "super_admin" | "platform_admin" | "school_manager" | "support";
  name: string;
};

type MasterAuthContextType = {
  masterUser: MasterUser | null;
  masterLoading: boolean;
  masterLogout: () => Promise<void>;
  refetchMasterUser: () => Promise<void>;
  isMasterAuthenticated: boolean;
  forceRefreshAuth: () => Promise<void>;
};

const MasterAuthContext = createContext<MasterAuthContextType>({
  masterUser: null,
  masterLoading: true,
  masterLogout: async () => {},
  refetchMasterUser: async () => {},
  isMasterAuthenticated: false,
  forceRefreshAuth: async () => {},
});

export const MasterAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [masterUser, setMasterUser] = useState<MasterUser | null>(null);
  const [masterLoading, setMasterLoading] = useState(true);

  const fetchMasterUser = async () => {
    try {
      const response = await api.get("/master/auth/me");
      setMasterUser(response.data.user);
    } catch {
      setMasterUser(null);
    }
  };

  const refetchMasterUser = async () => {
    await fetchMasterUser();
  };

  const masterLogout = async () => {
    try {
      await api.post("/master/auth/logout");
    } catch {
    } finally {
      setMasterUser(null);
      window.location.href = MASTER_LOGIN_PATH;
    }
  };

  const forceRefreshAuth = async () => {
    setMasterLoading(true);
    await fetchMasterUser();
    setMasterLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    
    const bootstrapAuth = async () => {
      setMasterLoading(true);
      await fetchMasterUser();
      if (!cancelled) {
        setMasterLoading(false);
      }
    };

    bootstrapAuth();
    
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MasterAuthContext.Provider
      value={{ 
        masterUser, 
        masterLoading, 
        masterLogout, 
        refetchMasterUser,
        isMasterAuthenticated: Boolean(masterUser?.role === "super_admin"),
        forceRefreshAuth
      }}
    >
      {children}
    </MasterAuthContext.Provider>
  );
};

export const useMasterAuth = () => {
  const context = useContext(MasterAuthContext);
  if (!context) {
    throw new Error("useMasterAuth must be used within a MasterAuthProvider");
  }
  return context;
};