import { createBrowserRouter } from "react-router"; // Keeping your requested import
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import PrivateRoutes from "@/pages/routes/PrivateRoutes";
import Dashboard from "@/pages/Dashboard";
import AcademicYear from "@/pages/settings/academic-year";
import EmailHistoryPage from "@/pages/settings/EmailHistory";
import UserManagementPage from "@/pages/users";
import Classes from "@/pages/academics/Classes";
import { Subjects } from "@/pages/academics/Subjects";
import Timetable from "@/pages/academics/Timetable";
import AttendancePage from "@/pages/academics/Attendance";
import Exams from "@/pages/lms/Exams";
import Exam from "../lms/Exam";
import ReportCardsPage from "../lms/ReportCards";
import RoleGuard from "./RoleGuard";
import ParentDashboard from "../parent/ParentDashboard";
import ChildDetails from "../parent/ChildDetails";
import { ParentSettings } from "../parent/ParentSettings";
import FeePlansPage from "../finance/FeePlans";
import PaymentsPage from "../finance/Payments";
import OverdueAndRemindersPage from "../finance/OverdueAndReminders";
import InvoicesPage from "../finance/Invoices";
import ExpensesPage from "../finance/Expenses";
import SubjectsPage from "../settings/Subjects";
import SchoolConfigurationPage from "../settings/SchoolConfiguration";
import SchoolOnboardingPage from "../onboarding/SchoolOnboarding";
import SchoolInvitePage from "../onboarding/SchoolInvite";
import SchoolOnboardingRequestsPage from "../onboarding/SchoolOnboardingRequests";
import MasterLoginPage from "../master/MasterLogin";
import MasterSchoolsPage from "../master/MasterSchools";
import MasterSchoolDetailPage from "../master/MasterSchoolDetail";
import MasterEmailHistoryPage from "../master/MasterEmailHistory";
import MasterDecoyPage from "../master/MasterDecoy";
import MasterSecurityPage from "../master/MasterSecurity";
import DashboardSuperAdminPage from "../superadmin/DashboardSuperAdmin";
import ProtectedSuperAdminPage from "../superadmin/ProtectedSuperAdmin";
import SchoolsTablePage from "../superadmin/SchoolsTable";
import InviteSchoolFormPage from "../superadmin/InviteSchoolForm";
import { MASTER_LOGIN_ROUTE_PATH } from "@/lib/masterRoutes";

