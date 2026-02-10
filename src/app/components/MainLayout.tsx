import { Outlet, Link, useLocation } from "react-router-dom";

export function MainLayout() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="d-flex vh-100">
      {/* Sidebar */}
      <div className="bg-white border-end" style={{ width: '250px', minWidth: '250px' }}>
        <div className="p-3 border-bottom">
          <h5 className="mb-0 fw-semibold text-primary">HRMS</h5>
        </div>
        <nav className="nav flex-column p-2">
          <Link
            to="/"
            className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active bg-primary text-white' : 'text-dark'}`}
          >
            <i className="bi bi-speedometer2 me-2"></i>
            Dashboard
          </Link>
          <Link
            to="/employees"
            className={`nav-link ${isActive('/employees') ? 'active bg-primary text-white' : 'text-dark'}`}
          >
            <i className="bi bi-people me-2"></i>
            Employees
          </Link>
          <Link
            to="/departments"
            className={`nav-link ${isActive('/departments') ? 'active bg-primary text-white' : 'text-dark'}`}
          >
            <i className="bi bi-building me-2"></i>
            Departments
          </Link>
          <Link
            to="/attendance"
            className={`nav-link ${isActive('/attendance') ? 'active bg-primary text-white' : 'text-dark'}`}
          >
            <i className="bi bi-calendar-check me-2"></i>
            Attendance
          </Link>
          <Link
            to="/leave"
            className={`nav-link ${isActive('/leave') ? 'active bg-primary text-white' : 'text-dark'}`}
          >
            <i className="bi bi-calendar-x me-2"></i>
            Leave Management
          </Link>
          <Link
            to="/employee-dashboard"
            className={`nav-link ${isActive('/employee-dashboard') ? 'active bg-primary text-white' : 'text-dark'}`}
          >
            <i className="bi bi-person-badge me-2"></i>
            My Dashboard
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-fill overflow-auto">
        {/* Header */}
        <header className="bg-white border-bottom p-3">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">HR Management System</h6>
            <div className="d-flex align-items-center gap-3">
              <span className="text-muted">Admin User</span>
              <Link to="/login" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-box-arrow-right me-1"></i>
                Logout
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
