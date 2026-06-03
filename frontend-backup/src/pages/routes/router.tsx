import { createBrowserRouter, Navigate } from "react-router"; // Keeping your requested import
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
import MasterEntryPage from "../master/MasterEntry";
import MasterEmailHistoryPage from "../master/MasterEmailHistory";
import MasterDecoyPage from "../master/MasterDecoy";
import DashboardSuperAdminPage from "../superadmin/DashboardSuperAdmin";
import ProtectedSuperAdminPage from "../superadmin/ProtectedSuperAdmin";
import SchoolsTablePage from "../superadmin/SchoolsTable";
import SuperAdminSecurity from "../superadmin/SuperAdminSecurity";
import { MASTER_LOGIN_ROUTE_PATH } from "@/lib/masterRoutes";
import OnboardingConfirmation from "../onboarding/OnboardingConfirmation";
import OfflinePage from "../Offline";

// Nouvelles pages Admin
import AdminDashboard from "../admin/Dashboard";
import AdminUsers from "../admin/Users";
import AdminClasses from "../admin/Classes";
import AdminSubjects from "../admin/Subjects";
import AdminSettings from "../admin/Settings";
import AdminGradeStatus from "../admin/GradeStatus";
import AdminReportCards from "../admin/ReportCards";
import AdminAbsences from "../admin/Absences";
import AdminYearEnd from "../admin/YearEnd";

// Nouvelles pages Teacher
import TeacherGrades from "../teacher/Grades";
import TeacherAttendance from "../teacher/Attendance";

// Nouvelles pages Staff
import TimetableEditor from "../staff/TimetableEditor";
import ClassCouncil from "../staff/ClassCouncil";
import GradeValidation from "../staff/GradeValidation";
import StaffFinance from "../staff/Finance";
import StaffCautions from "../staff/Cautions";

// Nouvelles pages IA
import TeacherAIInsights from "../teacher/AIInsights";

// Nouvelles pages Parent & Student
import ParentReportCards from "../parent/ReportCards";
import ParentPayments from "../parent/Payments";
import StudentReportCards from "../student/ReportCards";


export const router = createBrowserRouter([
  {
    children: [
      // public routes
      { index: true, element: <Home /> },
      { path: "login", element: <Login /> },
      { path: "offline", element: <OfflinePage /> },
      { path: "onboarding/school", element: <SchoolOnboardingPage /> },
      { path: "onboarding/confirmation", element: <OnboardingConfirmation /> },
      { path: "onboarding/join/:token", element: <SchoolOnboardingPage /> },
      { path: "master/login", element: <MasterDecoyPage /> },
      { path: MASTER_LOGIN_ROUTE_PATH, element: <MasterEntryPage /> },
      { path: "master/onboarding/requests", element: <Navigate to="/superadmin/requests" replace /> },
      { path: "master/schools", element: <Navigate to="/superadmin" replace /> },
      { path: "master/schools/:schoolId", element: <Navigate to="/superadmin" replace /> },
      { path: "master/email-history", element: <MasterEmailHistoryPage /> },
      { path: "master/security", element: <Navigate to="/superadmin/security" replace /> },
      { path: "superadmin", element: <ProtectedSuperAdminPage><DashboardSuperAdminPage /></ProtectedSuperAdminPage> },
      { path: "superadmin/dashboard", element: <ProtectedSuperAdminPage><DashboardSuperAdminPage /></ProtectedSuperAdminPage> },
      { path: "superadmin/schools", element: <ProtectedSuperAdminPage><SchoolsTablePage /></ProtectedSuperAdminPage> },
      { path: "superadmin/invite", element: <ProtectedSuperAdminPage><DashboardSuperAdminPage /></ProtectedSuperAdminPage> },
      { path: "superadmin/security", element: <ProtectedSuperAdminPage><SuperAdminSecurity /></ProtectedSuperAdminPage> },
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
            path: "users/staff",
            element: (
              <RoleGuard path="/users/staff">
                <UserManagementPage
                  role="staff"
                  title="Personnel"
                  description="Manage staff accounts and responsibilities."
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

          // ─── ADMIN ───────────────────────────────────────────────────
          {
            path: "admin/dashboard",
            element: <RoleGuard allowedRoles={["admin"]}><AdminDashboard /></RoleGuard>,
          },
          {
            path: "admin/users",
            element: <RoleGuard allowedRoles={["admin"]}><AdminUsers /></RoleGuard>,
          },
          {
            path: "admin/classes",
            element: <RoleGuard allowedRoles={["admin"]}><AdminClasses /></RoleGuard>,
          },
          {
            path: "admin/subjects",
            element: <RoleGuard allowedRoles={["admin"]}><AdminSubjects /></RoleGuard>,
          },
          {
            path: "admin/settings",
            element: <RoleGuard allowedRoles={["admin"]}><AdminSettings /></RoleGuard>,
          },
          {
            path: "admin/grades",
            element: <RoleGuard allowedRoles={["admin"]}><AdminGradeStatus /></RoleGuard>,
          },
          {
            path: "admin/report-cards",
            element: <RoleGuard allowedRoles={["admin"]}><AdminReportCards /></RoleGuard>,
          },
          {
            path: "admin/absences",
            element: <RoleGuard allowedRoles={["admin"]}><AdminAbsences /></RoleGuard>,
          },
          {
            path: "admin/year-end",
            element: <RoleGuard allowedRoles={["admin"]}><AdminYearEnd /></RoleGuard>,
          },

          // ─── TEACHER ─────────────────────────────────────────────────
          {
            path: "teacher/grades",
            element: <RoleGuard allowedRoles={["teacher", "admin"]}><TeacherGrades /></RoleGuard>,
          },
          {
            path: "teacher/attendance",
            element: <RoleGuard allowedRoles={["teacher", "admin"]}><TeacherAttendance /></RoleGuard>,
          },
          {
            path: "teacher/ai-insights",
            element: <RoleGuard allowedRoles={["teacher", "admin"]}><TeacherAIInsights /></RoleGuard>,
          },

          // ─── STAFF ───────────────────────────────────────────────────
          {
            path: "staff/timetable",
            element: <RoleGuard allowedRoles={["staff", "admin"]}><TimetableEditor /></RoleGuard>,
          },
          {
            path: "staff/class-council",
            element: <RoleGuard allowedRoles={["staff", "admin"]}><ClassCouncil /></RoleGuard>,
          },
          {
            path: "staff/grade-validation",
            element: <RoleGuard allowedRoles={["staff", "admin"]}><GradeValidation /></RoleGuard>,
          },

          // ─── STAFF FINANCE ───────────────────────────────────────────
          {
            path: "staff/finance",
            element: <RoleGuard allowedRoles={["admin", "staff"]}><StaffFinance /></RoleGuard>,
          },
          {
            path: "staff/cautions",
            element: <RoleGuard allowedRoles={["admin", "staff"]}><StaffCautions /></RoleGuard>,
          },

          // ─── PARENT ──────────────────────────────────────────────────
          {
            path: "parent/report-cards",
            element: <RoleGuard allowedRoles={["parent"]}><ParentReportCards /></RoleGuard>,
          },
          {
            path: "parent/payments",
            element: <RoleGuard allowedRoles={["parent"]}><ParentPayments /></RoleGuard>,
          },

          // ─── STUDENT ─────────────────────────────────────────────────
          {
            path: "student/report-cards",
            element: <RoleGuard allowedRoles={["student"]}><StudentReportCards /></RoleGuard>,
          },
        ],
      },
    ],
  },
]);
