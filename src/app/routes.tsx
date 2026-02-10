import { createBrowserRouter } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import { 
  AdminDashboard, 
  MarkAttendance,
  DepartmentManagement,
  EmployeeForm,
  EmployeeList,
  LeaveManagement,
  SalaryManagement
} from "./pages/admin";
import { EmployeeDashboard } from "./pages/employee";
import Login from "./pages/Login";

export const router = createBrowserRouter([
  {
    path: "/",
    loader: () => {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
        },
      });
    },
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/admin-dashboard",
    Component: AdminDashboard,
  },
  {
    path: "/mark-attendance",
    Component: MarkAttendance,
  },
  {
    path: "/employees",
    Component: EmployeeList,
  },
  {
    path: "/employees/add",
    Component: EmployeeForm,
  },
  {
    path: "/employees/edit/:id",
    Component: EmployeeForm,
  },
  {
    path: "/departments",
    Component: DepartmentManagement,
  },
  {
    path: "/employee-dashboard",
    Component: EmployeeDashboard,
  },
  {
    path: "/leave-management",
    Component: LeaveManagement,
  },
  {
    path: "/salary-management",
    Component: SalaryManagement,
  },

  {
    path: "*",
    element: (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center">
          <h1 className="display-1 text-muted">404</h1>
          <h3>Page Not Found</h3>
          <p className="text-muted">The page you are looking for does not exist.</p>
          <a href="/login" className="btn btn-primary">Go to Login</a>
        </div>
      </div>
    ),
  },
]);
