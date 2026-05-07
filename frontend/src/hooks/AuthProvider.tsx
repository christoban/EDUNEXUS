import { createContext, useState, useEffect, useContext } from "react";
import { api } from "@/lib/api";
import type { academicYear, user } from "@/types";

// 1. Create Context
const AuthContext = createContext<{
  user: user | null;
  setUser: React.Dispatch<React.SetStateAction<user | null>>;
  loading: boolean;
  year: academicYear | null;
  setYear: React.Dispatch<React.SetStateAction<academicYear | null>>;
}>({
  user: null,
  setUser: () => {},
  loading: true,
  year: null,
  setYear: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<user | null>(null);
  const [loading, setLoading] = useState(true); // <--- Vital for preventing "flicker"
  const [year, setYear] = useState<academicYear | null>(null);

  useEffect(() => {
    const bootstrapAuth = async () => {
      setLoading(true);

      const [profileResult, yearResult] = await Promise.allSettled([
        api.get("/users/profile"),
        api.get("/academic-years/current"),
      ]);

      if (profileResult.status === "fulfilled") {
        setUser(profileResult.value.data.user);
      } else {
        setUser(null);
      }

      if (yearResult.status === "fulfilled") {
        setYear(yearResult.value.data);
      } else {
        setYear(null);
      }

      setLoading(false);
    };

    bootstrapAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, year, setYear }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
