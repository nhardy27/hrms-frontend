import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoadingAnimation } from "./components/LoadingAnimation";

const AdminDashboard      = lazy(() => import("./pages/admin/Dashboard").then(m => ({ default: m.AdminDashboard })));
const MarkAttendance      = lazy(() => import("./pages/admin/MarkAttendance").then(m => ({ default: m.MarkAttendance })));
const DepartmentManagement = lazy(() => import("./pages/admin/DepartmentManagement").then(m => ({ default: m.DepartmentPage })));
const DesignationManagement = lazy(() => import("./pages/admin/DesignationManagement").then(m => ({ default: m.DesignationPage })));
const EmployeeForm        = lazy(() => import("./pages/admin/EmployeeForm").then(m => ({ default: m.EmployeeForm })));
const EmployeeList        = lazy(() => import("./pages/admin/EmployeeList").then(m => ({ default: m.EmployeeList })));
const LeaveManagement     = lazy(() => import("./pages/admin/LeaveManagement").then(m => ({ default: m.LeaveManagement })));
const SalaryManagement    = lazy(() => import("./pages/admin/SalaryManagement").then(m => ({ default: m.SalaryManagement })));
const SalarySlip          = lazy(() => import("./pages/admin/SalarySlip").then(m => ({ default: m.SalarySlip })));
const EmployeeDashboard   = lazy(() => import("./pages/employee/Dashboard").then(m => ({ default: m.EmployeeDashboard })));
const EmployeeSalarySlip  = lazy(() => import("./pages/employee/EmployeeSalarySlip").then(m => ({ default: m.EmployeeSalarySlip })));
const Login               = lazy(() => import("./pages/Login"));

const Fallback = () => <LoadingAnimation />;

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
    element: <Suspense fallback={<Fallback />}><Login /></Suspense>,
  },
  {
    path: "/admin-dashboard",
    element: <Suspense fallback={<Fallback />}><AdminDashboard /></Suspense>,
  },
  {
    path: "/mark-attendance",
    element: <Suspense fallback={<Fallback />}><MarkAttendance /></Suspense>,
  },
  {
    path: "/employees",
    element: <Suspense fallback={<Fallback />}><EmployeeList /></Suspense>,
  },
  {
    path: "/employees/add",
    element: <Suspense fallback={<Fallback />}><EmployeeForm /></Suspense>,
  },
  {
    path: "/employees/edit/:id",
    element: <Suspense fallback={<Fallback />}><EmployeeForm /></Suspense>,
  },
  {
    path: "/departments",
    element: <Suspense fallback={<Fallback />}><DepartmentManagement /></Suspense>,
  },
  {
    path: "/designations",
    element: <Suspense fallback={<Fallback />}><DesignationManagement /></Suspense>,
  },
  {
    path: "/employee-dashboard",
    element: <Suspense fallback={<Fallback />}><EmployeeDashboard /></Suspense>,
  },
  {
    path: "/leave-management",
    element: <Suspense fallback={<Fallback />}><LeaveManagement /></Suspense>,
  },
  {
    path: "/salary-management",
    element: <Suspense fallback={<Fallback />}><SalaryManagement /></Suspense>,
  },
  {
    path: "/salary-slip/:id",
    element: <Suspense fallback={<Fallback />}><SalarySlip /></Suspense>,
  },
  {
    path: "/employee-salary-slip/:id",
    element: <Suspense fallback={<Fallback />}><EmployeeSalarySlip /></Suspense>,
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
