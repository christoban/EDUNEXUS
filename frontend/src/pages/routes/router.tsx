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

export const router = createBrowserRouter([
  {
    children: [
      // public routes
      { index: true, element: <Home /> },
      { path: "login", element: <Login /> },
      // protected routes would go here
      {
        element: <PrivateRoutes />, // Assuming PrivateRoutes is imported
        children: [
          { path: "dashboard", element: <Dashboard /> },
          { path: "activities-log", element: <Dashboard /> },
          {
            path: "users/students",
            element: (
              <RoleGuard allowedRoles={["admin"]}>
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
              <RoleGuard allowedRoles={["admin"]}>
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
              <RoleGuard allowedRoles={["admin"]}>
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
              <RoleGuard allowedRoles={["admin"]}>
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
              <RoleGuard allowedRoles={["admin"]}>
                <Classes />
              </RoleGuard>
            ),
          },
          {
            path: "subjects",
            element: (
              <RoleGuard allowedRoles={["admin"]}>
                <Subjects />
              </RoleGuard>
            ),
          },
          {
            path: "timetable",
            element: <Timetable />,
          },
          {
            path: "attendance",
            element: <AttendancePage />,
          },
          {
            path: "lms/exams",
            element: <Exams />,
          },
          {
            path: "lms/exams/:id",
            element: <Exam />,
          },
          {
            path: "lms/report-cards",
            element: (
              <RoleGuard allowedRoles={["admin", "teacher", "student"]}>
                <ReportCardsPage />
              </RoleGuard>
            ),
          },
          {
            path: "settings/academic-years",
            element: (
              <RoleGuard allowedRoles={["admin"]}>
                <AcademicYear />
              </RoleGuard>
            ),
          },
          {
            path: "settings/email-history",
            element: (
              <RoleGuard allowedRoles={["admin"]}>
                <EmailHistoryPage />
              </RoleGuard>
            ),
          },
          {
            path: "parent/dashboard",
            element: (
              <RoleGuard allowedRoles={["parent"]}>
                <ParentDashboard />
              </RoleGuard>
            ),
          },
          {
            path: "parent/children/:childId",
            element: (
              <RoleGuard allowedRoles={["parent"]}>
                <ChildDetails />
              </RoleGuard>
            ),
          },
        ],
      },
    ],
  },
]);
