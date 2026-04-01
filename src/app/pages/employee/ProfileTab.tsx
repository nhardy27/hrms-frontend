import { useState } from 'react';
import { Employee } from './types';

interface ProfileTabProps {
  employee: Employee | null;
}

function InfoRow({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="mb-2 px-3 py-2 rounded"
      style={{
        background: hovered ? '#f0f4ff' : 'transparent',
        borderLeft: `3px solid ${hovered ? color : 'transparent'}`,
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <i className={`bi ${icon} me-2`} style={{ color, fontSize: '1.1rem' }}></i>
      <span className="fw-bold" style={{ color: '#2c3e50', fontSize: '1.05rem' }}>{label}:</span>{' '}
      <span style={{ color: '#495057', fontSize: '1.05rem' }}>{value}</span>
    </div>
  );
}

export function ProfileTab({ employee }: ProfileTabProps) {
  const fullName = `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim() || 'N/A';

  return (
    <div className="card shadow-sm border-0" style={{ background: '#ffffff' }}>
      <div className="card-header" style={{ background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
        <h5 className="mb-0" style={{ color: '#2c3e50' }}><i className="bi bi-person me-2"></i>Employee Information</h5>
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-6">
            <InfoRow icon="bi-person-badge"   color="#3498db" label="Full Name"     value={fullName} />
            <InfoRow icon="bi-person-circle"  color="#9b59b6" label="Username"      value={employee?.username || 'N/A'} />
            <InfoRow icon="bi-envelope"       color="#e74c3c" label="Email"         value={employee?.email || 'N/A'} />
            <InfoRow icon="bi-hash"           color="#16a085" label="Employee Code" value={employee?.emp_code || 'N/A'} />
          </div>
          <div className="col-md-6">
            <InfoRow icon="bi-telephone"      color="#27ae60" label="Contact No"     value={employee?.contact_no || 'N/A'} />
            <InfoRow icon="bi-briefcase"      color="#f39c12" label="Designation"    value={employee?.designation || 'N/A'} />
            <InfoRow icon="bi-building"       color="#e67e22" label="Department"     value={employee?.department_name || 'N/A'} />
            <InfoRow icon="bi-calendar-check" color="#2ecc71" label="Date of Joining" value={employee?.date_of_joining || 'N/A'} />
          </div>
        </div>
      </div>
    </div>
  );
}
