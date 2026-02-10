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

  const fetchAttendanceStatus = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendanceStatus}`);
      if (response.ok) {
        const data = await response.json();
        const presentStatus = (data.results || data || []).find((status: any) => status.present === true);
        if (presentStatus) {
          setAttendanceStatusId(presentStatus.id);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance status:', error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      navigate('/login');
      return;
    }
    
    const userData = JSON.parse(user);
    
    // Prevent admin users from accessing employee dashboard
    if (userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin')) {
      toast.error('Admin users cannot access employee portal.');
      navigate('/admin-dashboard');
      return;
    }
    
    const initializeData = async () => {
      await fetchEmployeeData();
      await fetchAttendanceStatus();
      await fetchAttendanceData();
      await fetchLeaveData();
    };
    
    initializeData();
  }, []);



  const fetchEmployeeData = async () => {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!user || !token) {
      navigate('/login');
      return;
    }

    try {
      const userData = JSON.parse(user);
      const currentUserId = userData.id;
      
      // Fetch user data from API
      const userResponse = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.user}`
      );
      
      if (userResponse.ok) {
        const usersData = await userResponse.json();
        const apiUserData = (usersData.results || []).find((u: any) => u.id === currentUserId);
        
        if (apiUserData) {
        
        // Fetch department name
        let departmentName = 'N/A';
        if (apiUserData.department) {
          try {
            const deptResponse = await makeAuthenticatedRequest(
              `${config.api.host}${config.api.department}`
            );
            if (deptResponse.ok) {
              const deptData = await deptResponse.json();
              const departments = deptData.results || [];
              const dept = departments.find((d: any) => d.id === apiUserData.department);
              departmentName = dept ? dept.name : 'N/A';
            }
          } catch (deptError) {
            console.log('Department fetch failed:', deptError);
          }
        }
        
        setEmployee({
          id: apiUserData.id.toString(),
          emp_code: apiUserData.emp_code || 'N/A',
          first_name: apiUserData.first_name || apiUserData.username?.charAt(0).toUpperCase() + apiUserData.username?.slice(1) || 'N/A',
          last_name: apiUserData.last_name || '',
          email: apiUserData.email || 'N/A',
          username: apiUserData.username || 'N/A',
          department_name: departmentName,
          designation: apiUserData.designation || 'N/A'
        });
        } else {
          console.error('User not found in API response');
          // Fallback to localStorage data
          const fallbackData = {
            id: userData.id.toString(),
            emp_code: userData.emp_code || 'N/A',
            first_name: userData.first_name || userData.username?.charAt(0).toUpperCase() + userData.username?.slice(1) || 'N/A',
            last_name: userData.last_name || '',
            email: userData.email || 'N/A',
            username: userData.username || 'N/A',
            department_name: 'N/A',
            designation: userData.designation || 'N/A'
          };
          setEmployee(fallbackData);
        }
      } else {
        console.error('Failed to fetch user data from API');
        // Fallback to localStorage data if API fails
        const fallbackData = {
          id: userData.id.toString(),
          emp_code: userData.emp_code || 'N/A',
          first_name: userData.first_name || userData.username?.charAt(0).toUpperCase() + userData.username?.slice(1) || 'N/A',
          last_name: userData.last_name || '',
          email: userData.email || 'N/A',
          username: userData.username || 'N/A',
          department_name: 'N/A',
          designation: userData.designation || 'N/A'
        };
        setEmployee(fallbackData);
      }
      
    } catch (error) {
      console.error('Error fetching employee data:', error);
      navigate('/login');
    }
  };

  const fetchAttendanceData = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched attendance data:', data);
        
        // Filter attendance for current user only
        const currentUserId = parseInt(employee?.id || localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : '0');
        const userAttendances = (data.results || []).filter((att: Attendance) => att.user === currentUserId);
        
        setAttendances(userAttendances.slice(0, 5));
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = userAttendances.find((att: Attendance) => att.date === today);
        
        if (todayRecord) {
          setTodayAttendance(todayRecord);
          setHasCheckedOut(!!todayRecord.check_out);
        } else {
          setTodayAttendance(null);
          setHasCheckedOut(false);
        }
      } else {
        console.error('Failed to fetch attendance:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchLeaveData = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.leave}`);
      if (response.ok) {
        const data = await response.json();
        const currentUserId = parseInt(employee?.id || localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : '0');
        const userLeaves = (data.results || []).filter((leave: Leave) => leave.user === currentUserId);
        setLeaves(userLeaves);
      }
    } catch (error) {
      console.error('Error fetching leaves:', error);
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
        fetchAttendanceData();
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
        fetchAttendanceData();
      } else {
        toast.error('Failed to check out');
      }
    } catch (error) {
      console.error('Error checking out:', error);
      toast.error('Error checking out');
    }
  };



  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <Toaster position="bottom-center" />
      <nav className="navbar navbar-dark bg-success">
        <div className="container-fluid">
          <span className="navbar-brand">Employee Portal - {employee?.first_name}</span>
          <button className="btn btn-outline-light" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right me-2"></i>Logout
          </button>
        </div>
      </nav>

      <div className="container mt-4">
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card bg-success text-white">
              <div className="card-body text-center">
                <i className="bi bi-box-arrow-in-right fs-1 mb-2"></i>
                <h5>Check In</h5>
                <button 
                  className="btn btn-light" 
                  onClick={handleCheckIn}
                  disabled={!!todayAttendance}
                >
                  {todayAttendance ? 'Already Checked In Today' : 'Check In'}
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="card bg-danger text-white">
              <div className="card-body text-center">
                <i className="bi bi-box-arrow-right fs-1 mb-2"></i>
                <h5>Check Out</h5>
                <button 
                  className="btn btn-light" 
                  onClick={handleCheckOut}
                  disabled={!todayAttendance || hasCheckedOut}
                >
                  {hasCheckedOut ? 'Already Checked Out' : !todayAttendance ? 'Check In First' : 'Check Out'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <i className="bi bi-person me-2"></i>Profile
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <i className="bi bi-clock me-2"></i>Attendance
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'leaves' ? 'active' : ''}`}
              onClick={() => setActiveTab('leaves')}
            >
              <i className="bi bi-calendar-x me-2"></i>Leaves
            </button>
          </li>
          <li className="nav-item">
            <button 
              className={`nav-link ${activeTab === 'salary' ? 'active' : ''}`}
              onClick={() => setActiveTab('salary')}
            >
              <i className="bi bi-cash-stack me-2"></i>Salary
            </button>
          </li>
        </ul>

        {activeTab === 'profile' && <ProfileTab employee={employee} />}
        {activeTab === 'attendance' && <AttendanceTab attendances={attendances} />}
        {activeTab === 'leaves' && <LeavesTab leaves={leaves} onLeaveApplied={fetchLeaveData} />}
        {activeTab === 'salary' && <SalaryTab />}
      </div>
    </div>
  );
}