import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
import { AdminLayout } from '../../components/AdminLayout';

interface Employee {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  emp_code?: string;
}

interface Year {
  id: string;
  year: number;
}

interface Attendance {
  id: string;
  user: number;
  date: string;
  total_hours?: string;
}

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
  net_salary: string;
  payment_status: string;
}

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
  net_salary: string;
  payment_status: string;
}

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
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<SalaryForm>({
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
    net_salary: '0',
    payment_status: 'unpaid'
  });

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/admin-dashboard');
      return;
    }
    
    const userData = JSON.parse(user);
    if (!(userData.is_superuser === true || (userData.is_staff === true && userData.username === 'admin'))) {
      toast.error('Access denied. Only admin users can access this page.');
      navigate('/employee-dashboard');
      return;
    }
    
    fetchEmployees();
    fetchYears();
    setTimeout(() => fetchSalaries(), 100);
  }, []);

  useEffect(() => {
    if (formData.user && formData.year && formData.month && !editingId) {
      fetchAttendanceForMonth();
    }
  }, [formData.user, formData.year, formData.month]);

  useEffect(() => {
    calculateNetSalary();
  }, [formData.basic_salary, formData.hra, formData.allowance, formData.deduction, formData.present_days, formData.half_days, formData.total_working_days]);

  const fetchSalaries = async () => {
    try {
      console.log('Fetching salaries from:', `${config.api.host}${config.api.salary}`);
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.salary}`);
      console.log('Salary response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Salary data:', data);
        const records = (data.results || []).map((record: any) => {
          if (typeof record.user === 'number') {
            const emp = employees.find(e => e.id === record.user);
            return {
              ...record,
              user: emp ? { id: emp.id, username: emp.username, email: emp.email } : null
            };
          }
          return record;
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

  const fetchEmployees = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}`);
      if (response.ok) {
        const data = await response.json();
        const emps = data.results.filter((emp: any) => emp.is_active && emp.username !== 'admin');
        setEmployees(emps);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast.error("Failed to fetch employees");
    }
  };

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

  const fetchAttendanceForMonth = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.attendance}`);
      if (response.ok) {
        const data = await response.json();
        const selectedYear = years.find(y => y.id === formData.year)?.year;
        
        const monthRecords = data.results.filter((att: Attendance) => {
          const attDate = new Date(att.date);
          return att.user === parseInt(formData.user) && 
                 attDate.getFullYear() === selectedYear &&
                 attDate.getMonth() + 1 === formData.month;
        });
        
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
        
        setFormData(prev => ({
          ...prev,
          present_days: presentDays,
          half_days: halfDays,
          absent_days: absentDays,
          attendance: monthRecords[0]?.id || ''
        }));
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const calculateNetSalary = () => {
    const basic = parseFloat(formData.basic_salary) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const allowance = parseFloat(formData.allowance) || 0;
    const deduction = parseFloat(formData.deduction) || 0;
    
    const totalSalary = basic + hra + allowance;
    const perDaySalary = totalSalary / formData.total_working_days;
    const earnedSalary = (formData.present_days * perDaySalary) + (formData.half_days * perDaySalary * 0.5);
    const netSalary = earnedSalary - deduction;
    
    setFormData(prev => ({ ...prev, net_salary: netSalary.toFixed(2) }));
  };

  const handleEdit = (salary: SalaryRecord) => {
    setEditingId(salary.id);
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
      net_salary: salary.net_salary,
      payment_status: salary.payment_status
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this salary record?')) return;
    
    try {
      const response = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.salary}${id}/`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        toast.success("Salary deleted successfully");
        fetchSalaries();
      } else {
        toast.error("Failed to delete salary");
      }
    } catch (error) {
      console.error("Error deleting salary:", error);
      toast.error("Failed to delete salary");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user || !formData.year) {
      toast.error("Please select employee and year");
      return;
    }
    
    if (!formData.basic_salary || !formData.hra || !formData.allowance) {
      toast.error("Please fill salary details");
      return;
    }
    
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
        net_salary: parseFloat(formData.net_salary).toFixed(2),
        payment_status: formData.payment_status
      };
      
      if (formData.attendance) {
        payload.attendance = formData.attendance;
      }
      
      console.log('Submitting payload:', payload);
      console.log('URL:', editingId ? `${config.api.host}${config.api.salary}${editingId}/` : `${config.api.host}${config.api.salary}`);
      
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
        toast.success(editingId ? "Salary updated successfully" : "Salary created successfully");
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
          net_salary: '0',
          payment_status: 'unpaid'
        });
        fetchSalaries();
      } else {
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
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px' }}>
          <div className="card-header text-white d-flex justify-content-between align-items-center" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '15px 15px 0 0', border: 'none'}}>
            <h5 className="mb-0"><i className="bi bi-cash-stack me-2"></i>{editingId ? 'Edit' : 'Create'} Employee Salary</h5>
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
                  <h6 className="text-primary mb-3 fw-bold"><i className="bi bi-person-badge me-2"></i>Employee & Period Details</h6>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold text-secondary"><i className="bi bi-person me-1"></i>Employee *</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.user}
                        onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                        required
                        style={{borderRadius: '8px', padding: '10px'}}
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
                        style={{borderRadius: '8px', padding: '10px'}}
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
                        style={{borderRadius: '8px', padding: '10px'}}
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

              {/* Salary Components */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="text-success mb-3 fw-bold"><i className="bi bi-currency-rupee me-2"></i>Salary Components</h6>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Basic Salary *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text bg-success text-white" style={{borderRadius: '8px 0 0 8px'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.basic_salary}
                          onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                          required
                          style={{borderRadius: '0 8px 8px 0', padding: '10px'}}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">HRA *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text bg-success text-white" style={{borderRadius: '8px 0 0 8px'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.hra}
                          onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                          required
                          style={{borderRadius: '0 8px 8px 0', padding: '10px'}}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Allowance *</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text bg-success text-white" style={{borderRadius: '8px 0 0 8px'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.allowance}
                          onChange={(e) => setFormData({ ...formData, allowance: e.target.value })}
                          required
                          style={{borderRadius: '0 8px 8px 0', padding: '10px'}}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Details */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="text-info mb-3 fw-bold"><i className="bi bi-calendar-check me-2"></i>Attendance Details</h6>
                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Total Working Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.total_working_days}
                        onChange={(e) => setFormData({ ...formData, total_working_days: parseInt(e.target.value) })}
                        style={{borderRadius: '8px', padding: '10px'}}
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Present Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.present_days}
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#e8f5e9'}}
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Half Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.half_days}
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#fff3e0'}}
                      />
                    </div>

                    <div className="col-md-3 mb-3">
                      <label className="form-label fw-semibold text-secondary">Absent Days</label>
                      <input
                        type="number"
                        className="form-control shadow-sm"
                        value={formData.absent_days}
                        readOnly
                        style={{borderRadius: '8px', padding: '10px', background: '#ffebee'}}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Final Calculation */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h6 className="text-warning mb-3 fw-bold"><i className="bi bi-calculator me-2"></i>Final Calculation</h6>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Deduction</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text bg-danger text-white" style={{borderRadius: '8px 0 0 8px'}}>₹</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={formData.deduction}
                          onChange={(e) => setFormData({ ...formData, deduction: e.target.value })}
                          style={{borderRadius: '0 8px 8px 0', padding: '10px'}}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Net Salary</label>
                      <div className="input-group shadow-sm">
                        <span className="input-group-text text-white" style={{borderRadius: '8px 0 0 8px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>₹</span>
                        <input
                          type="number"
                          className="form-control fw-bold"
                          value={formData.net_salary}
                          readOnly
                          style={{borderRadius: '0 8px 8px 0', padding: '10px', background: '#f3e5f5', fontSize: '1.1rem'}}
                        />
                      </div>
                    </div>

                    <div className="col-md-4 mb-3">
                      <label className="form-label fw-semibold text-secondary">Payment Status</label>
                      <select
                        className="form-select shadow-sm"
                        value={formData.payment_status}
                        onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                        style={{borderRadius: '8px', padding: '10px'}}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-3 mt-4">
                <button
                  type="button"
                  className="btn btn-secondary px-4 py-2 shadow-sm"
                  onClick={() => navigate("/admin-dashboard")}
                  style={{borderRadius: '8px'}}
                >
                  <i className="bi bi-x-circle me-2"></i>Cancel
                </button>
                <button
                  type="submit"
                  className="btn text-white px-4 py-2 shadow"
                  disabled={loading}
                  style={{borderRadius: '8px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}
                >
                  <i className="bi bi-check-circle me-2"></i>{loading ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update Salary" : "Create Salary")}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-header text-white" style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '15px 15px 0 0', border: 'none'}}>
            <h5 className="mb-0"><i className="bi bi-table me-2"></i>Salary Records</h5>
          </div>
          <div className="card-body">
            {salaryRecords.length === 0 ? (
              <p className="text-center text-muted">No salary records found</p>
            ) : (
              <div className="table-responsive">
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
                    {salaryRecords.map(salary => (
                      <tr key={salary.id}>
                        <td>{salary.user?.username || 'N/A'}</td>
                        <td>{MONTHS.find(m => m.value === salary.month)?.label} {years.find(y => y.id === salary.year)?.year}</td>
                        <td>₹{salary.basic_salary}</td>
                        <td>₹{salary.hra}</td>
                        <td>₹{salary.allowance}</td>
                        <td>{salary.present_days}</td>
                        <td>{salary.half_days}</td>
                        <td>{salary.absent_days}</td>
                        <td>₹{salary.deduction}</td>
                        <td><strong>₹{salary.net_salary}</strong></td>
                        <td>
                          <span className={`badge ${salary.payment_status === 'paid' ? 'bg-success' : 'bg-warning'}`}>
                            {salary.payment_status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                        <button
                          className="btn btn-sm shadow-sm me-1"
                          onClick={() => handleEdit(salary)}
                          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px' }}
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
