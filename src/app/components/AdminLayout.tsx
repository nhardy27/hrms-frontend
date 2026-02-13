import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AdminLayout({ children, title = 'Admin Dashboard' }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuItems = [
    { path: '/admin-dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/employees', icon: 'bi-people', label: 'Employees' },
    { path: '/departments', icon: 'bi-building', label: 'Departments' },
    { path: '/mark-attendance', icon: 'bi-calendar-check', label: 'Mark Attendance' },
    { path: '/leave-management', icon: 'bi-calendar-x', label: 'Leave Management' },
    { path: '/salary-management', icon: 'bi-cash-coin', label: 'Salary Management' },
  ];

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-vh-100 d-flex" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'collapsed-sidebar' : 'sidebar'}`} style={{
        width: sidebarCollapsed ? '80px' : '260px',
        transition: 'width 0.3s',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        zIndex: 1000,
        background: '#ffffff',
        borderRight: '1px solid #e9ecef'
      }}>
        <div className="p-3 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid #e9ecef' }}>
          {!sidebarCollapsed && (
            <div className="d-flex align-items-center gap-2">
              <img src="/Logo.png" alt="HR System" style={{ height: '40px', objectFit: 'contain' }} />
              <h5 className="mb-0" style={{ color: '#2c3e50' }}>HR System</h5>
            </div>
          )}
          <button 
            className="btn btn-sm btn-outline-dark" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            style={{ marginLeft: sidebarCollapsed ? 'auto' : '0', marginRight: sidebarCollapsed ? 'auto' : '0' }}
          >
            <i className="bi bi-layout-sidebar-inset"></i>
          </button>
        </div>
        
        <nav className="nav flex-column p-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link text-dark rounded mb-2 d-flex align-items-center ${location.pathname === item.path ? '' : ''}`}
              style={{
                padding: '12px 16px',
                transition: 'all 0.2s',
                textDecoration: 'none',
                background: location.pathname === item.path ? '#f8f9fa' : 'transparent',
                boxShadow: 'none'
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {item.icon === 'bi-speedometer2' ? (
                <img src="/Dashboard.png" alt="Dashboard" style={{ width: '24px', height: '24px', objectFit: 'contain', minWidth: '24px' }} />
              ) : (
                <i className={`bi ${item.icon} fs-5`} style={{ minWidth: '24px' }}></i>
              )}
              {!sidebarCollapsed && <span className="ms-3">{item.label}</span>}
            </Link>
          ))}
        </nav>
        
        <div className="position-absolute bottom-0 w-100 p-3" style={{ borderTop: '1px solid #e9ecef' }}>
          <button 
            className="btn w-100 d-flex align-items-center justify-content-center btn-outline-dark" 
            onClick={handleLogout}
            style={{ border: '1px solid #dee2e6' }}
          >
            <i className="bi bi-box-arrow-right"></i>
            {!sidebarCollapsed && <span className="ms-2">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1" style={{ marginLeft: sidebarCollapsed ? '80px' : '260px', transition: 'margin-left 0.3s' }}>
        <nav className="navbar navbar-expand-lg shadow-sm" style={{ background: '#ffffff', borderBottom: '1px solid #e9ecef' }}>
          <div className="container-fluid">
            <span className="navbar-brand fw-bold" style={{ color: '#2c3e50' }}>{title}</span>
            <div className="navbar-nav ms-auto">
              <span className="nav-link" style={{ color: '#2c3e50' }}><i className="bi bi-person-circle me-2"></i>Admin</span>
            </div>
          </div>
        </nav>
        
        <div className="content-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
}
