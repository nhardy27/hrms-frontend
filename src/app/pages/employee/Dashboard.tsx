import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { Employee, Attendance, Leave } from './types';
import { ProfileTab } from './ProfileTab';
import { AttendanceTab } from './AttendanceTab';
import { LeavesTab } from './LeavesTab';
import { SalaryTab } from './SalaryTab';
import { ChatTab } from './ChatTab';
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
  const [pendingChatUserId, setPendingChatUserId] = useState<number | null>(null);
  const [attendanceStatusId, setAttendanceStatusId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  interface Notification { id: number; title: string; message: string; data: any; read: boolean; ts: string; }
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const notifWsRef = useRef<WebSocket | null>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

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
      const [userRes, attRes, attStatusRes, leaveRes, designationRes] = await Promise.all([
        makeAuthenticatedRequest(`${config.api.host}${config.api.user}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.attendanceStatus}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.leave}`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.designation}`)
      ]);

      // Build designation id -> name map
      let designationMap: Record<string, string> = {};
      if (designationRes.ok) {
        const desigData = await designationRes.json();
        (desigData.results || []).forEach((d: any) => {
          designationMap[String(d.id)] = d.name || d.designation_name || d.title || String(d.id);
        });
      }
      
      // Process user data
      if (userRes.ok) {
        const usersData = await userRes.json();
        const apiUserData = (usersData.results || []).find((u: any) => u.id === currentUserId);
        const designationId = apiUserData?.designation;
        const designationName = designationId
          ? (designationMap[String(designationId)] || String(designationId))
          : 'N/A';
        
        setEmployee({
          id: (apiUserData?.id || currentUserId).toString(),
          emp_code: apiUserData?.emp_code || 'N/A',
          first_name: apiUserData?.first_name || userData.username?.charAt(0).toUpperCase() + userData.username?.slice(1) || 'N/A',
          last_name: apiUserData?.last_name || '',
          email: apiUserData?.email || userData.email || 'N/A',
          username: apiUserData?.username || userData.username || 'N/A',
          department_name: apiUserData?.department_name || 'N/A',
          department_id: apiUserData?.department ? String(apiUserData.department) : undefined,
          designation: designationName,
          designation_id: designationId ? String(designationId) : undefined,
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
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    const wsHost = (config as any).ws?.host ||
      config.api.host.replace('https://', 'wss://').replace('http://', 'ws://');

    const connectNotifWs = async () => {
      if (destroyed) return;
      // Always get a fresh/valid token before connecting
      const { refreshToken: doRefresh } = await import('../../../utils/apiUtils');
      let token = localStorage.getItem('token');
      if (!token) return;
      // Check expiry and refresh if needed
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now() + 5000) {
          token = await doRefresh();
        }
      } catch { token = await doRefresh(); }
      if (!token || destroyed) return;

      ws = new WebSocket(`${wsHost}/ws/notifications/?token=${token}`);
      notifWsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'notification') {
            const notif: Notification = { id: Date.now(), title: data.title, message: data.message, data: data.data, read: false, ts: new Date().toISOString() };
            setNotifications(prev => [notif, ...prev]);
            const senderId: number | null = data.data?.sender_id ?? null;
            toast.custom((t) => (
              <div
                onClick={() => {
                  toast.dismiss(t.id);
                  if (senderId) { setPendingChatUserId(senderId); setActiveTab('chat'); }
                }}
                style={{ background: '#2b3d4f', color: '#fff', borderRadius: 10, padding: '12px 16px', minWidth: 260, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', opacity: t.visible ? 1 : 0, transition: 'opacity 0.3s', cursor: senderId ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="bi bi-chat-dots" style={{ fontSize: 16 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{data.title}</div>
                  <div style={{ fontSize: 13, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.message}</div>
                  {senderId && <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>Tap to open chat</div>}
                </div>
              </div>
            ), { duration: 5000, position: 'top-right' });
          }
          // type === 'error' means token was rejected — reconnect with fresh token
          if (data.type === 'error') {
            ws?.close();
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (!destroyed) {
          // Reconnect after 3s
          reconnectTimer = setTimeout(connectNotifWs, 3000);
        }
      };

      ws.onerror = () => { ws?.close(); };
    };

    connectNotifWs();
    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      notifWsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifPanel(false);
      }
    };
    if (showNotifPanel) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifPanel]);

  const handleLogout = () => {
    notifWsRef.current?.close();
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
    { id: 'chat', icon: 'bi-chat-dots', label: 'Chat' },
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
        className="flex-grow-1 main-content" 
        style={{ 
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'hidden'
        }}
      >
        <style>{`.main-content { margin-left: 0; } @media (min-width: 768px) { .main-content { margin-left: 260px; } }`}</style>
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e9ecef', height: 56, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, position: 'relative', zIndex: 100 }}>
          <button
            className="d-md-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ background: 'none', border: 'none', color: '#2c3e50', padding: 4, flexShrink: 0, cursor: 'pointer' }}
          >
            <i className="bi bi-list" style={{ fontSize: 24 }}></i>
          </button>
          <span style={{ color: '#2c3e50', fontWeight: 700, flexGrow: 1, fontSize: 'clamp(12px, 3.2vw, 17px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Employee Portal - {employee?.first_name?.toUpperCase()}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div ref={notifPanelRef} style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowNotifPanel(p => !p); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); }}
                style={{ background: 'none', border: 'none', color: '#2c3e50', padding: 6, position: 'relative', cursor: 'pointer' }}
              >
                <i className="bi bi-bell" style={{ fontSize: 20 }}></i>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, background: '#e74c3c', color: '#fff', borderRadius: '50%', fontSize: 9, width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifPanel && (
                <div style={{ position: 'absolute', right: 0, top: '110%', width: 'min(320px, 90vw)', background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 2000, overflow: 'hidden' }}>
                  <div style={{ background: '#2b3d4f', color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
                    {notifications.length > 0 && (
                      <button onClick={() => setNotifications([])} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, cursor: 'pointer' }}>Clear all</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8696a0', fontSize: 13 }}>
                        <i className="bi bi-bell-slash" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                        No notifications yet
                      </div>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => { if (n.data?.sender_id) { setPendingChatUserId(n.data.sender_id); setActiveTab('chat'); setShowNotifPanel(false); } }}
                        style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f5', background: n.read ? '#fff' : '#f0f4ff', cursor: n.data?.sender_id ? 'pointer' : 'default', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#2b3d4f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                          <i className="bi bi-chat-dots" style={{ fontSize: 14, color: '#fff' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#2c3e50', marginBottom: 2 }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                          <div style={{ fontSize: 11, color: '#adb5bd', marginTop: 3 }}>{new Date(n.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2b3d4f', flexShrink: 0, marginTop: 6 }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: '#2c3e50', padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <i className="bi bi-person-circle" style={{ fontSize: 20 }}></i>
              <span className="d-none d-sm-inline" style={{ fontSize: 13, fontWeight: 600 }}>{employee?.username?.toUpperCase()}</span>
            </button>
          </div>
        </div>
        
        <div className="container-fluid" style={{ maxWidth: '100%', overflowX: 'hidden', padding: activeTab === 'chat' ? '0' : '1.5rem' }}>
          {activeTab !== 'chat' && (
            <div className="row mb-4 g-3">
              <div className="col-6 col-md-6">
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
              <div className="col-6 col-md-6">
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
          )}

          {activeTab === 'profile' && <ProfileTab employee={employee} />}
          {activeTab === 'attendance' && <AttendanceTab attendances={attendances} />}
          {activeTab === 'leaves' && <LeavesTab leaves={leaves} onLeaveApplied={fetchLeaveData} />}
          {activeTab === 'salary' && <SalaryTab />}
          {activeTab === 'chat' && <ChatTab employee={employee} pendingChatUserId={pendingChatUserId} onPendingChatHandled={() => setPendingChatUserId(null)} />}
        </div>
      </div>
    </div>
  );
}