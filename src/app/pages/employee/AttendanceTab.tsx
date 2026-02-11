import { Attendance } from './types';

interface AttendanceTabProps {
  attendances: Attendance[];
}

export function AttendanceTab({ attendances }: AttendanceTabProps) {
  // Get current logged-in user with error handling
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : {};
    } catch (error) {
      console.error('Error parsing user data:', error);
      return {};
    }
  };
  
  const currentUser = getCurrentUser();
  const currentUserId = currentUser.id?.toString();
  
  // Filter attendances for current user only
  const userAttendances = attendances.filter(att => {
    return att.user?.toString() === currentUserId;
  });
  
  // Remove duplicates and keep latest entry per date
  const uniqueAttendances = userAttendances.reduce((acc: Attendance[], current) => {
    const existingIndex = acc.findIndex(att => att.date === current.date);
    if (existingIndex >= 0) {
      // Keep the one with check_out if available, otherwise keep the latest
      if (current.check_out || !acc[existingIndex].check_out) {
        acc[existingIndex] = current;
      }
    } else {
      acc.push(current);
    }
    return acc;
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0"><i className="bi bi-clock me-2"></i>Recent Attendance</h5>
      </div>
      <div className="card-body">
        {userAttendances.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {uniqueAttendances.map((att) => {
                  // Use total_hours from API if available, otherwise calculate
                  let totalHours = 'N/A';
                  if (att.total_hours) {
                    // Convert HH:MM:SS to hours:minutes:seconds format
                    const [hours, minutes, seconds] = att.total_hours.split(':').map(Number);
                    totalHours = `${hours}h ${minutes}m ${seconds}s`;
                  } else if (att.check_in && att.check_out) {
                    const checkIn = new Date(`1970-01-01T${att.check_in}`);
                    const checkOut = new Date(`1970-01-01T${att.check_out}`);
                    const totalMs = checkOut.getTime() - checkIn.getTime();
                    const totalSeconds = Math.floor(totalMs / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    totalHours = `${hours}h ${minutes}m ${seconds}s`;
                  }
                  
                  return (
                    <tr key={att.id}>
                      <td>{new Date(att.date).toLocaleDateString('en-GB')}</td>
                      <td>{att.check_in || 'N/A'}</td>
                      <td>{att.check_out || 'N/A'}</td>
                      <td>{totalHours}</td>
                    </tr>
                  );
                })
              }
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">No attendance records found.</p>
        )}
      </div>
    </div>
  );
}