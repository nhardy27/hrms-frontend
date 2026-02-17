// React hooks for state and lifecycle management
import { useState, useEffect } from "react";
// Router hook for navigation
import { useNavigate } from "react-router-dom";
// Toast notifications for user feedback
import toast, { Toaster } from 'react-hot-toast';
// API configuration
import config from "../../../config/global.json";
// Utility for authenticated API requests
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
// Admin layout wrapper component
import { AdminLayout } from '../../components/AdminLayout';

// TypeScript interface for Employee data structure
interface Employee {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  emp_code?: string;
  bank_name?: string;
  bank_account_number?: string;
  ifsc_code?: string;
}

// TypeScript interface for Year data
interface Year {
  id: string;
  year: number;
}

// TypeScript interface for Attendance records
interface Attendance {
  id: string;
  user: number;
  date: string;
  total_hours?: string;
}

// TypeScript interface for Salary Record from API
interface SalaryRecord {
  id: string;
  user: {
    id: number;
    username: string;
    email: string;
  } | null;
  month: number;
  year: string;
  basic_salary: string;
  hra: string;
  allowance: string;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  deduction: string;
  pf_percentage: string;
  pf_amount: string;
  net_salary: string;
  payment_status: string;
}

// TypeScript interface for Salary Form data
interface SalaryForm {
  user: string;
  year: string;
  month: number;
  attendance: string;
  basic_salary: string;
  hra: string;
  allowance: string;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  half_days: number;
  deduction: string;
  pf_percentage: string;
  pf_amount: string;
  net_salary: string;
  payment_status: string;
}

// Array of month names for dropdown and display
const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

