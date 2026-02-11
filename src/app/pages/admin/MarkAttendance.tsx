// React hooks for state management and side effects
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast'; // Toast notifications
import config from "../../../config/global.json"; // API configuration
import { AdminLayout } from '../../components/AdminLayout';
import { fetchAllPages, makeAuthenticatedRequest } from '../../../utils/apiUtils';

// Employee data structure from API
interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  department: string;
  department_name?: string;
  is_active: boolean;
}

// Attendance record structure from API
interface AttendanceData {
  id: string;
  user: number; // Employee ID
  date: string;
  check_in?: string;
  check_out?: string;
  total_hours?: string;
  attendance_status: string;
}

// Manual time entry for updating attendance
interface ManualTime {
  check_in: string;
  check_out: string;
}



export function MarkAttendance() {
  const navigate = useNavigate();

  // State variables
  const [employees, setEmployees] = useState<Employee[]>([]); // List of all active employees
  const [existingAttendance, setExistingAttendance] = useState<AttendanceData[]>([]); // Attendance records for selected date
  const [manualTimes, setManualTimes] = useState<Record<string, ManualTime>>({}); // Manual time overrides by employee ID
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0] // Default to today's date
  );
  const [loading, setLoading] = useState(false); // Loading state for save operation

  // Initialize component on mount - check admin access and load data
  useEffect(() => {
    const initializeData = async () => {
      // Check if user is admin/superuser
      const user = localStorage.getItem('user');
      if (!user) {
        navigate('/admin-dashboard');
        return;
      }
      
      const userData = JSON.parse(user);
      // Only allow superusers or admin staff to access this page
      if (!(userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin'))) {
        toast.error('Access denied. Only admin users can access this page.');
        navigate('/employee-dashboard');
        return;
      }
      
      console.log('Starting data initialization...');
      
      // Load employees and attendance data
      console.log('Fetching employees and attendance...');
      await fetchEmployeesAndAttendance();
      
      console.log('Data initialization complete');
    };
    
    initializeData().catch(error => {
      console.error('Error during initialization:', error);
    });
  }, []);

  // Reload attendance data when date changes
  useEffect(() => {
    if (employees.length > 0) {
      fetchEmployeesAndAttendance();
    }
  }, [selectedDate]);


  // Find attendance record for a specific employee on selected date
  const getEmployeeAttendance = (employeeId: string): AttendanceData | null => {
    const attendance = existingAttendance.find(att => 
      att.user.toString() === employeeId.toString()
    ) || null;
    console.log(`Employee ${employeeId} attendance for ${selectedDate}:`, attendance);
    console.log(`Looking for user ID: ${employeeId}, found: ${attendance ? attendance.user : 'none'}`);
    return attendance;
  };

  // Fetch all employees and their attendance records from API
  const fetchEmployeesAndAttendance = async () => {
    try {
      console.log('Fetching employees from User API...');
      
      // Fetch all pages of employees from User API (handles pagination)
      let allEmployees: any[] = [];
      let nextUrl = `${config.api.host}${config.api.user}`;
      
      while (nextUrl) {
        const employeeResponse = await makeAuthenticatedRequest(nextUrl);
        
        if (employeeResponse.ok) {
          const employeeData = await employeeResponse.json();
          console.log('User API page data:', employeeData);
          
          allEmployees = [...allEmployees, ...(employeeData.results || [])];
          nextUrl = employeeData.next; // Get next page URL
        } else {
          console.error('Failed to fetch employees:', employeeResponse.status, employeeResponse.statusText);
          break;
        }
      }
      
      console.log('All employees from all pages:', allEmployees.length);
      
      // Filter active employees (exclude admin) and format data
      const processedEmployees = allEmployees.filter((emp: any) => 
        emp.is_active && emp.username !== 'admin'
      ).map((emp: any) => ({
        id: emp.id.toString(),
        emp_code: `EMP${emp.id.toString().padStart(3, '0')}`, // Generate employee code
        first_name: emp.first_name || emp.username,
        last_name: emp.last_name || '',
        department: emp.department || '',
        department_name: emp.department_name || 'N/A',
        is_active: emp.is_active
      }));
      
      console.log('Processed employees:', processedEmployees);
      setEmployees(processedEmployees);
      
      // Fetch attendance data using fetchAllPages (handles pagination automatically)
      console.log('Fetching attendance data...');
      const allAttendanceRecords = await fetchAllPages(`${config.api.host}${config.api.attendance}`);
      
      console.log('All attendance records from all pages:', allAttendanceRecords.length);
      
      // Filter attendance for selected date only
      const attendanceForDate = allAttendanceRecords.filter(
        (att: AttendanceData) => att.date === selectedDate
      );
      
      console.log('Attendance for date:', attendanceForDate);
      setExistingAttendance(attendanceForDate);
      
    } catch (error) {
      console.error("Error fetching employees and attendance:", error);
    }
  };



  // Handle manual time input changes for check-in/check-out
  const handleManualTimeChange = (employeeId: string, field: 'check_in' | 'check_out', value: string) => {
    console.log(`Manual time change for employee ${employeeId}: ${field} = ${value}`);
    setManualTimes(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value
      }
    }));
  };

  // Save attendance records to database (create new or update existing)
  const handleSubmit = async () => {
    setLoading(true);
    try {
      console.log('Starting attendance save...');
      
      // Get attendance statuses from API (Present, Half Day, Absent)
      const statusResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendanceStatus}`);
      if (!statusResponse.ok) {
        throw new Error('Failed to get attendance status');
      }
      const statusData = await statusResponse.json();
      const statuses = statusData.results || [];
      const presentStatus = statuses.find((s: any) => s.status?.toLowerCase() === 'present');
      const halfDayStatus = statuses.find((s: any) => s.status?.toLowerCase() === 'halfday');
      const absentStatus = statuses.find((s: any) => s.status?.toLowerCase() === 'absent');
      
      if (!presentStatus) {
        throw new Error('Present status not found');
      }

      // Process only employees with manual time changes
      let successCount = 0;
      let errorCount = 0;
      
      const employeesToProcess = employees.filter(emp => {
        const manualTime = manualTimes[emp.id];
        return manualTime && (manualTime.check_in || manualTime.check_out);
      });
      
      console.log(`Processing ${employeesToProcess.length} employees with manual time changes`);
      
      for (const emp of employeesToProcess) {
        const manualTime = manualTimes[emp.id];
        console.log(`Processing employee ${emp.first_name} ${emp.last_name}:`, manualTime);
        
        const existingAttendance = getEmployeeAttendance(emp.id);
        
        try {
          if (existingAttendance) {
            // UPDATE existing attendance record
            const updateData: any = {};
            if (manualTime.check_in) updateData.check_in = manualTime.check_in;
            if (manualTime.check_out) updateData.check_out = manualTime.check_out;
            
            // Calculate total_hours if both times are present
            if (manualTime.check_in && manualTime.check_out) {
              const checkIn = new Date(`1970-01-01T${manualTime.check_in}`);
              const checkOut = new Date(`1970-01-01T${manualTime.check_out}`);
              const totalMs = checkOut.getTime() - checkIn.getTime();
              const hours = Math.floor(totalMs / (1000 * 60 * 60));
              const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
              updateData.total_hours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            // Ensure we have at least one field to update
            if (Object.keys(updateData).length === 0) {
              console.log(`No data to update for ${emp.first_name} ${emp.last_name}`);
              continue;
            }
            
            console.log('Update data:', updateData);
            
            const response = await makeAuthenticatedRequest(
              `${config.api.host}${config.api.attendance}${existingAttendance.id}/`,
              {
                method: 'PATCH',
                body: JSON.stringify(updateData)
              }
            );
            
            if (response.ok) {
              console.log(`Successfully updated attendance for ${emp.first_name} ${emp.last_name}`);
              successCount++;
            } else {
              const errorText = await response.text();
              console.error(`Failed to update attendance for ${emp.first_name} ${emp.last_name}:`);
              console.error('Status:', response.status);
              console.error('Error:', errorText);
              console.error('Update data sent:', updateData);
              errorCount++;
            }
          } else {
            // CREATE new attendance record
            if (!manualTime.check_in && !manualTime.check_out) {
              console.log(`No check-in or check-out time for ${emp.first_name} ${emp.last_name}`);
              continue;
            }
            
            // Calculate total_hours and auto-assign status
            let totalHours = null;
            let statusId = presentStatus.id; // default
            
            if (manualTime.check_in && manualTime.check_out) {
              const checkIn = new Date(`1970-01-01T${manualTime.check_in}`);
              const checkOut = new Date(`1970-01-01T${manualTime.check_out}`);
              const totalMs = checkOut.getTime() - checkIn.getTime();
              const hours = Math.floor(totalMs / (1000 * 60 * 60));
              const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
              const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
              totalHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              
              // Auto-assign status: >=7hrs = Present, 4-7hrs = Half Day, <4hrs = Absent
              const totalHoursDecimal = hours + minutes / 60 + seconds / 3600;
              if (totalHoursDecimal >= 7) {
                statusId = presentStatus.id;
              } else if (totalHoursDecimal >= 4 && halfDayStatus) {
                statusId = halfDayStatus.id;
              } else if (absentStatus) {
                statusId = absentStatus.id;
              }
            }
            
            const createData: Record<string, any> = {
              user: parseInt(emp.id),
              date: selectedDate,
              attendance_status: statusId,
              check_in: manualTime.check_in,
              check_out: manualTime.check_out,
              total_hours: totalHours
            };
            
            // Remove null/undefined values
            Object.keys(createData).forEach(key => {
              if (createData[key] === null || createData[key] === undefined) {
                delete createData[key];
              }
            });
            
            console.log('Create data:', createData);
            
            const response = await makeAuthenticatedRequest(
              `${config.api.host}${config.api.attendance}`,
              {
                method: 'POST',
                body: JSON.stringify(createData)
              }
            );
            
            if (response.ok) {
              console.log(`Successfully created attendance for ${emp.first_name} ${emp.last_name}`);
              successCount++;
            } else {
              const errorText = await response.text();
              console.error(`Failed to create attendance for ${emp.first_name} ${emp.last_name}:`);
              console.error('Status:', response.status);
              console.error('Error:', errorText);
              console.error('Create data sent:', createData);
              errorCount++;
            }
          }
        } catch (empError) {
          console.error(`Error processing ${emp.first_name} ${emp.last_name}:`, empError);
          errorCount++;
        }
      }
      
      console.log(`Attendance save complete. Success: ${successCount}, Errors: ${errorCount}`);
      
      // Show success/error messages
      if (successCount > 0) {
        toast.success(`Attendance saved to database for ${successCount} employees`);
        setManualTimes({}); // Clear manual times after successful save
      }
      if (errorCount > 0) {
        toast.error(`Failed to save ${errorCount} employees to database`);
      }
      if (employeesToProcess.length === 0) {
        toast.error('No manual time changes to save');
      }
      
      await fetchEmployeesAndAttendance(); // Refresh data from database
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance to database: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Mark Attendance">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-header d-flex justify-content-between align-items-center" style={{ background: '#3498db', borderRadius: '15px 15px 0 0', border: 'none' }}>
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
              <div className="col-md-6">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: '#0e0e0e' }}>
                  <div className="card-body text-center text-white">
                    <h4 className="fw-bold">{employees.length}</h4>
                    <p className="mb-0">Total Employees</p>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', background: '#0e0e0e' }}>
                  <div className="card-body text-center text-white">
                    <h4 className="fw-bold">
                      {(() => {
                        // Calculate present count: employees with >=7 hours worked
                        console.log('=== Present Count Calculation ===');
                        console.log('existingAttendance:', existingAttendance);
                        console.log('selectedDate:', selectedDate);
                        
                        const presentCount = employees.filter(emp => {
                          const empAttendance = getEmployeeAttendance(emp.id);
                          const manualTime = manualTimes[emp.id];
                          const checkInTime = manualTime?.check_in || empAttendance?.check_in;
                          const checkOutTime = manualTime?.check_out || empAttendance?.check_out;
                          
                          console.log(`Employee ${emp.id} (${emp.first_name}):`, {
                            empAttendance,
                            checkInTime,
                            checkOutTime,
                            total_hours: empAttendance?.total_hours
                          });
                          
                          // Use API total_hours if available
                          if (empAttendance?.total_hours) {
                            const [hours, minutes, seconds] = empAttendance.total_hours.split(':').map(Number);
                            const calculatedHours = hours + minutes / 60 + seconds / 3600;
                            console.log(`  -> Calculated hours from total_hours: ${calculatedHours}`);
                            return calculatedHours >= 7;
                          } else if (checkInTime && checkOutTime) {
                            // Calculate from check-in/check-out times
                            const checkIn = new Date(`1970-01-01T${checkInTime}`);
                            const checkOut = new Date(`1970-01-01T${checkOutTime}`);
                            const calculatedHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
                            console.log(`  -> Calculated hours from times: ${calculatedHours}`);
                            return calculatedHours >= 7;
                          }
                          console.log(`  -> No attendance data`);
                          return false;
                        }).length;
                        
                        console.log('Total present count:', presentCount);
                        return presentCount;
                      })()}
                    </h4>
                    <p className="mb-0">Present Today</p>
                  </div>
                </div>
              </div>
            </div>

            {employees.length === 0 ? (
              <p className="text-center">No active employees found</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
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
                      
                      // Calculate total hours worked
                      let totalHours = 'N/A';
                      let calculatedHours = 0;
                      
                      // Get check-in/check-out times (manual override or existing)
                      const manualTime = manualTimes[emp.id];
                      const checkInTime = manualTime?.check_in || empAttendance?.check_in;
                      const checkOutTime = manualTime?.check_out || empAttendance?.check_out;
                      
                      // Use API total_hours if available, otherwise calculate
                      if (empAttendance?.total_hours) {
                        const [hours, minutes, seconds] = empAttendance.total_hours.split(':').map(Number);
                        calculatedHours = hours + minutes / 60 + seconds / 3600;
                        totalHours = `${hours}h ${minutes}m ${seconds}s`;
                      } else if (checkInTime && checkOutTime) {
                        // Calculate from check-in/check-out times
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
                      
                      // Determine auto status based on hours worked
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
              <div className="d-flex justify-content-between align-items-center mt-4">
                <div className="text-muted">
                  <i className="bi bi-info-circle me-2"></i>
                  Manual override will update attendance records for {selectedDate}
                </div>
                <div>
                  <button
                    className="btn px-4 shadow me-2"
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