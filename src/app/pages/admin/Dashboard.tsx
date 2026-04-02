import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from "../../../utils/apiUtils";
import { AdminLayout } from "../../components/AdminLayout";
import { LoadingAnimation } from "../../components/LoadingAnimation";

const STAT_CARDS = (stats: ReturnType<typeof defaultStats>, presentToday: number, absentToday: number) => [
  { title: "Total Departments", value: stats.totalDepartments, icon: "bi-building",            color: "#3498db", link: "/departments" },
  { title: "Total Employees",   value: stats.totalEmployees,   icon: "bi-people",               color: "#9b59b6", link: "/employees" },
  { title: "Present Today",     value: presentToday,           icon: "bi-person-check",         color: "#2ecc71", link: "/mark-attendance" },
  { title: "Absent Today",      value: absentToday,            icon: "bi-person-x",             color: "#e74c3c", link: "/mark-attendance" },
  { title: "Paid Salaries",     value: stats.paidSalaries,     icon: "bi-cash-coin",            color: "#27ae60", link: "/salary-management" },
  { title: "Unpaid Salaries",   value: stats.unpaidSalaries,   icon: "bi-exclamation-triangle", color: "#f39c12", link: "/salary-management" },
];

const QUICK_ACTIONS = [
  { label: "Add Employee",     icon: "bi-person-plus",      link: "/employees/add",     color: "#9b59b6" },
  { label: "Mark Attendance",  icon: "bi-calendar-check",   link: "/mark-attendance",   color: "#2ecc71" },
  { label: "Manage Leaves",    icon: "bi-calendar-x",       link: "/leave-management",  color: "#e74c3c" },
  { label: "Run Payroll",      icon: "bi-cash-stack",       link: "/salary-management", color: "#27ae60" },
];

function defaultStats() {
  return { totalEmployees: 0, totalDepartments: 0, pendingLeaves: 0, paidSalaries: 0, unpaidSalaries: 0 };
}

