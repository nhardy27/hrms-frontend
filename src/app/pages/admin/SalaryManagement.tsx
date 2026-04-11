// React hooks for state and lifecycle management
import { useState, useEffect } from "react";
import React from "react";
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
  basic_salary?: number;
  hra?: number;
  allowance?: number;
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
  gross_salary: string;
  per_day_salary: string;
  unpaid_leave_deduction: string;
  earned_salary: string;
  pf_percentage: string;
  pf_amount: string;
  deduction: string;
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
  gross_salary: string;
  per_day_salary: string;
  unpaid_leave_deduction: string;
  earned_salary: string;
  pf_percentage: string;
  pf_amount: string;
  deduction: string;
  net_salary: string;
  payment_status: string;
}

// working days per month
const WORKING_DAYS: Record<number, number> = {
  1: 22, 2: 18, 3: 22, 4: 20, 5: 20, 6: 21,
  7: 21, 8: 20, 9: 20, 10: 21, 11: 20, 12: 21
};

const EMPTY_FORM = (): SalaryForm => ({
  user: '',
  year: '',
  month: new Date().getMonth() + 1,
  attendance: '',
  basic_salary: '',
  hra: '',
  allowance: '',
  total_working_days: WORKING_DAYS[new Date().getMonth() + 1],
  present_days: 0,
  absent_days: 0,
  half_days: 0,
  gross_salary: '0',
  per_day_salary: '0',
  unpaid_leave_deduction: '0',
  earned_salary: '0',
  pf_percentage: '12.00',
  pf_amount: '0',
  deduction: '0',
  net_salary: '0',
  payment_status: 'unpaid'
});

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
  // Ref to skip salary recalc useEffect when loading edit data
  const skipCalcRef = React.useRef(false);

  const [formData, setFormData] = useState<SalaryForm>(EMPTY_FORM());

  // Effect runs on component mount - checks authentication and loads initial data
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/login');
      return;
    }
    
    const userData = JSON.parse(user);
    // Check if user has admin privileges
    if (!(userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin'))) {
      toast.error('Access denied. Only admin users can access this page.');
      navigate('/employee-dashboard');
      return;
    }
    
    // Load initial data sequentially so fetchSalaries has employees available
    Promise.all([fetchEmployees(), fetchYears()]).then(([emps, yrs]) => {
      fetchSalaries(emps ?? [], yrs ?? []);
    });
  }, []);

  // Effect runs when user, year, or month changes - fetches attendance data
  // employees added as dependency so attendance fetch waits until employees are loaded
  useEffect(() => {
    if (formData.user && formData.year && formData.month && !editingId && employees.length > 0) {
      fetchAttendanceForMonth();
      fetchEmployeeSalary();
    }
  }, [formData.user, formData.year, formData.month, employees]);

  // Effect runs when salary components change - recalculates net salary
  useEffect(() => {
    if (skipCalcRef.current) return;
    // FIX: parse all inputs once into stable numbers — prevents dep array churn
    const basic       = parseFloat(formData.basic_salary) || 0;
    const hra         = parseFloat(formData.hra)          || 0;
    const allowance   = parseFloat(formData.allowance)    || 0;
    const pfPct       = parseFloat(formData.pf_percentage)|| 0;
    const workingDays = formData.total_working_days > 0 ? formData.total_working_days : 1;
    const presentDays = formData.present_days;
    const halfDays    = formData.half_days;

    // FIX: helper rounds every intermediate value to 2dp immediately,
    // eliminating floating-point accumulation across chained operations
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const grossSalary  = r2(basic + hra + allowance);
    const perDaySalary = r2(grossSalary / workingDays);

    // FIX: round paidDays to 1dp BEFORE deriving absentDays
    // so absentDays never carries a 0.4999... float artifact
    const paidDays  = r2(presentDays + halfDays * 0.5);
    const absentDays = r2(Math.max(0, workingDays - paidDays));

    // unpaidLeaveDeduction is for display only — it is NOT subtracted again in netSalary
    // earnedSalary already excludes absent days via perDaySalary × paidDays
    const unpaidLeaveDeduction = r2(perDaySalary * absentDays);
    const earnedSalary         = r2(perDaySalary * paidDays);

    // PF on earned salary, capped at ₹15,000
    const pfAmount = r2((Math.min(earnedSalary, 15000) * pfPct) / 100);

    // FIX: totalDeduction = LOP + PF (display field, consistent with both deductions)
    // netSalary = earnedSalary - PF only (LOP already excluded from earnedSalary)
    const totalDeduction = r2(unpaidLeaveDeduction + pfAmount);
    const netSalary      = presentDays === 0 && halfDays === 0
      ? 0
      : r2(Math.max(0, earnedSalary - pfAmount));

    setFormData(prev => ({
      ...prev,
      absent_days:             Math.floor(absentDays),
      gross_salary:            grossSalary.toFixed(2),
      per_day_salary:          perDaySalary.toFixed(2),
      unpaid_leave_deduction:  unpaidLeaveDeduction.toFixed(2),
      earned_salary:           earnedSalary.toFixed(2),
      pf_amount:               pfAmount.toFixed(2),
      deduction:               totalDeduction.toFixed(2),
      net_salary:              netSalary.toFixed(2)
    }));
  }, [formData.basic_salary, formData.hra, formData.allowance, formData.pf_percentage, formData.present_days, formData.half_days, formData.total_working_days]);

  // Function to fetch all salary records from API
  const fetchSalaries = async (empList: Employee[] = employees, yearList: Year[] = years) => {
    try {
      let allRecords: any[] = [];
      let nextUrl = `${config.api.host}${config.api.salary}?page_size=100`;
      
      while (nextUrl) {
        const response = await makeAuthenticatedRequest(nextUrl);
        if (response.ok) {
          const data = await response.json();
          allRecords = [...allRecords, ...(data.results || [])];
          nextUrl = data.next;
        } else {
          break;
        }
      }
      
      const records = allRecords.map((record: any) => {
        if (typeof record.user === 'number') {
          const emp = empList.find(e => e.id === record.user);
          return {
            ...record,
            user: emp ? { id: emp.id, username: emp.username, email: emp.email } : null
          };
        }
        return record;
      }).sort((a: SalaryRecord, b: SalaryRecord) => {
        const yearA = yearList.find(y => y.id === a.year)?.year || 0;
        const yearB = yearList.find(y => y.id === b.year)?.year || 0;
        if (yearB !== yearA) return yearB - yearA;
        return b.month - a.month;
      });
      setSalaryRecords(records);
    } catch (error) {
      toast.error('Error loading salary records');
    }
  };

  // Function to fetch all active employees (excluding admin)
  const fetchEmployees = async (): Promise<Employee[]> => {
    try {
      let allEmployees: Employee[] = [];
      let nextUrl = `${config.api.host}${config.api.user}?is_active=true&page_size=100`;
      
      while (nextUrl) {
        const response = await makeAuthenticatedRequest(nextUrl);
        if (response.ok) {
          const data = await response.json();
          const emps = data.results.filter((emp: any) => emp.username !== 'admin');
          allEmployees = [...allEmployees, ...emps];
          nextUrl = data.next;
        } else {
          break;
        }
      }
      
      setEmployees(allEmployees);
      return allEmployees;
    } catch (error) {
      toast.error("Failed to fetch employees");
      return [];
    }
  };

  // Function to fetch available years from API
  const fetchYears = async (): Promise<Year[]> => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.year}`);
      if (response.ok) {
        const data = await response.json();
        const results: Year[] = data.results;
        setYears(results);
        
        // Set default year to current year
        const currentYear = new Date().getFullYear();
        const matchedYear = results.find((y: Year) => y.year === currentYear) || results[results.length - 1];
        if (matchedYear) {
          setFormData(prev => ({ ...prev, year: matchedYear.id }));
        }
        return results;
      }
      return [];
    } catch (error) {
      toast.error("Failed to fetch years");
      return [];
    }
  };

  // Function to fetch employee salary data from user API
  const fetchEmployeeSalary = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}${formData.user}/`);
      if (response.ok) {
        const userData = await response.json();
        setFormData(prev => ({
          ...prev,
          basic_salary: userData.basic_salary || '',
          hra: userData.hra || '',
          allowance: userData.allowance || ''
        }));
      }
    } catch (error) {
      // Error fetching salary
    }
  };

  // Function to fetch and calculate attendance for selected month
  const fetchAttendanceForMonth = async () => {
    try {
      const selectedEmployee = employees.find(e => e.id === parseInt(formData.user));
      const selectedYear = years.find(y => y.id === formData.year)?.year;
      const selectedMonth = MONTHS.find(m => m.value === formData.month)?.label.toLowerCase();

      if (!selectedEmployee?.emp_code || !selectedYear || !selectedMonth) return;

      let allRecords: Attendance[] = [];
      let nextUrl = `${config.api.host}${config.api.attendance}?emp_code=${selectedEmployee.emp_code}&year=${selectedYear}&month=${selectedMonth}&page_size=100`;

      while (nextUrl) {
        const response = await makeAuthenticatedRequest(nextUrl);
        if (response.ok) {
          const data = await response.json();
          allRecords = [...allRecords, ...(data.results || [])];
          nextUrl = data.next;
        } else {
          break;
        }
      }

      let presentDays = 0;
      let halfDays = 0;

      allRecords.forEach((att: Attendance) => {
        if (att.total_hours) {
          const [hours] = att.total_hours.split(':').map(Number);
          if (hours >= 7) presentDays++;
          else if (hours >= 4) halfDays++;
        }
      });

      setFormData(prev => ({
        ...prev,
        present_days: presentDays,
        half_days: halfDays,
        // absent_days is derived in the salary calculation useEffect from paidDays
        attendance: allRecords[0]?.id || ''
      }));
    } catch (error) {
      toast.error('Failed to fetch attendance');
    }
  };


  // Function to handle viewing salary slip
  const handleView = (salary: SalaryRecord) => {
    navigate(`/salary-slip/${salary.id}`);
  };

  // Function to handle editing an existing salary record
  const handleEdit = async (salary: SalaryRecord) => {
    setEditingId(salary.id);
    const employee = employees.find(emp => emp.id === salary.user?.id);

    // Block recalc useEffect while we load saved values
    skipCalcRef.current = true;
    setFormData({
      user: salary.user?.id.toString() || '',
      year: salary.year,
      month: salary.month,
      attendance: '',
      basic_salary: employee?.basic_salary?.toString() || salary.basic_salary,
      hra: employee?.hra?.toString() || salary.hra,
      allowance: employee?.allowance?.toString() || salary.allowance,
      total_working_days: salary.total_working_days,
      present_days: salary.present_days,
      absent_days: salary.absent_days,
      half_days: salary.half_days,
      gross_salary: salary.gross_salary,
      per_day_salary: salary.per_day_salary,
      unpaid_leave_deduction: salary.unpaid_leave_deduction,
      earned_salary: salary.earned_salary,
      pf_percentage: salary.pf_percentage,
      pf_amount: salary.pf_amount,
      deduction: salary.deduction,
      net_salary: salary.net_salary,
      payment_status: salary.payment_status
    });
    // Re-fetch fresh attendance for this employee/month so edits use live data
    const selectedEmployee = employees.find(e => e.id === salary.user?.id);
    const selectedYear = years.find(y => y.id === salary.year)?.year;
    const selectedMonth = MONTHS.find(m => m.value === salary.month)?.label.toLowerCase();
    if (selectedEmployee?.emp_code && selectedYear && selectedMonth) {
      try {
        let allRecords: Attendance[] = [];
        let nextUrl = `${config.api.host}${config.api.attendance}?emp_code=${selectedEmployee.emp_code}&year=${selectedYear}&month=${selectedMonth}&page_size=100`;
        while (nextUrl) {
          const res = await makeAuthenticatedRequest(nextUrl);
          if (!res.ok) break;
          const data = await res.json();
          allRecords = [...allRecords, ...(data.results || [])];
          nextUrl = data.next;
        }
        let presentDays = 0, halfDays = 0;
        allRecords.forEach((att: Attendance) => {
          if (att.total_hours) {
            const [hours] = att.total_hours.split(':').map(Number);
            if (hours >= 7) presentDays++;
            else if (hours >= 4) halfDays++;
          }
        });
        setFormData(prev => ({ ...prev, present_days: presentDays, half_days: halfDays, attendance: allRecords[0]?.id || '' }));
      } catch {
        toast.error('Failed to refresh attendance for edit');
      }
    }
    // Allow recalc again after state settles
    setTimeout(() => { skipCalcRef.current = false; }, 0);
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
        fetchSalaries(employees, years); // Refresh the list
      } else {
        toast.error("Failed to delete salary");
      }
    } catch (error) {
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
        toast.error("Salary record already exists for this employee in the selected month");
        return;
      }
    }
    
    setLoading(true);
    try {
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
        gross_salary: parseFloat(formData.gross_salary).toFixed(2),
        per_day_salary: parseFloat(formData.per_day_salary).toFixed(2),
        unpaid_leave_deduction: parseFloat(formData.unpaid_leave_deduction).toFixed(2),
        earned_salary: parseFloat(formData.earned_salary).toFixed(2),
        pf_percentage: parseFloat(formData.pf_percentage).toFixed(2),
        pf_amount: parseFloat(formData.pf_amount).toFixed(2),
        deduction: parseFloat(formData.deduction).toFixed(2),
        net_salary: parseFloat(formData.net_salary).toFixed(2),
        payment_status: formData.payment_status
      };
      
      // Add attendance ID if available
      if (formData.attendance) {
        payload.attendance = formData.attendance;
      }
      
      const response = await makeAuthenticatedRequest(
        editingId 
          ? `${config.api.host}${config.api.salary}${editingId}/`
          : `${config.api.host}${config.api.salary}`,
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        }
      );
      
      if (response.ok) {
        const salaryData = await response.json();
        toast.success(editingId ? "Salary updated successfully" : "Salary created successfully");
        
        // Send email after creating or updating salary
        const salaryId = editingId || salaryData.id;
        if (salaryId) {
          try {
            const emailResponse = await makeAuthenticatedRequest(
              `${config.api.host}${config.api.salary}${salaryId}/send_email/`,
              {
                method: 'POST'
              }
            );
            
            if (emailResponse.ok) {
              toast.success("Salary email sent to employee");
            } else {
              toast.error("Salary created but failed to send email");
            }
          } catch (emailError) {
                        toast.error("Salary created but failed to send email");
          }
        }
        
        setEditingId(null);
        setFormData(EMPTY_FORM());
        fetchSalaries(employees, years);
      } else {
        const errorText = await response.text();
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
                onClick={() => { setEditingId(null); setFormData(EMPTY_FORM()); }}
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
                    <div className="col-12 col-md-6 mb-3">
                      <label className="form-label fw-semibold text-secondary"><i className="bi bi-person me-1"></i>Employee *</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.user}
                        onChange={(e) => {
                          const selectedEmp = employees.find(emp => emp.id === parseInt(e.target.value));
                          if (selectedEmp) {
                            setSelectedEmployeeBankInfo({
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
                        {employees.map(emp => {
                          const empSalary = salaryRecords.find(s => s.user?.id === emp.id && s.month === formData.month && s.year === formData.year);
                          const status = empSalary ? (empSalary.payment_status === 'paid' ? ' ✅ Paid' : ' ⚠️ Unpaid') : ' 🔴 Not Created';
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name} - {emp.emp_code || 'N/A'}{status}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="col-12 col-md-3 mb-3">
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

                    <div className="col-12 col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary"><i className="bi bi-calendar-month me-1"></i>Month *</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.month}
                        onChange={(e) => { const m = parseInt(e.target.value); setFormData({ ...formData, month: m, total_working_days: WORKING_DAYS[m] }); }}
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
                      <div className="col-12 col-md-4 mb-3">
                        <label className="form-label fw-semibold text-secondary">Bank Name</label>
                        <input type="text" className="form-control" value={selectedEmployeeBankInfo.bank_name || 'Not Available'} readOnly style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}} />
                      </div>
                      <div className="col-12 col-md-4 mb-3">
                        <label className="form-label fw-semibold text-secondary">Account Number</label>
                        <input type="text" className="form-control" value={selectedEmployeeBankInfo.bank_account_number || 'Not Available'} readOnly style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}} />
                      </div>
                      <div className="col-12 col-md-4 mb-3">
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
                    <div className="col-12 col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Basic Salary *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.basic_salary}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">HRA *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.hra}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    <div className="col-12 col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Allowance *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.allowance}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', border: '1px solid #dee2e6', borderLeft: 'none', background: '#f8f9fa'}}
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
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#f8f9fa'}}
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
                        value={formData.absent_days % 1 === 0 ? formData.absent_days : formData.absent_days.toFixed(1)}
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
                    {/* Gross Salary - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Gross Salary</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.gross_salary}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    {/* Per Day Salary - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Per Day Salary</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.per_day_salary}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    {/* Unpaid Leave Deduction - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Unpaid Leave Deduction</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.unpaid_leave_deduction}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    {/* Earned Salary - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Earned Salary</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.earned_salary}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

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
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.pf_amount}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    {/* Total Deduction - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Total Deduction</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          value={formData.deduction}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f8f9fa'}}
                        />
                      </div>
                    </div>

                    {/* Net Salary - Auto-calculated, read-only */}
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Net Salary</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white d-flex align-items-center" style={{borderRadius: '8px 0 0 8px', background: '#2c3e50'}}>₹</span>
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
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                {/* Table displaying all salary records */}
                <table className="table table-hover" style={{ minWidth: '1400px' }}>
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
                    {salaryRecords.map(salary => {
                      const employee = employees.find(emp => emp.id === salary.user?.id);
                      return (
                      <tr key={salary.id}>
                        <td>{salary.user?.username || 'N/A'}</td>
                        {/* Display month name and year */}
                        <td>{MONTHS.find(m => m.value === salary.month)?.label} {years.find(y => y.id === salary.year)?.year}</td>
                        <td>₹{employee?.basic_salary || salary.basic_salary}</td>
                        <td>₹{employee?.hra || salary.hra}</td>
                        <td>₹{employee?.allowance || salary.allowance}</td>
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
                      );
                    })}
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




