import { Employee } from '../types';

interface ProfileTabProps {
  employee: Employee | null;
}

export function ProfileTab({ employee }: ProfileTabProps) {
  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0"><i className="bi bi-person me-2"></i>Employee Information</h5>
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label fw-bold">Employee Code:</label>
              <p className="form-control-plaintext">{employee?.emp_code || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Username:</label>
              <p className="form-control-plaintext">{employee?.username || 'N/A'}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">First Name:</label>
              <p className="form-control-plaintext">{employee?.first_name}</p>
            </div>
          </div>
          <div className="col-md-6">
            <div className="mb-3">
              <label className="form-label fw-bold">Last Name:</label>
              <p className="form-control-plaintext">{employee?.last_name}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Email:</label>
              <p className="form-control-plaintext">{employee?.email}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-bold">Department:</label>
              <p className="form-control-plaintext">{employee?.department_name || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}