export const router = createBrowserRouter([
  {
    children: [
      // public routes
      { index: true, element: <Home /> },
      { path: "login", element: <Login /> },
      { path: "onboarding/school", element: <SchoolOnboardingPage /> },
      { path: "onboarding/invite/:token", element: <SchoolInvitePage /> },
      { path: "master/login", element: <MasterDecoyPage /> },
      { path: MASTER_LOGIN_ROUTE_PATH, element: <MasterLoginPage /> },
      { path: "master/onboarding/requests", element: <SchoolOnboardingRequestsPage /> },
      { path: "master/schools", element: <MasterSchoolsPage /> },
      { path: "master/schools/:schoolId", element: <MasterSchoolDetailPage /> },
      { path: "master/email-history", element: <MasterEmailHistoryPage /> },
      { path: "master/security", element: <MasterSecurityPage /> },
      { path: "superadmin", element: <ProtectedSuperAdminPage><DashboardSuperAdminPage /></ProtectedSuperAdminPage> },
      { path: "superadmin/dashboard", element: <ProtectedSuperAdminPage><DashboardSuperAdminPage /></ProtectedSuperAdminPage> },
      { path: "superadmin/schools", element: <ProtectedSuperAdminPage><SchoolsTablePage /></ProtectedSuperAdminPage> },
      { path: "superadmin/invite", element: <ProtectedSuperAdminPage><InviteSchoolFormPage /></ProtectedSuperAdminPage> },
      // protected routes would go here
      {
        element: <PrivateRoutes />, // Assuming PrivateRoutes is imported
        children: [
          {
            path: "dashboard",
            element: (
              <RoleGuard path="/dashboard">
                <Dashboard />
              </RoleGuard>
            ),
          },
          {
            path: "activities-log",
            element: (
              <RoleGuard path="/activities-log">
                <Dashboard />
              </RoleGuard>
            ),
          },
          {
            path: "users/students",
            element: (
              <RoleGuard path="/users/students">
                <UserManagementPage
                  role="student"
                  title="Students"
                  description="Manage student directory and class assignments."
                />
              </RoleGuard>
            ),
          },
          {
            path: "users/teachers",
            element: (
              <RoleGuard path="/users/teachers">
                <UserManagementPage
                  role="teacher"
                  title="Teachers"
                  description="Manage teaching staff."
                />
              </RoleGuard>
            ),
          },
          {
            path: "users/parents",
            element: (
              <RoleGuard path="/users/parents">
                <UserManagementPage
                  role="parent"
                  title="Parents"
                  description="Manage Parents."
                />
              </RoleGuard>
            ),
          },
          {
            path: "users/admins",
            element: (
              <RoleGuard path="/users/admins">
                <UserManagementPage
                  role="admin"
                  title="Admins"
                  description="Manage Admins."
                />
              </RoleGuard>
            ),
          },
          {
            path: "classes",
            element: (
              <RoleGuard path="/classes">
                <Classes />
              </RoleGuard>
            ),
          },
          {
            path: "subjects",
            element: (
              <RoleGuard path="/subjects">
                <Subjects />
              </RoleGuard>
            ),
          },
          {
            path: "timetable",
            element: (
              <RoleGuard path="/timetable">
                <Timetable />
              </RoleGuard>
            ),
          },
          {
            path: "attendance",
            element: (
              <RoleGuard path="/attendance">
                <AttendancePage />
              </RoleGuard>
            ),
          },
          {
            path: "lms/exams",
            element: (
              <RoleGuard path="/lms/exams">
                <Exams />
              </RoleGuard>
            ),
          },
          {
            path: "lms/exams/:id",
            element: (
              <RoleGuard path="/lms/exams/:id">
                <Exam />
              </RoleGuard>
            ),
          },
          {
            path: "lms/report-cards",
            element: (
              <RoleGuard path="/lms/report-cards">
                <ReportCardsPage />
              </RoleGuard>
            ),
          },
          {
            path: "settings/academic-years",
            element: (
              <RoleGuard path="/settings/academic-years">
                <AcademicYear />
              </RoleGuard>
            ),
          },
          {
            path: "settings/email-history",
            element: (
              <RoleGuard path="/settings/email-history">
                <EmailHistoryPage />
              </RoleGuard>
            ),
          },
          {
            path: "settings/subjects",
            element: (
              <RoleGuard path="/settings/subjects">
                <SubjectsPage />
              </RoleGuard>
            ),
          },
          {
            path: "settings/configuration",
            element: (
              <RoleGuard path="/settings/configuration">
                <SchoolConfigurationPage />
              </RoleGuard>
            ),
          },
          {
            path: "settings/school",
            element: (
              <RoleGuard path="/settings/school">
                <SchoolConfigurationPage />
              </RoleGuard>
            ),
          },
          {
            path: "finance/fee-plans",
            element: (
              <RoleGuard path="/finance/fee-plans">
                <FeePlansPage />
              </RoleGuard>
            ),
          },
          {
            path: "finance/payments",
            element: (
              <RoleGuard path="/finance/payments">
                <PaymentsPage />
              </RoleGuard>
            ),
          },
          {
            path: "finance/invoices",
            element: (
              <RoleGuard path="/finance/invoices">
                <InvoicesPage />
              </RoleGuard>
            ),
          },
          {
            path: "finance/reminders",
            element: (
              <RoleGuard path="/finance/reminders">
                <OverdueAndRemindersPage />
              </RoleGuard>
            ),
          },
          {
            path: "finance/expenses",
            element: (
              <RoleGuard path="/finance/expenses">
                <ExpensesPage />
              </RoleGuard>
            ),
          },
          {
            path: "parent/dashboard",
            element: (
              <RoleGuard path="/parent/dashboard">
                <ParentDashboard />
              </RoleGuard>
            ),
          },
          {
            path: "parent/settings",
            element: (
              <RoleGuard path="/parent/settings">
                <ParentSettings />
              </RoleGuard>
            ),
          },
          {
            path: "parent/children/:childId",
            element: (
              <RoleGuard path="/parent/children/:childId">
                <ChildDetails />
              </RoleGuard>
            ),
          },
        ],
      },
    ],
  },
]);
