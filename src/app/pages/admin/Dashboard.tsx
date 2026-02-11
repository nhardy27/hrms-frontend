import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from "../../../utils/apiUtils";

export function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState({ 
    totalEmployees: 0, 
    totalDepartments: 0,
    presentToday: 0,
    pendingLeaves: 0,
    paidSalaries: 0,
    unpaidSalaries: 0
  });

  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const menuItems = [
    { path: "/admin-dashboard", icon: "bi-speedometer2", label: "Dashboard" },
    { path: "/employees", icon: "bi-people", label: "Employees" },
    { path: "/departments", icon: "bi-building", label: "Departments" },
    { path: "/mark-attendance", icon: "bi-calendar-check", label: "Mark Attendance" },
    { path: "/leave-management", icon: "bi-calendar-x", label: "Leave Management" },
    { path: "/salary-management", icon: "bi-cash-coin", label: "Salary Management" },
  ];

  /* ============================
      AUTH + ADMIN CHECK
     ============================ */
  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      navigate("/login");
      return;
    }

    try {
      const userData = JSON.parse(user);

      const isAdmin =
        userData.is_superuser === true ||
        (userData.is_staff === true && userData.username === "admin");

      if (!isAdmin) {
        toast.error("Access denied. Only admin users can access this page.");
        navigate("/employee-dashboard");
        return;
      }

      fetchDashboardStats();
    } catch (error) {
      console.error("Error parsing user data:", error);
      navigate("/login");
    }
  }, [navigate]);

  const fetchDashboardStats = async () => {
    setLoading(true);

    try {
      const response = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.adminDashboard}`
      );

      if (response.ok) {
        const data = await response.json();
        setStats({
          totalEmployees: data.total_employees || 0,
          totalDepartments: data.total_departments || 0,
          presentToday: data.present_today || 0,
          pendingLeaves: data.pending_leaves || 0,
          paidSalaries: data.total_paid_salaries || 0,
          unpaidSalaries: data.total_unpaid_salaries || 0
        });
      } else {
        toast.error("Failed to load dashboard data");
      }
    } catch (error) {
      console.error("Admin dashboard error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const attendancePercentage =
    stats.totalEmployees > 0
      ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
      : 0;

  return (
    <div className="min-vh-100 bg-light d-flex">
      <Toaster position="bottom-center" />

      {/* ================= Sidebar ================= */}
      <div
        className="text-white"
        style={{
          width: sidebarCollapsed ? "80px" : "260px",
          transition: "width 0.3s",
          position: "fixed",
          height: "100vh",
          zIndex: 1000,
          background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div className="p-3 d-flex justify-content-between align-items-center border-bottom border-white border-opacity-25">
          {!sidebarCollapsed && (
            <h5 className="mb-0">
              <i className="bi bi-building me-2"></i>HR System
            </h5>
          )}
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <i
              className={`bi bi-${
                sidebarCollapsed ? "chevron-right" : "chevron-left"
              }`}
            ></i>
          </button>
        </div>

        <nav className="nav flex-column p-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="nav-link text-white rounded mb-2 d-flex align-items-center"
              style={{
                padding: "12px 16px",
                background:
                  location.pathname === item.path
                    ? "rgba(255,255,255,0.2)"
                    : "transparent",
              }}
            >
              <i className={`bi ${item.icon} fs-5`} />
              {!sidebarCollapsed && (
                <span className="ms-3">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="position-absolute bottom-0 w-100 p-3 border-top border-white border-opacity-25">
          <button
            className="btn w-100 text-white"
            onClick={handleLogout}
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <i className="bi bi-box-arrow-right"></i>
            {!sidebarCollapsed && <span className="ms-2">Logout</span>}
          </button>
        </div>
      </div>

      {/* ================= Main Content ================= */}
      <div
        className="flex-grow-1"
        style={{
          marginLeft: sidebarCollapsed ? "80px" : "260px",
          transition: "margin-left 0.3s",
        }}
      >
        <nav
          className="navbar shadow-sm"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          }}
        >
          <div className="container-fluid">
            <span className="navbar-brand fw-bold text-white">
              Admin Dashboard
            </span>
            <span className="text-white">
              <i className="bi bi-person-circle me-2"></i>Admin
            </span>
          </div>
        </nav>

        <div
          className="container-fluid p-4"
          style={{
            background:
              "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
            minHeight: "calc(100vh - 56px)",
          }}
        >
          {/* ================= Cards ================= */}
          <div className="row g-4">
            {[
              {
                title: "Total Departments",
                value: stats.totalDepartments,
                icon: "bi-building",
                gradient: "linear-gradient(135deg, #f093fb, #f5576c)",
                link: "/departments"
              },
              {
                title: "Total Employees",
                value: stats.totalEmployees,
                icon: "bi-people",
                gradient: "linear-gradient(135deg, #667eea, #764ba2)",
                link: "/employees"
              },
              {
                title: "Present Today",
                value: stats.presentToday,
                icon: "bi-person-check",
                gradient: "linear-gradient(135deg, #4facfe, #00f2fe)",
                link: "/mark-attendance"
              },
            ].map((card, index) => (
              <div key={index} className="col-md-4">
                <div
                  className="card border-0 shadow-lg text-white"
                  style={{ 
                    borderRadius: 20, 
                    background: card.gradient,
                    cursor: 'pointer',
                    transform: 'scale(1)',
                    transition: 'transform 0.2s'
                  }}
                  onClick={() => navigate(card.link)}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div className="card-body p-4 d-flex justify-content-between">
                    <div>
                      <h2 className="fw-bold">
                        {loading ? "..." : card.value}
                      </h2>
                      <p className="opacity-75 mb-0">{card.title}</p>
                    </div>
                    <i className={`bi ${card.icon} fs-1 opacity-75`} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-4 mt-2">
            <div className="col-md-4">
              <div
                className="card border-0 shadow-lg text-white"
                style={{ 
                  borderRadius: 20, 
                  background: "linear-gradient(135deg, #fa709a, #fee140)",
                  cursor: 'pointer',
                  transform: 'scale(1)',
                  transition: 'transform 0.2s'
                }}
                onClick={() => navigate('/leave-management')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className="card-body p-4 d-flex justify-content-between">
                  <div>
                    <h2 className="fw-bold">{loading ? "..." : stats.pendingLeaves}</h2>
                    <p className="opacity-75 mb-0">Pending Leaves</p>
                  </div>
                  <i className="bi bi-calendar-x fs-1 opacity-75" />
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div
                className="card border-0 shadow-lg text-white"
                style={{ 
                  borderRadius: 20, 
                  background: "linear-gradient(135deg, #a8edea, #fed6e3)",
                  cursor: 'pointer',
                  transform: 'scale(1)',
                  transition: 'transform 0.2s'
                }}
                onClick={() => navigate('/salary-management')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className="card-body p-4 d-flex justify-content-between">
                  <div>
                    <h2 className="fw-bold">{loading ? "..." : stats.paidSalaries}</h2>
                    <p className="opacity-75 mb-0">Paid Salaries</p>
                  </div>
                  <i className="bi bi-cash-coin fs-1 opacity-75" />
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div
                className="card border-0 shadow-lg text-white"
                style={{ 
                  borderRadius: 20, 
                  background: "linear-gradient(135deg, #ffecd2, #fcb69f)",
                  cursor: 'pointer',
                  transform: 'scale(1)',
                  transition: 'transform 0.2s'
                }}
                onClick={() => navigate('/salary-management')}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div className="card-body p-4 d-flex justify-content-between">
                  <div>
                    <h2 className="fw-bold">{loading ? "..." : stats.unpaidSalaries}</h2>
                    <p className="opacity-75 mb-0">Unpaid Salaries</p>
                  </div>
                  <i className="bi bi-exclamation-triangle fs-1 opacity-75" />
                </div>
              </div>
            </div>
          </div>

          {/* ================= Attendance Overview ================= */}
          <div className="row g-4 mt-2">
            <div className="col-md-12">
              <div className="card border-0 shadow-lg" style={{ borderRadius: 20 }}>
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4" style={{ color: '#667eea' }}>
                    <i className="bi bi-graph-up me-2"></i>Today's Attendance Overview
                  </h5>
                  <div className="d-flex align-items-center justify-content-around">
                    <div className="text-center">
                      <div className="position-relative d-inline-block">
                        <svg width="180" height="180">
                          <circle cx="90" cy="90" r="70" fill="none" stroke="#e9ecef" strokeWidth="18"/>
                          <circle cx="90" cy="90" r="70" fill="none" stroke="#4facfe" strokeWidth="18" 
                            strokeDasharray={`${attendancePercentage * 4.4} 440`}
                            strokeLinecap="round" transform="rotate(-90 90 90)"/>
                        </svg>
                        <div className="position-absolute top-50 start-50 translate-middle">
                          <h1 className="fw-bold mb-0" style={{ color: '#667eea', fontSize: '2.5rem' }}>{attendancePercentage}%</h1>
                          <small className="text-muted">Attendance Rate</small>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex gap-5">
                      <div className="text-center">
                        <div className="mb-2" style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="bi bi-person-check fs-1 text-white"></i>
                        </div>
                        <h3 className="fw-bold mb-0">{stats.presentToday}</h3>
                        <small className="text-muted">Present</small>
                      </div>
                      <div className="text-center">
                        <div className="mb-2" style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #f093fb, #f5576c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="bi bi-person-x fs-1 text-white"></i>
                        </div>
                        <h3 className="fw-bold mb-0">{stats.totalEmployees - stats.presentToday}</h3>
                        <small className="text-muted">Absent</small>
                      </div>
                      <div className="text-center">
                        <div className="mb-2" style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="bi bi-people fs-1 text-white"></i>
                        </div>
                        <h3 className="fw-bold mb-0">{stats.totalEmployees}</h3>
                        <small className="text-muted">Total</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= Monthly Summary ================= */}
          <div className="row g-4 mt-2">
            <div className="col-md-12">
              <div className="card border-0 shadow-lg" style={{ borderRadius: 20 }}>
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-4" style={{ color: '#667eea' }}>
                    <i className="bi bi-calendar-month me-2"></i>This Month Summary - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h5>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <div className="p-3 rounded" style={{ background: 'linear-gradient(135deg, #667eea15, #764ba215)' }}>
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <small className="text-muted d-block">Total Working Days</small>
                            <h4 className="fw-bold mb-0" style={{ color: '#667eea' }}>{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}</h4>
                          </div>
                          <i className="bi bi-calendar3 fs-2" style={{ color: '#667eea', opacity: 0.3 }}></i>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="p-3 rounded" style={{ background: 'linear-gradient(135deg, #4facfe15, #00f2fe15)' }}>
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <small className="text-muted d-block">Avg Attendance</small>
                            <h4 className="fw-bold mb-0" style={{ color: '#4facfe' }}>{attendancePercentage}%</h4>
                          </div>
                          <i className="bi bi-graph-up-arrow fs-2" style={{ color: '#4facfe', opacity: 0.3 }}></i>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="p-3 rounded" style={{ background: 'linear-gradient(135deg, #fa709a15, #fee14015)' }}>
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <small className="text-muted d-block">Leaves Approved</small>
                            <h4 className="fw-bold mb-0" style={{ color: '#fa709a' }}>{stats.pendingLeaves}</h4>
                          </div>
                          <i className="bi bi-calendar-check fs-2" style={{ color: '#fa709a', opacity: 0.3 }}></i>
                        </div>
                      </div>
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
