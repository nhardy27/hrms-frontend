// React hooks for state management and side effects
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { AdminLayout } from '../../components/AdminLayout';
import { fetchAllPages, makeAuthenticatedRequest } from '../../../utils/apiUtils';

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  department: string;
  department_name?: string;
  is_active: boolean;
}

interface AttendanceData {
  id: string;
  user: number;
  date: string;
  check_in?: string;
  check_out?: string;
  total_hours?: string;
  attendance_status: string;
}

interface ManualTime {
  check_in: string;
  check_out: string;
}

export function MarkAttendance() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [existingAttendance, setExistingAttendance] = useState<AttendanceData[]>([]);
  const [manualTimes, setManualTimes] = useState<Record<string, ManualTime>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      const user = localStorage.getItem('user');
      if (!user) {
        navigate('/admin-dashboard');
        return;
      }
      
      const userData = JSON.parse(user);
      if (!(userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin'))) {
        toast.error('Access denied');
        navigate('/employee-dashboard');
        return;
      }
      
      await fetchEmployeesAndAttendance();
    };
    
    initializeData().catch(error => {
      console.error('Initialization error:', error);
      toast.error('Failed to load data');
      setDataLoading(false);
    });
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchEmployeesAndAttendance();
    }
  }, [selectedDate]);

  const getEmployeeAttendance = (employeeId: string): AttendanceData | null => {
    return existingAttendance.find(att => att.user.toString() === employeeId.toString()) || null;
  };

  const fetchEmployeesAndAttendance = async () => {
    setDataLoading(true);
    try {
      const allEmployees = await fetchAllPages(`${config.api.host}${config.api.user}`);
      
      const processedEmployees = allEmployees
        .filter((emp: any) => emp.is_active && emp.username !== 'admin')
        .map((emp: any) => ({
          id: emp.id.toString(),
          emp_code: `EMP${emp.id.toString().padStart(3, '0')}`,
          first_name: emp.first_name || emp.username,
          last_name: emp.last_name || '',
          department: emp.department || '',
          department_name: emp.department_name || 'N/A',
          is_active: emp.is_active
        }));
      
      setEmployees(processedEmployees);
      
      const attendanceUrl = `${config.api.host}${config.api.attendance}?date=${selectedDate}`;
      const response = await makeAuthenticatedRequest(attendanceUrl);
      
      if (response.ok) {
        const data = await response.json();
        setExistingAttendance(data.results || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error('Failed to load attendance data');
    } finally {
      setDataLoading(false);
    }
  };

  const handleManualTimeChange = (employeeId: string, field: 'check_in' | 'check_out', value: string) => {
    setManualTimes(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const statusResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendanceStatus}`);
      if (!statusResponse.ok) throw new Error('Failed to get attendance status');
      
      const statusData = await statusResponse.json();
      const statuses = statusData.results || [];
      const presentStatus = statuses.find((s: any) => s.status?.toLowerCase() === 'present');
      const halfDayStatus = statuses.find((s: any) => s.status?.toLowerCase() === 'halfday');
      const absentStatus = statuses.find((s: any) => s.status?.toLowerCase() === 'absent');
      
      if (!presentStatus) throw new Error('Present status not found');

      const employeesToProcess = employees.filter(emp => {
        const manualTime = manualTimes[emp.id];
        return manualTime && (manualTime.check_in || manualTime.check_out);
      });
      
      if (employeesToProcess.length === 0) {
        toast.error('No changes to save');
        return;
      }

      const requests = employeesToProcess.map(async (emp) => {
        const manualTime = manualTimes[emp.id];
        const existingAttendance = getEmployeeAttendance(emp.id);
        
        if (existingAttendance) {
          const updateData: any = {};
          if (manualTime.check_in) updateData.check_in = manualTime.check_in;
          if (manualTime.check_out) updateData.check_out = manualTime.check_out;
          
          if (manualTime.check_in && manualTime.check_out) {
            const checkIn = new Date(`1970-01-01T${manualTime.check_in}`);
            const checkOut = new Date(`1970-01-01T${manualTime.check_out}`);
            const totalMs = checkOut.getTime() - checkIn.getTime();
            const hours = Math.floor(totalMs / (1000 * 60 * 60));
            const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
            updateData.total_hours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          }
          
          if (Object.keys(updateData).length === 0) return { success: false };
          
          return makeAuthenticatedRequest(
            `${config.api.host}${config.api.attendance}${existingAttendance.id}/`,
            { method: 'PATCH', body: JSON.stringify(updateData) }
          ).then(res => ({ success: res.ok }));
        } else {
          if (!manualTime.check_in && !manualTime.check_out) return { success: false };
          
          let totalHours = null;
          let statusId = presentStatus.id;
          
          if (manualTime.check_in && manualTime.check_out) {
            const checkIn = new Date(`1970-01-01T${manualTime.check_in}`);
            const checkOut = new Date(`1970-01-01T${manualTime.check_out}`);
            const totalMs = checkOut.getTime() - checkIn.getTime();
            const hours = Math.floor(totalMs / (1000 * 60 * 60));
            const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
            totalHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const totalHoursDecimal = hours + minutes / 60 + seconds / 3600;
            if (totalHoursDecimal >= 7) statusId = presentStatus.id;
            else if (totalHoursDecimal >= 4 && halfDayStatus) statusId = halfDayStatus.id;
            else if (absentStatus) statusId = absentStatus.id;
          }
          
          const createData: Record<string, any> = {
            user: parseInt(emp.id),
            date: selectedDate,
            attendance_status: statusId,
            check_in: manualTime.check_in,
            check_out: manualTime.check_out,
            total_hours: totalHours
          };
          
          Object.keys(createData).forEach(key => {
            if (createData[key] === null || createData[key] === undefined) delete createData[key];
          });
          
          return makeAuthenticatedRequest(
            `${config.api.host}${config.api.attendance}`,
            { method: 'POST', body: JSON.stringify(createData) }
          ).then(res => ({ success: res.ok }));
        }
      });

      const results = await Promise.all(requests);
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.length - successCount;
      
      if (successCount > 0) {
        toast.success(`Attendance saved for ${successCount} employees`);
        setManualTimes({});
      }
      if (errorCount > 0) toast.error(`Failed to save ${errorCount} employees`);
      
      await fetchEmployeesAndAttendance();
    } catch (error) {
      toast.error("Failed to save attendance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Mark Attendance">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-header d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2" style={{ background: '#3498db', borderRadius: '15px 15px 0 0', border: 'none' }}>
            <h5 className="mb-0 text-white"><i className="bi bi-calendar-check-fill me-2"></i>Mark Employee Attendance</h5>
            <input
              type="date"
              className="form-control shadow-sm"
              style={{ width: "auto", borderRadius: '8px' }}
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="card-body">
            <div className="row mb-3 g-3">
              <div className="col-12 col-md-6">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: '#0e0e0e' }}>
                  <div className="card-body text-center text-white">
                    <h4 className="fw-bold">{employees.length}</h4>
                    <p className="mb-0">Total Employees</p>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: '#0e0e0e' }}>
                  <div className="card-body text-center text-white">
                    <h4 className="fw-bold">
                      {employees.filter(emp => {
                        const empAttendance = getEmployeeAttendance(emp.id);
                        const manualTime = manualTimes[emp.id];
                        const checkInTime = manualTime?.check_in || empAttendance?.check_in;
                        const checkOutTime = manualTime?.check_out || empAttendance?.check_out;
                        
                        if (empAttendance?.total_hours) {
                          const [hours, minutes, seconds] = empAttendance.total_hours.split(':').map(Number);
                          return (hours + minutes / 60 + seconds / 3600) >= 7;
                        } else if (checkInTime && checkOutTime) {
                          const checkIn = new Date(`1970-01-01T${checkInTime}`);
                          const checkOut = new Date(`1970-01-01T${checkOutTime}`);
                          return ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) >= 7;
                        }
                        return false;
                      }).length}
                    </h4>
                    <p className="mb-0">Present Today</p>
                  </div>
                </div>
              </div>
            </div>

            {dataLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-2">Loading attendance data...</p>
              </div>
            ) : employees.length === 0 ? (
              <p className="text-center">No active employees found</p>
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="table table-hover" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee Code</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Auto Status</th>
                      <th>Check In Time</th>
                      <th>Check Out Time</th>
                      <th>Total Hours</th>
                      <th>Update Check In</th>
                      <th>Update Check Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const empAttendance = getEmployeeAttendance(emp.id);
                      let totalHours = 'N/A';
                      let calculatedHours = 0;
                      
                      const manualTime = manualTimes[emp.id];
                      const checkInTime = manualTime?.check_in || empAttendance?.check_in;
                      const checkOutTime = manualTime?.check_out || empAttendance?.check_out;
                      
                      if (empAttendance?.total_hours) {
                        const [hours, minutes, seconds] = empAttendance.total_hours.split(':').map(Number);
                        calculatedHours = hours + minutes / 60 + seconds / 3600;
                        totalHours = `${hours}h ${minutes}m ${seconds}s`;
                      } else if (checkInTime && checkOutTime) {
                        const checkIn = new Date(`1970-01-01T${checkInTime}`);
                        const checkOut = new Date(`1970-01-01T${checkOutTime}`);
                        const totalMs = checkOut.getTime() - checkIn.getTime();
                        const totalSeconds = Math.floor(totalMs / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;
                        calculatedHours = totalSeconds / 3600;
                        totalHours = `${hours}h ${minutes}m ${seconds}s`;
                      }
                      
                      let autoStatus = 'Absent';
                      let statusClass = 'bg-danger';
                      if (calculatedHours >= 7) {
                        autoStatus = 'Present';
                        statusClass = 'bg-success';
                      } else if (calculatedHours >= 4 && calculatedHours < 7) {
                        autoStatus = 'Half Day';
                        statusClass = 'bg-warning';
                      } else if (checkInTime && !checkOutTime) {
                        autoStatus = 'Checked In';
                        statusClass = 'bg-info';
                      } else if (calculatedHours > 0 && calculatedHours < 4) {
                        autoStatus = 'Insufficient Hours';
                        statusClass = 'bg-warning';
                      }
                      
                      return (
                        <tr key={emp.id}>
                          <td><strong>{emp.id}</strong></td>
                          <td><strong>{emp.emp_code}</strong></td>
                          <td><strong>{emp.first_name} {emp.last_name}</strong></td>
                          <td><span className="badge bg-secondary">{emp.department_name}</span></td>
                          <td>
                            <span className={`badge ${statusClass}`}>
                              {autoStatus}
                            </span>
                          </td>
                          <td>
                            {checkInTime ? (
                              <span className="badge bg-success">{checkInTime}</span>
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                          <td>
                            {checkOutTime ? (
                              <span className="badge bg-danger">{checkOutTime}</span>
                            ) : (
                              <span className="text-muted">--</span>
                            )}
                          </td>
                          <td>
                            <strong>{totalHours}</strong>
                            {calculatedHours > 0 && (
                              <div className={`small ${
                                calculatedHours >= 7 ? 'text-success' : 
                                calculatedHours >= 4 ? 'text-warning' : 
                                'text-danger'
                              }`}>
                                {calculatedHours >= 7 ? '✓ Present' : 
                                 calculatedHours >= 4 ? '⚠ Half Day' : 
                                 '✗ Absent'}
                              </div>
                            )}
                          </td>
                          <td>
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              style={{ width: '120px' }}
                              value={manualTime?.check_in || ''}
                              placeholder={empAttendance?.check_in || 'Set check-in time'}
                              onChange={(e) => handleManualTimeChange(emp.id, 'check_in', e.target.value)}
                            />
                            {empAttendance?.check_in && !manualTime?.check_in && (
                              <small className="text-muted">Current: {empAttendance.check_in}</small>
                            )}
                          </td>
                          <td>
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              style={{ width: '120px' }}
                              value={manualTime?.check_out || ''}
                              placeholder={empAttendance?.check_out || 'Set check-out time'}
                              onChange={(e) => handleManualTimeChange(emp.id, 'check_out', e.target.value)}
                            />
                            {empAttendance?.check_out && !manualTime?.check_out && (
                              <small className="text-muted">Current: {empAttendance.check_out}</small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {employees.length > 0 && (
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mt-4">
                <div className="text-muted">
                  <i className="bi bi-info-circle me-2"></i>
                  Manual override will update attendance records for {selectedDate}
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn px-4 shadow"
                    onClick={() => navigate("/admin-dashboard")}
                    style={{ background: '#2b3d4f', color: 'white', borderRadius: '8px', border: 'none' }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn text-white px-4 shadow"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{ background: '#3498db', borderRadius: '8px', border: 'none' }}
                  >
                    <i className="bi bi-check-circle me-2"></i>
                    {loading ? "Saving..." : "Save Attendance"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
