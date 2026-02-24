import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { Employee, Attendance, Leave } from './types';
import { ProfileTab } from './ProfileTab';
import { AttendanceTab } from './AttendanceTab';
import { LeavesTab } from './LeavesTab';
import { SalaryTab } from './SalaryTab';
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
import { LoadingAnimation } from '../../components/LoadingAnimation';

export function EmployeeDashboard() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [attendanceStatusId, setAttendanceStatusId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      navigate('/login');
      return;
    }
    
    try {
      const userData = JSON.parse(user);
      
      if (userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin')) {
        toast.error('Admin users cannot access employee portal.');
        navigate('/admin-dashboard');
        return;
      }
      
      fetchAllData();
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    }
  }, [navigate]);

  const fetchAllData = async () => {
    setLoading(true);
    
    try {
      const user = localStorage.getItem('user');
      if (!user) return;
      
      const userData = JSON.parse(user);
      const currentUserId = userData.id;
      
      // Single API call to get all data
      const [userRes, attRes, attStatusRes, leaveRes] = await Promise.all([
        makeAuthenticatedRequest(`${config.api.host}${config.api.user}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.attendanceStatus}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.leave}`)
      ]);
      
      // Process user data
      if (userRes.ok) {
        const usersData = await userRes.json();
        const apiUserData = (usersData.results || []).find((u: any) => u.id === currentUserId);
        
        setEmployee({
          id: (apiUserData?.id || currentUserId).toString(),
          emp_code: apiUserData?.emp_code || 'N/A',
          first_name: apiUserData?.first_name || userData.username?.charAt(0).toUpperCase() + userData.username?.slice(1) || 'N/A',
          last_name: apiUserData?.last_name || '',
          email: apiUserData?.email || userData.email || 'N/A',
          username: apiUserData?.username || userData.username || 'N/A',
          department_name: apiUserData?.department_name || 'N/A',
          designation: apiUserData?.designation || 'N/A',
          contact_no: apiUserData?.contact_no || 'N/A',
          date_of_joining: apiUserData?.date_of_joining || 'N/A'
        });
      }
      
      // Process attendance status
      if (attStatusRes.ok) {
        const statusData = await attStatusRes.json();
        const presentStatus = (statusData.results || []).find((s: any) => 
          s.status?.toLowerCase() === 'present'
        );
        if (presentStatus) {
          setAttendanceStatusId(presentStatus.id);
        } else {
          console.warn('Present status not found, using first status');
          if (statusData.results?.length > 0) {
            setAttendanceStatusId(statusData.results[0].id);
          }
        }
      }
      
      // Process attendance data
      if (attRes.ok) {
        const attData = await attRes.json();
        const userAttendances = (attData.results || []).filter((att: Attendance) => att.user === currentUserId);
        setAttendances(userAttendances);
        
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = userAttendances.find((att: Attendance) => att.date === today);
        
        if (todayRecord) {
          setTodayAttendance(todayRecord);
          setHasCheckedOut(!!todayRecord.check_out);
        }
      }
      
      // Process leave data
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        const userLeaves = (leaveData.results || []).filter((leave: Leave) => leave.user === currentUserId);
        setLeaves(userLeaves);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    // Check if already checked in today
    if (todayAttendance) {
      toast.error('You have already checked in today!');
      return;
    }

    if (!attendanceStatusId) {
      toast.error('Attendance status not loaded. Please try again.');
      return;
    }

    try {
      const now = new Date();
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}`, {
        method: 'POST',
        body: JSON.stringify({
          user: parseInt(employee?.id || '0'),
          date: now.toISOString().split('T')[0],
          attendance_status: attendanceStatusId,
          check_in: now.toTimeString().split(' ')[0]
        })
      });
      
      if (response.ok) {
        toast.success('Checked in successfully!');
        fetchAllData();
      } else {
        const errorData = await response.text();
        console.error('Check-in failed:', errorData);
        toast.error('Failed to check in');
      }
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Error checking in');
    }
  };

  const handleCheckOut = async () => {
    if (!todayAttendance) {
      toast.error('Please check in first');
      return;
    }

    if (hasCheckedOut) {
      toast.error('You have already checked out today!');
      return;
    }

    try {
      const now = new Date();
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}${todayAttendance.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          check_out: now.toTimeString().split(' ')[0]
        })
      });
      
      if (response.ok) {
        setHasCheckedOut(true);
        toast.success('Checked out successfully!');
        fetchAllData();
      } else {
        toast.error('Failed to check out');
      }
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Error checking out');
    }
  };

  const fetchLeaveData = async () => {
    try {
      const user = localStorage.getItem('user');
      if (!user) return;
      
      const userData = JSON.parse(user);
      const currentUserId = userData.id;
      
      const leaveRes = await makeAuthenticatedRequest(`${config.api.host}${config.api.leave}`);
      
      if (leaveRes.ok) {
        const leaveData = await leaveRes.json();
        const userLeaves = (leaveData.results || []).filter((leave: Leave) => leave.user === currentUserId);
        setLeaves(userLeaves);
      }
    } catch (error) {
      console.error('Error fetching leave data:', error);
    }
  };
  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return <LoadingAnimation />;
  }

  const menuItems = [
    { id: 'profile', icon: 'bi-person', label: 'Profile' },
    { id: 'attendance', icon: 'bi-calendar-check', label: 'Attendance' },
    { id: 'leaves', icon: 'bi-calendar-x', label: 'Leaves' },
    { id: 'salary', icon: 'bi-cash-stack', label: 'Salary' },
  ];

  return (
    <div className="min-vh-100 d-flex" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      <Toaster position="bottom-center" />
      
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="d-md-none position-fixed w-100 h-100" 
          style={{ background: 'rgba(0,0,0,0.5)', zIndex: 999, top: 0, left: 0 }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`${mobileMenuOpen ? 'd-block' : 'd-none'} d-md-block`} 
        style={{
          width: '260px',
          position: 'fixed',
          height: '100vh',
          overflowY: 'auto',
          zIndex: 1000,
          background: '#ffffff',
          borderRight: '1px solid #e9ecef',
          left: 0,
          top: 0
        }}
      >
        <div className="p-3 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid #e9ecef' }}>
          <div className="d-flex align-items-center gap-2">
            <img src="/Logo.png" alt="HR System" style={{ height: '40px', objectFit: 'contain' }} />
            <h5 className="mb-0 d-none d-md-block" style={{ color: '#2c3e50', textTransform: 'uppercase' }}>{employee?.first_name}</h5>
          </div>
          <button 
            className="btn btn-sm btn-outline-dark d-md-none ms-auto" 
            onClick={() => setMobileMenuOpen(false)}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        
        <nav className="nav flex-column p-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className="nav-link text-dark rounded mb-2 d-flex align-items-center"
              style={{
                padding: '12px 16px',
                transition: 'all 0.2s',
                textDecoration: 'none',
                background: activeTab === item.id ? '#f8f9fa' : 'transparent',
                border: 'none',
                textAlign: 'left'
              }}
            >
              <i className={`bi ${item.icon} fs-5`} style={{ minWidth: '24px' }}></i>
              <span className="ms-3">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="position-absolute bottom-0 w-100 p-3" style={{ borderTop: '1px solid #e9ecef' }}>
          <button 
            className="btn w-100 d-flex align-items-center justify-content-center btn-outline-dark" 
            onClick={handleLogout}
            style={{ border: '1px solid #dee2e6' }}
          >
            <i className="bi bi-box-arrow-right"></i>
            <span className="ms-2">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-grow-1" 
        style={{ 
          marginLeft: window.innerWidth >= 768 ? '260px' : '0',
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <nav className="navbar navbar-expand-lg shadow-sm" style={{ background: '#ffffff', borderBottom: '1px solid #e9ecef' }}>
          <div className="container-fluid">
            <button 
              className="btn btn-link d-md-none me-2" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ color: '#2c3e50', textDecoration: 'none' }}
            >
              <i className="bi bi-list fs-4"></i>
            </button>
            <span className="navbar-brand fw-bold" style={{ color: '#2c3e50' }}>Employee Portal - {employee?.first_name?.toUpperCase()}</span>
            <div className="navbar-nav ms-auto">
              <button className="nav-link btn btn-link" onClick={handleLogout} style={{ color: '#2c3e50', textDecoration: 'none', cursor: 'pointer' }}>
                <i className="bi bi-person-circle me-2"></i>{employee?.username?.toUpperCase()}
              </button>
            </div>
          </div>
        </nav>
        
        <div className="container-fluid p-4" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
          <div className="row mb-4 g-3">
            <div className="col-12 col-md-6">
              <div className="card shadow-sm border-0" style={{ background: '#ffffff' }}>
                <div className="card-body text-center">
                  <i className="bi bi-box-arrow-in-right fs-1 mb-2" style={{ color: '#2c3e50' }}></i>
                  <h5 style={{ color: '#2c3e50' }}>Check In</h5>
                  <button 
                    className="btn text-white" 
                    onClick={handleCheckIn}
                    disabled={!!todayAttendance}
                    style={{ background: '#2b3d4f', border: 'none' }}
                  >
                    {todayAttendance ? 'Already Checked In Today' : 'Check In'}
                  </button>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="card shadow-sm border-0" style={{ background: '#ffffff' }}>
                <div className="card-body text-center">
                  <i className="bi bi-box-arrow-right fs-1 mb-2" style={{ color: '#2c3e50' }}></i>
                  <h5 style={{ color: '#2c3e50' }}>Check Out</h5>
                  <button 
                    className="btn text-white" 
                    onClick={handleCheckOut}
                    disabled={!todayAttendance || hasCheckedOut}
                    style={{ background: '#2b3d4f', border: 'none' }}
                  >
                    {hasCheckedOut ? 'Already Checked Out' : !todayAttendance ? 'Check In First' : 'Check Out'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {activeTab === 'profile' && <ProfileTab employee={employee} />}
          {activeTab === 'attendance' && <AttendanceTab attendances={attendances} />}
          {activeTab === 'leaves' && <LeavesTab leaves={leaves} onLeaveApplied={fetchLeaveData} />}
          {activeTab === 'salary' && <SalaryTab />}
        </div>
      </div>
    </div>
  );
}