function calcHours(total_hours?: string, check_in?: string, check_out?: string): number {
  if (total_hours) {
    const [h, m, s] = total_hours.split(":").map(Number);
    return h + m / 60 + s / 3600;
  }
  if (check_in && check_out) {
    const diff = new Date(`1970-01-01T${check_out}`).getTime() - new Date(`1970-01-01T${check_in}`).getTime();
    return diff / 3600000;
  }
  return 0;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(defaultStats());
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) { navigate("/login"); return; }
    try {
      const userData = JSON.parse(user);
      const isAdmin = userData.is_superuser === true || (userData.is_staff === true && userData.username === "admin");
      if (!isAdmin) { toast.error("Access denied."); navigate("/employee-dashboard"); return; }
      fetchDashboardStats();
    } catch { navigate("/login"); }
  }, [navigate]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const [dashRes, attRes] = await Promise.all([
        makeAuthenticatedRequest(`${config.api.host}${config.api.adminDashboard}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}?date=${today}&page_size=500`),
      ]);

      if (!dashRes.ok) { toast.error("Failed to load dashboard data"); return; }
      const data = await dashRes.json();
      const totalEmployees = data.total_employees || 0;
      setStats({
        totalEmployees,
        totalDepartments: data.total_departments     || 0,
        pendingLeaves:    data.pending_leaves        || 0,
        paidSalaries:     data.total_paid_salaries   || 0,
        unpaidSalaries:   data.total_unpaid_salaries || 0,
      });

      if (attRes.ok) {
        const attData = await attRes.json();
        const records: any[] = attData.results || [];
        const present = records.filter(r => calcHours(r.total_hours, r.check_in, r.check_out) >= 7).length;
        setPresentToday(present);
        setAbsentToday(Math.max(0, totalEmployees - present));
      } else {
        setAbsentToday(totalEmployees);
      }
    } catch { toast.error("Failed to load dashboard data"); }
    finally { setLoading(false); }
  };

  const attendancePct = stats.totalEmployees > 0
    ? Math.min(100, Math.round((presentToday / stats.totalEmployees) * 100)) : 0;

  const totalSalaries = stats.paidSalaries + stats.unpaidSalaries;
  const paidPct = totalSalaries > 0 ? Math.round((stats.paidSalaries / totalSalaries) * 100) : 0;

  const circumference = 2 * Math.PI * 70; // ≈ 439.8

  return (
    <AdminLayout title="Admin Dashboard">
      {loading && <LoadingAnimation />}
      <Toaster position="bottom-center" />

      <div className="container-fluid p-4" style={{ background: "#f8f9fa", minHeight: "calc(100vh - 56px)" }}>

        {/* ── Stat Cards ── */}
        <div className="row g-4">
          {STAT_CARDS(stats, presentToday, absentToday).map((card, i) => (
            <div key={i} className="col-12 col-sm-6 col-lg-4">
              <div
                className="card border-0 shadow-sm h-100"
                style={{ borderRadius: 16, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", borderLeft: `5px solid ${card.color}` }}
                onClick={() => navigate(card.link)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
              >
                <div className="card-body p-4 d-flex justify-content-between align-items-center">
                  <div>
                    <p className="mb-1 text-muted small fw-semibold text-uppercase" style={{ letterSpacing: "0.05em" }}>{card.title}</p>
                    <h2 className="fw-bold mb-0" style={{ color: "#2c3e50" }}>{loading ? "—" : card.value}</h2>
                  </div>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${card.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={`bi ${card.icon} fs-3`} style={{ color: card.color }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Attendance Overview + Salary Summary ── */}
        <div className="row g-4 mt-1">

          {/* Attendance donut */}
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 16 }}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>
                  <i className="bi bi-graph-up me-2" style={{ color: "#3498db" }} />Today's Attendance
                </h6>
                <div className="d-flex flex-column flex-sm-row align-items-center justify-content-around gap-4">
                  <div className="text-center position-relative">
                    <svg width="160" height="160">
                      <circle cx="80" cy="80" r="70" fill="none" stroke="#e9ecef" strokeWidth="16" />
                      <circle cx="80" cy="80" r="70" fill="none" stroke="#3498db" strokeWidth="16"
                        strokeDasharray={`${(attendancePct / 100) * circumference} ${circumference}`}
                        strokeLinecap="round" transform="rotate(-90 80 80)" />
                    </svg>
                    <div className="position-absolute top-50 start-50 translate-middle text-center">
                      <h2 className="fw-bold mb-0" style={{ color: "#2c3e50" }}>{attendancePct}%</h2>
                      <small className="text-muted">Rate</small>
                    </div>
                  </div>
                  <div className="d-flex flex-row flex-sm-column gap-4">
                    {[
                      { label: "Present", value: presentToday,         color: "#2ecc71", icon: "bi-person-check" },
                      { label: "Absent",  value: absentToday,          color: "#e74c3c", icon: "bi-person-x" },
                      { label: "Total",   value: stats.totalEmployees, color: "#3498db", icon: "bi-people" },
                    ].map(item => (
                      <div key={item.label} className="d-flex align-items-center gap-3">
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: item.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <i className={`bi ${item.icon} text-white`} />
                        </div>
                        <div>
                          <div className="fw-bold" style={{ color: "#2c3e50" }}>{item.value}</div>
                          <small className="text-muted">{item.label}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Salary summary */}
          <div className="col-12 col-lg-6">
            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 16 }}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>
                  <i className="bi bi-cash-stack me-2" style={{ color: "#27ae60" }} />Salary Overview
                </h6>
                <div className="d-flex justify-content-between mb-1">
                  <small className="text-muted">Paid</small>
                  <small className="fw-semibold" style={{ color: "#27ae60" }}>{paidPct}%</small>
                </div>
                <div className="progress mb-4" style={{ height: 10, borderRadius: 8 }}>
                  <div className="progress-bar" role="progressbar" style={{ width: `${paidPct}%`, background: "#27ae60", borderRadius: 8 }} />
                </div>
                <div className="row g-3">
                  {[
                    { label: "Paid",    value: stats.paidSalaries,   color: "#27ae60", icon: "bi-check-circle" },
                    { label: "Unpaid",  value: stats.unpaidSalaries, color: "#f39c12", icon: "bi-exclamation-circle" },
                    { label: "Total",   value: totalSalaries,        color: "#3498db", icon: "bi-people" },
                  ].map(item => (
                    <div key={item.label} className="col-4">
                      <div className="p-3 rounded text-center" style={{ background: `${item.color}12` }}>
                        <i className={`bi ${item.icon} fs-4 mb-1 d-block`} style={{ color: item.color }} />
                        <div className="fw-bold" style={{ color: "#2c3e50" }}>{item.value}</div>
                        <small className="text-muted">{item.label}</small>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Month info */}
                <div className="mt-4 p-3 rounded d-flex justify-content-between align-items-center" style={{ background: "#f8f9fa" }}>
                  <div>
                    <small className="text-muted d-block">Current Month</small>
                    <span className="fw-semibold" style={{ color: "#2c3e50" }}>
                      {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                  </div>
                  <i className="bi bi-calendar3 fs-3" style={{ color: "#e67e22" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="row g-4 mt-1">
          <div className="col-12">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-4" style={{ color: "#2c3e50" }}>
                  <i className="bi bi-lightning-charge me-2" style={{ color: "#f39c12" }} />Quick Actions
                </h6>
                <div className="row g-3">
                  {QUICK_ACTIONS.map((action, i) => (
                    <div key={i} className="col-6 col-md-3">
                      <button
                        className="btn w-100 d-flex flex-column align-items-center gap-2 py-3"
                        style={{ borderRadius: 12, border: `1.5px solid ${action.color}20`, background: `${action.color}0d`, transition: "all 0.2s" }}
                        onClick={() => navigate(action.link)}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${action.color}22`; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${action.color}0d`; }}
                      >
                        <i className={`bi ${action.icon} fs-3`} style={{ color: action.color }} />
                        <span className="fw-semibold small" style={{ color: "#2c3e50" }}>{action.label}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
