import { Employee } from './types';

interface ProfileTabProps {
  employee: Employee | null;
}

export function ProfileTab({ employee }: ProfileTabProps) {
  return (
    <div className="card shadow-sm border-0" style={{ background: '#ffffff' }}>
      <div className="card-header" style={{ background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
        <h5 className="mb-0" style={{ color: '#2c3e50' }}><i className="bi bi-person me-2"></i>Employee Information</h5>
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-person-badge me-2" style={{ color: '#3498db' }}></i>Full Name:
              </label>
              <p className="form-control-plaintext">{employee?.first_name} {employee?.last_name}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-person-circle me-2" style={{ color: '#9b59b6' }}></i>Username:
              </label>
              <p className="form-control-plaintext">{employee?.username || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-envelope me-2" style={{ color: '#e74c3c' }}></i>Email:
              </label>
              <p className="form-control-plaintext">{employee?.email}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-hash me-2" style={{ color: '#16a085' }}></i>Employee Code:
              </label>
              <p className="form-control-plaintext">{employee?.emp_code || 'N/A'}</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-telephone me-2" style={{ color: '#27ae60' }}></i>Contact No:
              </label>
              <p className="form-control-plaintext">{employee?.contact_no || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-briefcase me-2" style={{ color: '#f39c12' }}></i>Designation:
              </label>
              <p className="form-control-plaintext">{employee?.designation || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-building me-2" style={{ color: '#e67e22' }}></i>Department:
              </label>
              <p className="form-control-plaintext">{employee?.department_name || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>
                <i className="bi bi-calendar-check me-2" style={{ color: '#2ecc71' }}></i>Date of Joining:
              </label>
              <p className="form-control-plaintext">{employee?.date_of_joining || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}