export function SalaryManagement() {
  // Hook for programmatic navigation
  const navigate = useNavigate();
  
  // State to store list of employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  // State to store selected employee's bank info
  const [selectedEmployeeBankInfo, setSelectedEmployeeBankInfo] = useState<{bank_name?: string; bank_account_number?: string; ifsc_code?: string} | null>(null);
  // State to store list of years
  const [years, setYears] = useState<Year[]>([]);
  // State to store all salary records
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  // State to track which salary is being edited (null = creating new)
  const [editingId, setEditingId] = useState<string | null>(null);
  // Loading state for form submission
  const [loading, setLoading] = useState(false);
  
  // Form data state with initial values
  const [formData, setFormData] = useState<SalaryForm>({
    user: '',
    year: '',
    month: new Date().getMonth() + 1, // Current month
    attendance: '',
    basic_salary: '',
    hra: '',
    allowance: '',
    total_working_days: 26, // Default working days
    present_days: 0,
    absent_days: 0,
    half_days: 0,
    deduction: '0',
    pf_percentage: '12.00',
    pf_amount: '0',
    net_salary: '0',
    payment_status: 'unpaid'
  });

  // Effect runs on component mount - checks authentication and loads initial data
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/admin-dashboard');
      return;
    }
    
    const userData = JSON.parse(user);
    // Check if user has admin privileges
    if (!(userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin'))) {
      toast.error('Access denied. Only admin users can access this page.');
      navigate('/employee-dashboard');
      return;
    }
    
    // Load initial data
    fetchEmployees();
    fetchYears();
    setTimeout(() => fetchSalaries(), 100); // Slight delay to ensure employees are loaded first
  }, []);

  // Effect runs when user, year, or month changes - fetches attendance data
  useEffect(() => {
    if (formData.user && formData.year && formData.month && !editingId) {
      fetchAttendanceForMonth();
    }
  }, [formData.user, formData.year, formData.month]);

  // Effect runs when salary components change - recalculates net salary
  useEffect(() => {
    calculateNetSalary();
  }, [formData.basic_salary, formData.hra, formData.allowance, formData.deduction, formData.pf_percentage, formData.present_days, formData.half_days, formData.total_working_days]);

  // Function to fetch all salary records from API
  const fetchSalaries = async () => {
    try {
      console.log('Fetching salaries from:', `${config.api.host}${config.api.salary}`);
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.salary}`);
      console.log('Salary response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Salary data:', data);
        // Map records and populate user details
        const records = (data.results || []).map((record: any) => {
          if (typeof record.user === 'number') {
            const emp = employees.find(e => e.id === record.user);
            return {
              ...record,
              user: emp ? { id: emp.id, username: emp.username, email: emp.email } : null
            };
          }
          return record;
        }).sort((a: SalaryRecord, b: SalaryRecord) => {
          // Sort by year (descending) then by month (descending)
          const yearA = years.find(y => y.id === a.year)?.year || 0;
          const yearB = years.find(y => y.id === b.year)?.year || 0;
          if (yearB !== yearA) return yearB - yearA;
          return b.month - a.month;
        });
        setSalaryRecords(records);
      } else {
        console.error('Failed to fetch salaries, status:', response.status);
        toast.error('Failed to fetch salary records. Please check backend.');
      }
    } catch (error) {
      console.error("Error fetching salaries:", error);
      toast.error('Error loading salary records');
    }
  };

  // Function to fetch all active employees (excluding admin)
  const fetchEmployees = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}`);
      if (response.ok) {
        const data = await response.json();
        // Filter only active employees, exclude admin user
        const emps = data.results.filter((emp: any) => emp.is_active && emp.username !== 'admin');
        console.log('Fetched employees with bank info:', emps);
        setEmployees(emps);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to fetch employees");
    }
  };

  // Function to fetch available years from API
  const fetchYears = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.year}`);
      if (response.ok) {
        const data = await response.json();
        setYears(data.results);
      }
    } catch (error) {
      console.error("Error fetching years:", error);
      toast.error("Failed to fetch years");
    }
  };

  // Function to fetch and calculate attendance for selected month
  const fetchAttendanceForMonth = async () => {
    try {
      const selectedEmployee = employees.find(e => e.id === parseInt(formData.user));
      const selectedYear = years.find(y => y.id === formData.year)?.year;
      const selectedMonth = MONTHS.find(m => m.value === formData.month)?.label.toLowerCase();

      if (!selectedEmployee?.emp_code || !selectedYear || !selectedMonth) {
        console.log('Missing required data for attendance search');
        return;
      }

      const searchUrl = `${config.api.host}${config.api.attendance}?emp_code=${selectedEmployee.emp_code}&year=${selectedYear}&month=${selectedMonth}`;
      console.log('Fetching attendance from:', searchUrl);

      const response = await makeAuthenticatedRequest(searchUrl);
      console.log('Attendance response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Attendance data received:', data);
        const monthRecords = data.results || data || [];
        console.log('Month records:', monthRecords);

        let presentDays = 0;
        let halfDays = 0;

        monthRecords.forEach((att: Attendance) => {
          if (att.total_hours) {
            const [hours] = att.total_hours.split(':').map(Number);
            if (hours >= 7) presentDays++;
            else if (hours >= 4) halfDays++;
          }
        });

        const absentDays = formData.total_working_days - presentDays - halfDays;
        console.log('Calculated - Present:', presentDays, 'Half:', halfDays, 'Absent:', absentDays);

        setFormData(prev => ({
          ...prev,
          present_days: presentDays,
          half_days: halfDays,
          absent_days: absentDays,
          attendance: monthRecords[0]?.id || ''
        }));
      } else {
        const errorData = await response.text();
        console.error('Attendance fetch error:', errorData);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };


  // Function to calculate net salary based on components and attendance
  const calculateNetSalary = () => {
    // Parse salary components
    const basic = parseFloat(formData.basic_salary) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const allowance = parseFloat(formData.allowance) || 0;
    const deduction = parseFloat(formData.deduction) || 0;
    const pfPercentage = parseFloat(formData.pf_percentage) || 0;
    
    // Calculate total salary and per day salary
    const totalSalary = basic + hra + allowance;
    const perDaySalary = totalSalary / formData.total_working_days;
    
    // Calculate earned salary (full days + half days at 50%)
    const earnedSalary = (formData.present_days * perDaySalary) + (formData.half_days * perDaySalary * 0.5);
    
    // Calculate PF amount
    const pfAmount = (basic * pfPercentage) / 100;
    
    // Calculate final net salary after deductions and PF
    const netSalary = earnedSalary - deduction - pfAmount;
    
    // Update form with calculated values
    setFormData(prev => ({ 
      ...prev, 
      pf_amount: pfAmount.toFixed(2),
      net_salary: netSalary.toFixed(2) 
    }));
  };

  // Function to handle viewing salary slip
  const handleView = (salary: SalaryRecord) => {
    navigate(`/salary-slip/${salary.id}`);
  };

  // Function to handle editing an existing salary record
  const handleEdit = (salary: SalaryRecord) => {
    // Set editing mode with salary ID
    setEditingId(salary.id);
    // Populate form with existing salary data
    setFormData({
      user: salary.user?.id.toString() || '',
      year: salary.year,
      month: salary.month,
      attendance: '',
      basic_salary: salary.basic_salary,
      hra: salary.hra,
      allowance: salary.allowance,
      total_working_days: salary.total_working_days,
      present_days: salary.present_days,
      absent_days: salary.absent_days,
      half_days: salary.half_days,
      deduction: salary.deduction,
      pf_percentage: salary.pf_percentage,
      pf_amount: salary.pf_amount,
      net_salary: salary.net_salary,
      payment_status: salary.payment_status
    });
    // Scroll to top to show form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Function to delete a salary record
  const handleDelete = async (id: string) => {
    // Confirm before deleting
    if (!confirm('Are you sure you want to delete this salary record?')) return;
    
    try {
      const response = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.salary}${id}/`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        toast.success("Salary deleted successfully");
        fetchSalaries(); // Refresh the list
      } else {
        toast.error("Failed to delete salary");
      }
    } catch (error) {
      console.error("Error deleting salary:", error);
      toast.error("Failed to delete salary");
    }
  };

  // Function to handle form submission (create or update salary)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.user || !formData.year) {
      toast.error("Please select employee and year");
      return;
    }
    
    if (!formData.basic_salary || !formData.hra || !formData.allowance) {
      toast.error("Please fill salary details");
      return;
    }
    
    // Check for duplicate salary record (only when creating new)
    if (!editingId) {
      const existingSalary = salaryRecords.find(
        record => record.user?.id === parseInt(formData.user) && 
                  record.year === formData.year && 
                  record.month === formData.month
      );
      if (existingSalary) {
        toast.error("Salary already paid for this employee in the selected month");
        return;
      }
    }
    
    setLoading(true);
    try {
      // Prepare payload for API
      const payload: any = {
        user: parseInt(formData.user),
        year: formData.year,
        month: formData.month,
        basic_salary: parseFloat(formData.basic_salary).toFixed(2),
        hra: parseFloat(formData.hra).toFixed(2),
        allowance: parseFloat(formData.allowance).toFixed(2),
        total_working_days: formData.total_working_days,
        present_days: formData.present_days,
        absent_days: formData.absent_days,
        half_days: formData.half_days,
        deduction: parseFloat(formData.deduction).toFixed(2),
        pf_percentage: parseFloat(formData.pf_percentage).toFixed(2),
        pf_amount: parseFloat(formData.pf_amount).toFixed(2),
        net_salary: parseFloat(formData.net_salary).toFixed(2),
        payment_status: formData.payment_status
      };
      
      // Add attendance ID if available
      if (formData.attendance) {
        payload.attendance = formData.attendance;
      }
      
      console.log('Submitting payload:', payload);
      console.log('URL:', editingId ? `${config.api.host}${config.api.salary}${editingId}/` : `${config.api.host}${config.api.salary}`);
      
      // Make API request (PATCH for update, POST for create)
      const response = await makeAuthenticatedRequest(
        editingId 
          ? `${config.api.host}${config.api.salary}${editingId}/`
          : `${config.api.host}${config.api.salary}`,
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        }
      );
      
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const salaryData = await response.json();
        toast.success(editingId ? "Salary updated successfully" : "Salary created successfully");
        
        // Send email after creating or updating salary
        const salaryId = editingId || salaryData.id;
        if (salaryId) {
          try {
            const emailResponse = await makeAuthenticatedRequest(
              `${config.api.host}${config.api.salary}${salaryData.id}/send_email/`,
              {
                method: 'POST'
              }
            );
            
            if (emailResponse.ok) {
              toast.success("Salary email sent to employee");
            } else {
              const errorData = await emailResponse.json().catch(() => ({}));
              console.error('Email error:', errorData);
              toast.error("Salary created but failed to send email");
            }
          } catch (emailError) {
            console.error("Error sending email:", emailError);
            toast.error("Salary created but failed to send email");
          }
        }
        
        // Reset form and editing state
        setEditingId(null);
        setFormData({
          user: '',
          year: '',
          month: new Date().getMonth() + 1,
          attendance: '',
          basic_salary: '',
          hra: '',
          allowance: '',
          total_working_days: 26,
          present_days: 0,
          absent_days: 0,
          half_days: 0,
          deduction: '0',
          pf_percentage: '12.00',
          pf_amount: '0',
          net_salary: '0',
          payment_status: 'unpaid'
        });
        fetchSalaries(); // Refresh salary list
      } else {
        // Handle error response
        const errorText = await response.text();
        console.error('Error response:', errorText);
        let errorMsg = 'Failed to save salary';
        try {
          const errorData = JSON.parse(errorText);
          errorMsg = JSON.stringify(errorData);
        } catch {
          errorMsg = errorText;
        }
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to save salary: " + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Salary Management">
      {/* Toast notification container */}
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        {/* Salary Form Card */}
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px' }}>
          <div className="card-header text-white d-flex justify-content-between align-items-center" style={{background: '#2c3e50', borderRadius: '15px 15px 0 0', border: 'none'}}>
            <h5 className="mb-0"><i className="bi bi-cash-stack me-2"></i>{editingId ? 'Edit' : 'Create'} Employee Salary</h5>
            {/* Cancel Edit button - only shown when editing */}
            {editingId && (
              <button
                type="button"
                className="btn btn-sm shadow-sm"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px' }}
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    user: '',
                    year: '',
                    month: new Date().getMonth() + 1,
                    attendance: '',
                    basic_salary: '',
                    hra: '',
                    allowance: '',
                    total_working_days: 26,
                    present_days: 0,
                    absent_days: 0,
                    half_days: 0,
                    deduction: '0',
                    pf_percentage: '12.00',
                    pf_amount: '0',
                    net_salary: '0',
                    payment_status: 'unpaid'
                  });
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>
          <div className="card-body p-4" style={{background: '#f8f9fa'}}>
            <form onSubmit={handleSubmit}>
              {/* Employee & Period Selection */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="mb-3 fw-bold" style={{ color: '#2c3e50' }}><i className="bi bi-person-badge me-2"></i>Employee & Period Details</h6>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold text-secondary"><i className="bi bi-person me-1"></i>Employee *</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.user}
                        onChange={(e) => {
                          const selectedEmp = employees.find(emp => emp.id === parseInt(e.target.value));
                          console.log('Selected employee:', selectedEmp);
                          if (selectedEmp) {
                            setSelectedEmployeeBankInfo({
                              bank_name: selectedEmp.bank_name,
                              bank_account_number: selectedEmp.bank_account_number,
                              ifsc_code: selectedEmp.ifsc_code
                            });
                            console.log('Bank info set:', {
                              bank_name: selectedEmp.bank_name,
                              bank_account_number: selectedEmp.bank_account_number,
                              ifsc_code: selectedEmp.ifsc_code
                            });
                          } else {
                            setSelectedEmployeeBankInfo(null);
                          }
                          setFormData({ ...formData, user: e.target.value });
                        }}
                        required
                        style={{borderRadius: '8px', padding: '10px', border: '1px solid #dee2e6', background: '#ffffff'}}
                      >
                        <option value="">Select Employee</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} - {emp.emp_code || 'N/A'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary"><i className="bi bi-calendar-event me-1"></i>Year *</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.year}
                        onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                        required
                        style={{borderRadius: '8px', padding: '10px', border: '1px solid #dee2e6', background: '#ffffff'}}
                      >
                        <option value="">Select Year</option>
                        {years.map(year => (
                          <option key={year.id} value={year.id}>
                            {year.year}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary"><i className="bi bi-calendar-month me-1"></i>Month *</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.month}
                        onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                        required
                        style={{borderRadius: '8px', padding: '10px', border: '1px solid #dee2e6', background: '#ffffff'}}
                      >
                        {MONTHS.map(month => (
                          <option key={month.value} value={month.value}>
                            {month.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              {selectedEmployeeBankInfo && (
                <div className="card border-0 shadow-sm mb-3">
                  <div className="card-body">
                    <h6 className="mb-3 fw-bold" style={{ color: '#2c3e50' }}><i className="bi bi-bank me-2"></i>Bank Details</h6>
                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <label className="form-label fw-semibold text-secondary">Bank Name</label>
                        <input type="text" className="form-control" value={selectedEmployeeBankInfo.bank_name || 'Not Available'} readOnly style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}} />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label fw-semibold text-secondary">Account Number</label>
                        <input type="text" className="form-control" value={selectedEmployeeBankInfo.bank_account_number || 'Not Available'} readOnly style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}} />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label fw-semibold text-secondary">IFSC Code</label>
                        <input type="text" className="form-control" value={selectedEmployeeBankInfo.ifsc_code || 'Not Available'} readOnly style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Salary Components */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="mb-3 fw-bold" style={{ color: '#2c3e50' }}><i className="bi bi-currency-rupee me-2"></i>Salary Components</h6>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Basic Salary *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.basic_salary}
                          onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                          required
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#ffffff'}}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">HRA *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.hra}
                          onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                          required
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#ffffff'}}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Allowance *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.allowance}
                          onChange={(e) => setFormData({ ...formData, allowance: e.target.value })}
                          required
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#ffffff'}}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Details */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="mb-3 fw-bold" style={{ color: '#2c3e50' }}><i className="bi bi-calendar-check me-2"></i>Attendance Details</h6>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Total Working Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.total_working_days}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          const clampedValue = Math.max(1, Math.min(31, value));
                          setFormData({ ...formData, total_working_days: clampedValue });
                        }}
                        min="1"
                        max="31"
                        style={{borderRadius: '8px', padding: '10px', border: '1px solid #17a2b8', background: '#ffffff'}}
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Present Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.present_days}
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}}
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Half Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.half_days}
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}}
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Absent Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.absent_days}
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Calculation Section */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="mb-3 fw-bold" style={{ color: '#2c3e50' }}><i className="bi bi-calculator me-2"></i>Final Calculation</h6>
                  <div className="row">
                    {/* PF Percentage input field */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">PF Percentage (%)</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        placeholder="12.00"
                        value={formData.pf_percentage}
                        onChange={(e) => setFormData({ ...formData, pf_percentage: e.target.value })}
                        step="0.01"
                        style={{borderRadius: '8px', padding: '10px', border: '1px solid #dee2e6', background: '#ffffff'}}
                      />
                    </div>

                    {/* PF Amount - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">PF Amount</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.pf_amount}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    {/* Deduction input field */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Deduction</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.deduction}
                          onChange={(e) => setFormData({ ...formData, deduction: e.target.value })}
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#ffffff'}}
                        />
                      </div>
                    </div>

                    {/* Net Salary - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Net Salary</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control fw-bold"
                          value={formData.net_salary}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa', fontSize: '1.1rem'}}
                        />
                      </div>
                    </div>

                    {/* Payment Status dropdown */}
                    <div className="col-md-12 mb-3">
                      <label className="form-label fw-semibold text-secondary">Payment Status</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.payment_status}
                        onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                        style={{borderRadius: '8px', padding: '10px', border: '1px solid #dee2e6', background: '#ffffff'}}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form action buttons */}
              <div className="d-flex justify-content-end gap-3 mt-4">
                {/* Cancel button - navigates back to dashboard */}
                <button
                  type="button"
                  className="btn px-4 py-2 shadow-sm"
                  onClick={() => navigate("/admin-dashboard")}
                  style={{borderRadius: '8px', background: '#2b3d4f', color: 'white', border: 'none'}}
                >
                  <i className="bi bi-x-circle me-2"></i>Cancel
                </button>
                {/* Submit button - creates or updates salary */}
                <button
                  type="submit"
                  className="btn text-white px-4 py-2 shadow"
                  disabled={loading}
                  style={{borderRadius: '8px', background: editingId ? '#9b59b6' : '#3498db'}}
                >
                  <i className="bi bi-check-circle me-2"></i>{loading ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update Salary" : "Create Salary")}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Salary Records Table Card */}
        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-header text-white" style={{background: '#2c3e50', borderRadius: '15px 15px 0 0', border: 'none'}}>
            <h5 className="mb-0"><i className="bi bi-table me-2"></i>Salary Records</h5>
          </div>
          <div className="card-body">
            {/* Show message if no records exist */}
            {salaryRecords.length === 0 ? (
              <p className="text-center text-muted">No salary records found</p>
            ) : (
              <div className="table-responsive">
                {/* Table displaying all salary records */}
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Month/Year</th>
                      <th>Basic</th>
                      <th>HRA</th>
                      <th>Allowance</th>
                      <th>Present</th>
                      <th>Half</th>
                      <th>Absent</th>
                      <th>Deduction</th>
                      <th>Net Salary</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Map through salary records and display each row */}
                    {salaryRecords.map(salary => (
                      <tr key={salary.id}>
                        <td>{salary.user?.username || 'N/A'}</td>
                        {/* Display month name and year */}
                        <td>{MONTHS.find(m => m.value === salary.month)?.label} {years.find(y => y.id === salary.year)?.year}</td>
                        <td>₹{salary.basic_salary}</td>
                        <td>₹{salary.hra}</td>
                        <td>₹{salary.allowance}</td>
                        <td>{salary.present_days}</td>
                        <td>{salary.half_days}</td>
                        <td>{salary.absent_days}</td>
                        <td>₹{salary.deduction}</td>
                        <td><strong>₹{salary.net_salary}</strong></td>
                        {/* Payment status badge - green for paid, yellow for unpaid */}
                        <td>
                          <span className={`badge ${salary.payment_status === 'paid' ? '' : 'bg-warning'}`} style={{ backgroundColor: salary.payment_status === 'paid' ? '#2ecc71' : undefined }}>
                            {salary.payment_status.toUpperCase()}
                          </span>
                        </td>
                        {/* Action buttons for view, edit and delete */}
                        <td>
                        <button
                          className="btn btn-sm shadow-sm me-1"
                          onClick={() => handleView(salary)}
                          style={{ background: '#3498db', color: 'white', border: 'none', borderRadius: '6px' }}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-sm shadow-sm me-1"
                          onClick={() => handleEdit(salary)}
                          style={{ background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px' }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger shadow-sm"
                          onClick={() => handleDelete(salary.id)}
                          style={{ borderRadius: '6px' }}
                        >
                          Delete
                        </button>
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
