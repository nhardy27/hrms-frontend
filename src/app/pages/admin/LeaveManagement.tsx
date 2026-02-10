import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../../config/global.json";
import { makeAuthenticatedRequest, fetchAllPages } from '../../../utils/apiUtils';
import toast, { Toaster } from 'react-hot-toast';
import { AdminLayout } from '../../components/AdminLayout';

interface LeaveRequest {
  id: string;
  user: number;
  user_name?: string;
  department_name?: string;
  from_date: string;
  to_date: string;
  reason: string;
  status?: string;
}

export function LeaveManagement() {
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [leaves, allUsers, departments] = await Promise.all([
        fetchAllPages(`${config.api.host}${config.api.leave}`),
        fetchAllPages(`${config.api.host}${config.api.user}`),
        fetchAllPages(`${config.api.host}${config.api.department}`)
      ]);
      
      // Map user names and department names to leaves and filter out admin users
      const leavesWithNames = leaves
        .map((leave: LeaveRequest) => {
          const user = allUsers.find((u: any) => u.id === leave.user);
          const department = departments.find((d: any) => d.id === user?.department);
          return {
            ...leave,
            user_name: user ? `${user.first_name || user.username} ${user.last_name || ''}`.trim() : `User ${leave.user}`,
            department_name: department?.name || 'N/A',
            username: user?.username
          };
        })
        .filter((leave: any) => leave.username !== 'admin');
      
      setLeaveRequests(leavesWithNames);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  const updateLeaveStatus = async (leaveId: string, status: string) => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.leave}${leaveId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: status.toUpperCase() })
      });
      
      if (response.ok) {
        toast.success(`Leave ${status} successfully!`);
        loadData();
      } else {
        toast.error('Failed to update leave status');
      }
    } catch (error) {
      console.error('Error updating leave:', error);
      toast.error('Error updating leave status');
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const getStatusBadge = (status?: string) => {
    const upperStatus = status?.toUpperCase();
    const colors = {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'danger'
    };
    return `badge bg-${colors[upperStatus as keyof typeof colors] || 'warning'}`;
  };

  return (
    <AdminLayout title="Leave Management">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '15px 15px 0 0', border: 'none' }}>
            <h5 className="mb-0 text-white"><i className="bi bi-calendar-x-fill me-2"></i>Employee Leave Requests</h5>
          </div>
          <div className="card-body">
            {loading ? (
              <p className="text-center">Loading...</p>
            ) : leaveRequests.length === 0 ? (
              <p className="text-center">No leave requests found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Employee ID</th>
                      <th>Department</th>
                      <th>From Date</th>
                      <th>To Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map(leave => (
                      <tr key={leave.id}>
                        <td><strong>{leave.user_name}</strong></td>
                        <td>{leave.user}</td>
                        <td><span className="badge bg-secondary">{leave.department_name}</span></td>
                        <td>{formatDate(leave.from_date)}</td>
                        <td>{formatDate(leave.to_date)}</td>
                        <td>{leave.reason}</td>
                        <td>
                          <span className={getStatusBadge(leave.status)}>
                            {leave.status || 'Pending'}
                          </span>
                        </td>
                        <td>
                          {(!leave.status || leave.status === 'PENDING') ? (
                            <div className="btn-group">
                              <button 
                                className="btn btn-sm shadow-sm"
                                onClick={() => updateLeaveStatus(leave.id, 'APPROVED')}
                                style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white', border: 'none', borderRadius: '6px' }}
                              >
                                <i className="bi bi-check-circle me-1"></i>Approve
                              </button>
                              <button 
                                className="btn btn-sm shadow-sm ms-1"
                                onClick={() => updateLeaveStatus(leave.id, 'REJECTED')}
                                style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', border: 'none', borderRadius: '6px' }}
                              >
                                <i className="bi bi-x-circle me-1"></i>Reject
                              </button>
                            </div>
                          ) : (
                            <div className="btn-group">
                              {leave.status !== 'APPROVED' && (
                                <button 
                                  className="btn btn-sm btn-outline-success shadow-sm"
                                  onClick={() => updateLeaveStatus(leave.id, 'APPROVED')}
                                  style={{ borderRadius: '6px' }}
                                >
                                  <i className="bi bi-check-circle me-1"></i>Approve
                                </button>
                              )}
                              {leave.status !== 'REJECTED' && (
                                <button 
                                  className="btn btn-sm btn-outline-danger shadow-sm"
                                  onClick={() => updateLeaveStatus(leave.id, 'REJECTED')}
                                  style={{ borderRadius: '6px' }}
                                >
                                  <i className="bi bi-x-circle me-1"></i>Reject
                                </button>
                              )}
                              {leave.status !== 'PENDING' && (
                                <button 
                                  className="btn btn-sm btn-outline-warning shadow-sm"
                                  onClick={() => updateLeaveStatus(leave.id, 'PENDING')}
                                  style={{ borderRadius: '6px' }}
                                >
                                  <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}