import { useAuth } from "@/hooks/AuthProvider";
import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react"; // Optional: for loading spinner
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { getRoleHomePath } from "@/lib/roleAccess";

const PrivateRoutes = () => {
  const { loading, user, year } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Parents use a dedicated dashboard view.
  if (user.role === "parent" && location.pathname === "/dashboard") {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  // If admin has no year AND is NOT on academic-years page, redirect
  // But once on academic-years page, allow them to stay there to create one
  if (!year && user.role === "admin" && location.pathname !== "/settings/academic-years") {
    return <Navigate to="/settings/academic-years" replace />;
  }

  // Non-admins without year cannot proceed
  if (!year && user.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
};

export default PrivateRoutes;
