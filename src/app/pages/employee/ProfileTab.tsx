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
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>Employee Code:</label>
              <p className="form-control-plaintext">{employee?.emp_code || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>Username:</label>
              <p className="form-control-plaintext">{employee?.username || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>First Name:</label>
              <p className="form-control-plaintext">{employee?.first_name}</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>Last Name:</label>
              <p className="form-control-plaintext">{employee?.last_name}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>Email:</label>
              <p className="form-control-plaintext">{employee?.email}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold" style={{ color: '#2c3e50' }}>Department:</label>
              <p className="form-control-plaintext">{employee?.department_name || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}