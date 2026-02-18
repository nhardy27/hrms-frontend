// React hooks for state management and side effects
import { useState, useEffect } from "react";
// Router hooks for navigation and routing
import { useNavigate } from "react-router-dom";
// Toast notifications for user feedback
import toast, { Toaster } from "react-hot-toast";
// API configuration
import config from "../../../config/global.json";
// Utility function for authenticated API calls
import { makeAuthenticatedRequest } from "../../../utils/apiUtils";
// Reusable Admin Layout component
import { AdminLayout } from "../../components/AdminLayout";

export function AdminDashboard() {
  // Hook to programmatically navigate between routes
  const navigate = useNavigate();

  // State to store dashboard statistics from API
  const [stats, setStats] = useState({ 
    totalEmployees: 0, 
    totalDepartments: 0,
    presentToday: 0,
    pendingLeaves: 0,
    paidSalaries: 0,
    unpaidSalaries: 0
  });

  // Loading state for data fetching
  const [loading, setLoading] = useState(true);

  /* ============================
      AUTH + ADMIN CHECK
     ============================ */
  // Effect runs on component mount to verify authentication and admin access
  useEffect(() => {
    // Get user data from localStorage
    const user = localStorage.getItem("user");

    // If no user found, redirect to login
    if (!user) {
      navigate("/login");
      return;
    }

    try {
      // Parse user data from JSON string
      const userData = JSON.parse(user);

      // Check if user has admin privileges
      const isAdmin =
        userData.is_superuser === true ||
        (userData.is_staff === true && userData.username === "admin");

      // If not admin, show error and redirect to employee dashboard
      if (!isAdmin) {
        toast.error("Access denied. Only admin users can access this page.");
        navigate("/employee-dashboard");
        return;
      }

      // If admin, fetch dashboard statistics
      fetchDashboardStats();
    } catch (error) {
      console.error("Error parsing user data:", error);
      navigate("/login");
    }
  }, [navigate]);

  // Function to fetch dashboard statistics from API
  const fetchDashboardStats = async () => {
    setLoading(true);

    try {
      // Make authenticated API request to get dashboard data
      const response = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.adminDashboard}`
      );

      if (response.ok) {
        // Parse response and update stats state
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
      // Always set loading to false when done
      setLoading(false);
    }
  };

  // Calculate attendance percentage based on present employees
  const attendancePercentage =
    stats.totalEmployees > 0
      ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
      : 0;

  return (
    <AdminLayout title="Admin Dashboard">
      {/* Toast notification container */}
      <Toaster position="bottom-center" />

      {/* Main dashboard content container */}
      <div
        className="container-fluid p-4"
        style={{
          background: "#ffffff",
          minHeight: "calc(100vh - 56px)",
        }}
      >
        {/* ================= Cards ================= */}
        {/* First row of statistics cards */}
        <div className="row g-4">
          {[
            {
              title: "Total Departments",
              value: stats.totalDepartments,
              icon: "bi-building",
              iconColor: "#3498db",
              gradient: "#ffffff",
              link: "/departments"
            },
            {
              title: "Total Employees",
              value: stats.totalEmployees,
              icon: "bi-people",
              iconColor: "#9b59b6",
              gradient: "#ffffff",
              link: "/employees"
            },
            {
              title: "Present Today",
              value: stats.presentToday,
              icon: "bi-person-check",
              iconColor: "#2ecc71",
              gradient: "#ffffff",
              link: "/mark-attendance"
            },
          ].map((card, index) => (
            <div key={index} className="col-12 col-md-6 col-lg-4">
              {/* Clickable card with hover effect */}
              <div
                className="card border-0 shadow-lg"
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
                    <h2 className="fw-bold" style={{ color: '#2c3e50' }}>
                      {loading ? "..." : card.value}
                    </h2>
                    <p className="mb-0" style={{ color: '#7f8c8d' }}>{card.title}</p>
                  </div>
                  <i className={`bi ${card.icon} fs-1`} style={{ color: card.iconColor }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Second row of statistics cards */}
        <div className="row g-4 mt-2">
          {/* Pending Leaves Card */}
          <div className="col-12 col-md-6 col-lg-4">
            <div
              className="card border-0 shadow-lg"
              style={{ 
                borderRadius: 20, 
                background: "#ffffff",
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
                  <h2 className="fw-bold" style={{ color: '#2c3e50' }}>{loading ? "..." : stats.pendingLeaves}</h2>
                  <p className="mb-0" style={{ color: '#7f8c8d' }}>Pending Leaves</p>
                </div>
                <i className="bi bi-calendar-x fs-1" style={{ color: '#e74c3c' }} />
              </div>
            </div>
          </div>
          {/* Paid Salaries Card */}
          <div className="col-12 col-md-6 col-lg-4">
            <div
              className="card border-0 shadow-lg"
              style={{ 
                borderRadius: 20, 
                background: "#ffffff",
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
                  <h2 className="fw-bold" style={{ color: '#2c3e50' }}>{loading ? "..." : stats.paidSalaries}</h2>
                  <p className="mb-0" style={{ color: '#7f8c8d' }}>Paid Salaries</p>
                </div>
                <i className="bi bi-cash-coin fs-1" style={{ color: '#27ae60' }} />
              </div>
            </div>
          </div>
          {/* Unpaid Salaries Card */}
          <div className="col-12 col-md-6 col-lg-4">
            <div
              className="card border-0 shadow-lg"
              style={{ 
                borderRadius: 20, 
                background: "#ffffff",
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
                  <h2 className="fw-bold" style={{ color: '#2c3e50' }}>{loading ? "..." : stats.unpaidSalaries}</h2>
                  <p className="mb-0" style={{ color: '#7f8c8d' }}>Unpaid Salaries</p>
                </div>
                <i className="bi bi-exclamation-triangle fs-1" style={{ color: '#f39c12' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ================= Attendance Overview ================= */}
        {/* Visual representation of today's attendance with circular progress */}
        <div className="row g-4 mt-2">
          <div className="col-12">
            <div className="card border-0 shadow-lg" style={{ borderRadius: 20 }}>
              <div className="card-body p-4">
                <h5 className="fw-bold mb-4" style={{ color: '#2c3e50' }}>
                  <i className="bi bi-graph-up me-2"></i>Today's Attendance Overview
                </h5>
                <div className="d-flex flex-column flex-md-row align-items-center justify-content-around gap-4">
                  {/* Circular progress chart showing attendance percentage */}
                  <div className="text-center">
                    <div className="position-relative d-inline-block">
                      <svg width="180" height="180">
                        {/* Background circle */}
                        <circle cx="90" cy="90" r="70" fill="none" stroke="#e9ecef" strokeWidth="18"/>
                        {/* Progress circle - length based on attendance percentage */}
                        <circle cx="90" cy="90" r="70" fill="none" stroke="#3498db" strokeWidth="18" 
                          strokeDasharray={`${attendancePercentage * 4.4} 440`}
                          strokeLinecap="round" transform="rotate(-90 90 90)"/>
                      </svg>
                      {/* Percentage text in center of circle */}
                      <div className="position-absolute top-50 start-50 translate-middle">
                        <h1 className="fw-bold mb-0" style={{ color: '#2c3e50', fontSize: '2.5rem' }}>{attendancePercentage}%</h1>
                        <small className="text-muted">Attendance Rate</small>
                      </div>
                    </div>
                  </div>
                  {/* Attendance breakdown: Present, Absent, Total */}
                  <div className="d-flex flex-wrap gap-3 gap-md-5 justify-content-center">
                    {/* Present employees */}
                    <div className="text-center">
                      <div className="mb-2" style={{ width: 80, height: 80, borderRadius: '50%', background: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-person-check fs-1 text-white"></i>
                      </div>
                      <h3 className="fw-bold mb-0" style={{ color: '#2c3e50' }}>{stats.presentToday}</h3>
                      <small className="text-muted">Present</small>
                    </div>
                    {/* Absent employees (calculated) */}
                    <div className="text-center">
                      <div className="mb-2" style={{ width: 80, height: 80, borderRadius: '50%', background: '#9b59b6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-person-x fs-1 text-white"></i>
                      </div>
                      <h3 className="fw-bold mb-0" style={{ color: '#2c3e50' }}>{stats.totalEmployees - stats.presentToday}</h3>
                      <small className="text-muted">Absent</small>
                    </div>
                    {/* Total employees */}
                    <div className="text-center">
                      <div className="mb-2" style={{ width: 80, height: 80, borderRadius: '50%', background: '#3498db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="bi bi-people fs-1 text-white"></i>
                      </div>
                      <h3 className="fw-bold mb-0" style={{ color: '#2c3e50' }}>{stats.totalEmployees}</h3>
                      <small className="text-muted">Total</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= Monthly Summary ================= */}
        {/* Summary card showing current month statistics */}
        <div className="row g-4 mt-2">
          <div className="col-md-12">
            <div className="card border-0 shadow-lg" style={{ borderRadius: 20 }}>
              <div className="card-body p-4">
                <h5 className="fw-bold mb-4" style={{ color: '#2c3e50' }}>
                  <i className="bi bi-calendar-month me-2"></i>This Month Summary - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h5>
                <div className="row g-3">
                  {/* Total working days in current month */}
                  <div className="col-12 col-md-6">
                    <div className="p-3 rounded" style={{ background: '#f8f9fa' }}>
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <small className="text-muted d-block">Total Working Days</small>
                          {/* Calculate last day of current month */}
                          <h4 className="fw-bold mb-0" style={{ color: '#2c3e50' }}>{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}</h4>
                        </div>
                        <i className="bi bi-calendar3 fs-2" style={{ color: '#e67e22' }}></i>
                      </div>
                    </div>
                  </div>
                  {/* Average attendance percentage */}
                  <div className="col-12 col-md-6">
                    <div className="p-3 rounded" style={{ background: '#f8f9fa' }}>
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <small className="text-muted d-block">Avg Attendance</small>
                          <h4 className="fw-bold mb-0" style={{ color: '#2c3e50' }}>{attendancePercentage}%</h4>
                        </div>
                        <i className="bi bi-graph-up-arrow fs-2" style={{ color: '#16a085' }}></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
