import { useAuth } from "@/hooks/AuthProvider";
import { Navigate, Outlet, useLocation } from "react-router";
import { Loader2 } from "lucide-react"; // Optional: for loading spinner
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/AppSidebar";
import { getRoleHomePath } from "@/lib/roleAccess";
import { AIChatbot } from "@/components/ai/AIChatbot";
import { OfflineBanner } from "@/components/offline/OfflineBanner";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/offline",
  "/onboarding/school",
  "/onboarding/join",
  "/onboarding/activate",
  "/master/login",
  "/master/onboarding/requests",
  "/master/schools",
  "/master/email-history",
  "/master/security",
];

const isPublicPath = (pathname: string) => {
  return PUBLIC_PATHS.some((publicPath) => 
    pathname === publicPath || pathname.startsWith(publicPath + "/")
  );
};

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

  if (isPublicPath(location.pathname)) {
    // Public pages render without auth layout
    return <Outlet />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rediriger tous les rôles depuis /dashboard vers leur page d'accueil
  if (location.pathname === "/dashboard") {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }
  

  return (
    <>
      <OfflineBanner />
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
      <AIChatbot />
    </SidebarProvider>
    </>
  );
};

export default PrivateRoutes;
