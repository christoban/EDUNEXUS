"use client";

import {
  Settings2,
  School,
  GraduationCap,
  Users,
  LayoutDashboard,
  Wallet,
  LogOut,
} from "lucide-react";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import { TeamSwitcher } from "@/components/sidebar/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { UserRole } from "@/types";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/AuthProvider";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToogle } from "./ThemeToogle";
import { SIDEBAR_NAV_POLICY, canAccessPath } from "@/lib/accessPolicy";
import { useUILanguage } from "@/hooks/useUILanguage";
import { t } from "@/lib/i18n";

const ICON_MAP = {
  LayoutDashboard,
  School,
  GraduationCap,
  Users,
  Settings2,
  Wallet,
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, year, setUser } = useAuth();
  const location = useLocation(); // <--- Get current URL
  const pathname = location.pathname; // e.g., "/dashboard/analytics"
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const navigate = useNavigate();
  const language = useUILanguage();
  const [schoolBrand, setSchoolBrand] = useState({
    schoolName: "EDUNEXUS Education",
    schoolLogoUrl: "",
  });

  useEffect(() => {
    const loadSchoolBrand = async () => {
      try {
        const { data } = await api.get("/school-settings");
        setSchoolBrand({
          schoolName: data?.schoolName || "EDUNEXUS Education",
          schoolLogoUrl: data?.schoolLogoUrl || "",
        });
      } catch {
        // Keep fallback branding when settings cannot be loaded.
      }
    };

    const handleBrandUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ schoolName?: string; schoolLogoUrl?: string }>;
      setSchoolBrand({
        schoolName: customEvent.detail?.schoolName || "EDUNEXUS Education",
        schoolLogoUrl: customEvent.detail?.schoolLogoUrl || "",
      });
    };

    loadSchoolBrand();
    window.addEventListener("school-settings-updated", handleBrandUpdated);

    return () => {
      window.removeEventListener("school-settings-updated", handleBrandUpdated);
    };
  }, []);

  const userData = {
    name: user?.name || "User",
    email: user?.email || "",
    avatar: "",
  };

  const userRole = (user?.role || "student") as UserRole;
  const teams = useMemo(
    () => [
      {
        name: schoolBrand.schoolName || "EDUNEXUS Education",
        logo: School,
        logoUrl: schoolBrand.schoolLogoUrl || undefined,
      },
    ],
    [schoolBrand.schoolLogoUrl, schoolBrand.schoolName]
  );

  const filteredNav = useMemo(() => {
    const sectionTitleMap: Record<string, string> = {
      Dashboard: "nav.section.dashboard",
      Academics: "nav.section.academics",
      "Learning (LMS)": "nav.section.learning",
      People: "nav.section.people",
      System: "nav.section.system",
      Finance: "nav.section.finance",
      "Parent Portal": "nav.section.parentPortal",
    };

    const itemTitleMap: Record<string, string> = {
      Dashboard: "nav.item.dashboard",
      "Activities Log": "nav.item.activitiesLog",
      Classes: "nav.item.classes",
      Subjects: "nav.item.subjects",
      Timetable: "nav.item.timetable",
      Attendance: "nav.item.attendance",
      Exams: "nav.item.exams",
      "Report Cards": "nav.item.reportCards",
      Students: "nav.item.students",
      Teachers: "nav.item.teachers",
      Parents: "nav.item.parents",
      Admins: "nav.item.admins",
      "School Settings": "nav.item.schoolSettings",
      "Manage Subjects": "nav.item.manageSubjects",
      "Academic Years": "nav.item.academicYears",
      "Email History": "nav.item.emailHistory",
      "Roles & Permissions": "nav.item.rolesPermissions",
      "Plans de Frais": "nav.item.feePlans",
      Facturation: "nav.item.invoices",
      Paiements: "nav.item.payments",
      Depenses: "nav.item.expenses",
      Relances: "nav.item.reminders",
      "My Children": "nav.item.myChildren",
      Settings: "nav.item.settings",
    };

    return SIDEBAR_NAV_POLICY
      .map((section) => {
        const visibleItems = section.items.filter((subItem) =>
          canAccessPath(userRole, subItem.url)
        );

        if (visibleItems.length === 0) {
          return null;
        }

        const isChildActive = visibleItems.some((sub) => sub.url === pathname);

        return {
          title: t(sectionTitleMap[section.title] || section.title, language),
          url: visibleItems[0]?.url || "#",
          icon: ICON_MAP[section.icon],
          isActive: isChildActive,
          items: visibleItems.map((subItem) => ({
            ...subItem,
            title: t(itemTitleMap[subItem.title] || subItem.title, language),
            isActive: subItem.url === pathname,
          })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [pathname, userRole, language]);

  const logout = async () => {
    try {
      await api.post("/users/logout").finally(() => {
        setUser(null);
        localStorage.removeItem("token");
        navigate("/login");
        toast.success(t("nav.logout.success", language));
      });
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error(t("nav.logout.error", language));
    }
  };
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} yearName={year?.name || t("nav.yearNotSet", language)} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNav} />
      </SidebarContent>
      <SidebarFooter>
        <div
          className={cn(
            "gap-2",
            isCollapsed ? "flex-row space-y-2" : "flex justify-between",
          )}
        >
          <SidebarMenuItem title={t("nav.logout", language)}>
            <Button onClick={logout} variant={"ghost"} size="icon-sm">
              <LogOut />
            </Button>
          </SidebarMenuItem>
          <ThemeToogle />
        </div>
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
