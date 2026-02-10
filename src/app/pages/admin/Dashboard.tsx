import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest, fetchAllPages } from '../../../utils/apiUtils';

export function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ 
    totalEmployees: 0, 
    totalDepartments: 0,
    presentToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuItems = [
    { path: '/admin-dashboard', icon: 'bi-speedometer2', label: 'Dashboard' },
    { path: '/employees', icon: 'bi-people', label: 'Employees' },
    { path: '/departments', icon: 'bi-building', label: 'Departments' },
    { path: '/mark-attendance', icon: 'bi-calendar-check', label: 'Mark Attendance' },
    { path: '/leave-management', icon: 'bi-calendar-x', label: 'Leave Management' },
    { path: '/salary-management', icon: 'bi-cash-coin', label: 'Salary Management' },
  ];

  useEffect(() => {
    const user = localStorage.getItem('user');
    console.log('Admin Dashboard - User from localStorage:', user);
    
    if (!user) {
      console.log('No user found, redirecting to login');
      navigate('/login');
      return;
    }
    
    const userData = JSON.parse(user);
    console.log('Admin Dashboard - Parsed user data:', userData);
    console.log('Admin Dashboard - is_superuser:', userData.is_superuser);
    console.log('Admin Dashboard - is_staff:', userData.is_staff);
    
    if (!(userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin'))) {
      console.log('Access denied - not admin user');
      toast.error('Access denied. Only admin users can access this page.');
      navigate('/employee-dashboard');
      return;
    }
    
    console.log('Admin access granted');
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    
    try {
      const [allEmployees, allDepartments] = await Promise.all([
        fetchAllPages(`${config.api.host}${config.api.user}`),
        fetchAllPages(`${config.api.host}${config.api.department}`)
      ]);
      
      const regularEmployees = allEmployees.filter((emp: any) => 
        !emp.is_superuser && emp.username !== 'admin'
      );
      
      setStats(prev => ({ 
        ...prev, 
        totalEmployees: regularEmployees.length,
        totalDepartments: allDepartments.length
      }));

      const allAttendances = await fetchAllPages(`${config.api.host}${config.api.attendance}`);
      const today = new Date().toISOString().split('T')[0];
      const todayAttendances = allAttendances.filter((att: any) => att.date === today);
      
      const presentToday = todayAttendances.filter((att: any) => {
        if (!att.check_in) return false;
        
        if (att.total_hours) {
          const [hours, minutes, seconds] = att.total_hours.split(':').map(Number);
          const totalHours = hours + minutes / 60 + seconds / 3600;
          return totalHours >= 7;
        }
        
        if (att.check_in && !att.check_out) {
          return true;
        }
        
        if (att.check_in && att.check_out) {
          const checkIn = new Date(`1970-01-01T${att.check_in}`);
          const checkOut = new Date(`1970-01-01T${att.check_out}`);
          const totalHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          return totalHours >= 7;
        }
        
        return false;
      }).length;
      
      setStats(prev => ({ 
        ...prev, 
        presentToday: presentToday
      }));
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-vh-100 bg-light d-flex">
      <Toaster position="bottom-center" />
      
      {/* Sidebar */}
      <div className={`text-white ${sidebarCollapsed ? 'collapsed-sidebar' : 'sidebar'}`} style={{
        width: sidebarCollapsed ? '80px' : '260px',
        transition: 'width 0.3s',
        position: 'fixed',
        height: '100vh',
        overflowY: 'auto',
        zIndex: 1000,
        background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div className="p-3 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {!sidebarCollapsed && <h5 className="mb-0"><i className="bi bi-building me-2"></i>HR System</h5>}
          <button 
            className="btn btn-sm btn-outline-light" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <i className={`bi bi-${sidebarCollapsed ? 'chevron-right' : 'chevron-left'}`}></i>
          </button>
        </div>
        
        <nav className="nav flex-column p-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link text-white rounded mb-2 d-flex align-items-center ${location.pathname === item.path ? '' : ''}`}
              style={{
                padding: '12px 16px',
                transition: 'all 0.2s',
                textDecoration: 'none',
                background: location.pathname === item.path ? 'rgba(255,255,255,0.2)' : 'transparent',
                boxShadow: location.pathname === item.path ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <i className={`bi ${item.icon} fs-5`} style={{ minWidth: '24px' }}></i>
              {!sidebarCollapsed && <span className="ms-3">{item.label}</span>}
            </Link>
          ))}
        </nav>
        
        <div className="position-absolute bottom-0 w-100 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            className="btn w-100 d-flex align-items-center justify-content-center text-white" 
            onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none' }}
          >
            <i className="bi bi-box-arrow-right"></i>
            {!sidebarCollapsed && <span className="ms-2">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1" style={{ marginLeft: sidebarCollapsed ? '80px' : '260px', transition: 'margin-left 0.3s' }}>
        <nav className="navbar navbar-expand-lg shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="container-fluid">
            <span className="navbar-brand fw-bold text-white">Admin Dashboard</span>
            <div className="navbar-nav ms-auto">
              <span className="nav-link text-white"><i className="bi bi-person-circle me-2"></i>Admin</span>
            </div>
          </div>
        </nav>

        <div className="container-fluid p-4" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: 'calc(100vh - 56px)' }}>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-lg" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)' }}>
                <div className="card-body text-white p-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h2 className="fw-bold mb-1">{loading ? '...' : stats.totalEmployees}</h2>
                      <p className="mb-0 opacity-75">Total Employees</p>
                    </div>
                    <div className="bg-white bg-opacity-25 rounded-circle p-3">
                      <i className="bi bi-people fs-1"></i>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                    <small className="opacity-75"><i className="bi bi-arrow-up me-1"></i>Active workforce</small>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="card border-0 shadow-lg" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', boxShadow: '0 10px 30px rgba(240, 147, 251, 0.3)' }}>
                <div className="card-body text-white p-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h2 className="fw-bold mb-1">{loading ? '...' : stats.totalDepartments}</h2>
                      <p className="mb-0 opacity-75">Total Departments</p>
                    </div>
                    <div className="bg-white bg-opacity-25 rounded-circle p-3">
                      <i className="bi bi-building fs-1"></i>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                    <small className="opacity-75"><i className="bi bi-diagram-3 me-1"></i>Organization units</small>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="card border-0 shadow-lg" style={{ borderRadius: '20px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', boxShadow: '0 10px 30px rgba(79, 172, 254, 0.3)' }}>
                <div className="card-body text-white p-4">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h2 className="fw-bold mb-1">{loading ? '...' : stats.presentToday}</h2>
                      <p className="mb-0 opacity-75">Present Today</p>
                    </div>
                    <div className="bg-white bg-opacity-25 rounded-circle p-3">
                      <i className="bi bi-person-check fs-1"></i>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-top border-white border-opacity-25">
                    <small className="opacity-75"><i className="bi bi-calendar-check me-1"></i>{stats.totalEmployees > 0 ? Math.round((stats.presentToday/stats.totalEmployees)*100) : 0}% attendance rate</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-4 mt-2">
            <div className="col-md-6">
              <div className="card border-0 shadow-lg" style={{ borderRadius: '20px', height: '300px', background: 'white', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)' }}>
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4" style={{ color: '#667eea' }}><i className="bi bi-graph-up me-2"></i>Attendance Overview</h5>
                  <div className="d-flex align-items-center justify-content-center" style={{ height: '200px' }}>
                    <div className="text-center">
                      <div className="position-relative d-inline-block">
                        <svg width="180" height="180">
                          <circle cx="90" cy="90" r="70" fill="none" stroke="#e9ecef" strokeWidth="20"/>
                          <circle cx="90" cy="90" r="70" fill="none" stroke="#4facfe" strokeWidth="20" 
                            strokeDasharray={`${stats.totalEmployees > 0 ? (stats.presentToday/stats.totalEmployees)*440 : 0} 440`}
                            strokeLinecap="round" transform="rotate(-90 90 90)"/>
                        </svg>
                        <div className="position-absolute top-50 start-50 translate-middle">
                          <h2 className="fw-bold mb-0" style={{ color: '#667eea' }}>{stats.totalEmployees > 0 ? Math.round((stats.presentToday/stats.totalEmployees)*100) : 0}%</h2>
                          <small style={{ color: '#6c757d' }}>Present</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card border-0 shadow-lg" style={{ borderRadius: '20px', height: '300px', background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', boxShadow: '0 10px 30px rgba(250, 112, 154, 0.3)' }}>
                <div className="card-body p-4 text-white">
                  <h5 className="fw-bold mb-4"><i className="bi bi-bar-chart-fill me-2"></i>Today's Summary</h5>
                  <div className="row h-75">
                    <div className="col-4 text-center d-flex flex-column justify-content-center">
                      <div className="bg-white bg-opacity-25 rounded-circle p-3 mx-auto mb-2" style={{ width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-person-check fs-2"></i>
                      </div>
                      <h3 className="fw-bold mb-0">{stats.presentToday}</h3>
                      <small className="opacity-75">Present</small>
                    </div>
                    <div className="col-4 text-center d-flex flex-column justify-content-center">
                      <div className="bg-white bg-opacity-25 rounded-circle p-3 mx-auto mb-2" style={{ width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-person-x fs-2"></i>
                      </div>
                      <h3 className="fw-bold mb-0">{stats.totalEmployees - stats.presentToday}</h3>
                      <small className="opacity-75">Absent</small>
                    </div>
                    <div className="col-4 text-center d-flex flex-column justify-content-center">
                      <div className="bg-white bg-opacity-25 rounded-circle p-3 mx-auto mb-2" style={{ width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-building fs-2"></i>
                      </div>
                      <h3 className="fw-bold mb-0">{stats.totalDepartments}</h3>
                      <small className="opacity-75">Departments</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
