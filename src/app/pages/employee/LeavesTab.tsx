import { useState } from 'react';
import { Leave } from './types';
import config from '../../../config/global.json';
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
import toast from 'react-hot-toast';

interface LeavesTabProps {
  leaves: Leave[];
  onLeaveApplied: () => void;
}

export function LeavesTab({ leaves, onLeaveApplied }: LeavesTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ from_date: '', to_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!leaveForm.from_date || !leaveForm.to_date || !leaveForm.reason) {
      toast.error('Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      const user = localStorage.getItem('user');
      const userId = user ? JSON.parse(user).id : 0;

      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.leave}`, {
        method: 'POST',
        body: JSON.stringify({
          user: parseInt(userId),
          from_date: leaveForm.from_date,
          to_date: leaveForm.to_date,
          reason: leaveForm.reason
        })
      });
      
      if (response.ok) {
        toast.success('Leave application submitted!');
        setShowForm(false);
        setLeaveForm({ from_date: '', to_date: '', reason: '' });
        onLeaveApplied();
      } else {
        toast.error('Failed to apply for leave');
      }
    } catch (error) {
      console.error('Error applying leave:', error);
      toast.error('Error applying for leave');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const getStatusBadge = (status?: string) => {
    const upperStatus = status?.toUpperCase() || 'PENDING';
    const colors = {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'danger'
    };
    return `badge bg-${colors[upperStatus as keyof typeof colors] || 'warning'}`;
  };

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0"><i className="bi bi-calendar-x me-2"></i>Leave Applications</h5>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={() => setShowForm(!showForm)}
        >
          <i className="bi bi-plus-circle me-2"></i>
          {showForm ? 'Cancel' : 'Apply New Leave'}
        </button>
      </div>
      <div className="card-body">
        {showForm && (
          <div className="card mb-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="card-body text-white">
              <div className="d-flex align-items-center mb-3">
                <div className="bg-white rounded-circle p-2 me-3">
                  <i className="bi bi-calendar-plus fs-4 text-primary"></i>
                </div>
                <h5 className="mb-0">New Leave Application</h5>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      <i className="bi bi-calendar-event me-2"></i>From Date
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-lg"
                      value={leaveForm.from_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, from_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">
                      <i className="bi bi-calendar-check me-2"></i>To Date
                    </label>
                    <input
                      type="date"
                      className="form-control form-control-lg"
                      value={leaveForm.to_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, to_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold">
                      <i className="bi bi-chat-left-text me-2"></i>Reason for Leave
                    </label>
                    <textarea
                      className="form-control form-control-lg"
                      rows={3}
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      placeholder="Please provide a detailed reason for your leave request..."
                      required
                    ></textarea>
                  </div>
                  <div className="col-12">
                    <div className="d-flex gap-2 justify-content-end">
                      <button 
                        type="button" 
                        className="btn btn-light btn-lg px-4"
                        onClick={() => {
                          setShowForm(false);
                          setLeaveForm({ from_date: '', to_date: '', reason: '' });
                        }}
                      >
                        <i className="bi bi-x-circle me-2"></i>Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-success btn-lg px-4" 
                        disabled={submitting}
                      >
                        <i className="bi bi-send-fill me-2"></i>
                        {submitting ? 'Submitting...' : 'Submit Application'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {leaves.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{formatDate(leave.from_date)}</td>
                    <td>{formatDate(leave.to_date)}</td>
                    <td>
                      <span className={getStatusBadge(leave.status)}>
                        {leave.status || 'PENDING'}
                      </span>
                    </td>
                    <td>{leave.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">No leave applications found.</p>
        )}
      </div>
    </div>
  );
}