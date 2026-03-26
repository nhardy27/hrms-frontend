import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest, fetchAllPages } from "../../../utils/apiUtils";
import { AdminLayout } from '../../components/AdminLayout';

interface Department {
  id: string;
  name: string;
  status: boolean;
}

interface Designation {
  id: string;
  name: string;
  department: string;
  status: boolean;
}

export function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [bankAccountError, setBankAccountError] = useState('');
  const [ifscError, setIfscError] = useState('');
  const [bankNameError, setBankNameError] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<number | null>(null);
  const [employeeRoleId, setEmployeeRoleId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    emp_code: "",
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    contact_no: "",
    department: "",
    designation: "",
    date_of_joining: "",
    is_staff: true,
    is_active: true,
    address: "",
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
    basic_salary: "",
    hra: "",
    allowance: "",
  });

  const generateEmployeeCode = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}?ordering=-id&limit=1`);
      if (response.ok) {
        const data = await response.json();
        const employees = data.results || [];
        
        let maxEmpNum = 0;
        if (employees.length > 0 && employees[0].emp_code) {
          const match = employees[0].emp_code.match(/EMP(\d+)/);
          if (match) maxEmpNum = parseInt(match[1]);
        }
        
        const nextEmpCode = `EMP${String(maxEmpNum + 1).padStart(3, '0')}`;
        setFormData(prev => ({ ...prev, emp_code: nextEmpCode }));
      }
    } catch (error) {
      const fallbackCode = `EMP${String(Date.now()).slice(-3)}`;
      setFormData(prev => ({ ...prev, emp_code: fallbackCode }));
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchEmployeeRole();
    
    const handleDepartmentChange = () => {
      fetchDepartments().then(() => {
        if (isEdit) fetchEmployee();
      });
    };
    
    window.addEventListener('departmentChanged', handleDepartmentChange);
    return () => window.removeEventListener('departmentChanged', handleDepartmentChange);
  }, []);

  useEffect(() => {
    if (isEdit) {
      fetchEmployee();
    } else {
      generateEmployeeCode();
    }
  }, [id]);

  const fetchEmployeeRole = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.role}?name=employee`);
      if (response.ok) {
        const data = await response.json();
        const roles = data.results || data || [];
        const employeeRole = roles.find((role: any) => role.name === 'employee');
        if (employeeRole) {
          setEmployeeRoleId(employeeRole.id);
        }
      }
    } catch (error) {
      // Error fetching employee role
    }
  };

  const fetchDesignationsByDepartment = async (departmentId: string) => {
    if (!departmentId) { setDesignations([]); return; }
    try {
      const all = await fetchAllPages(`${config.api.host}${config.api.designation}`);
      setDesignations(all.filter((d: Designation) => String(d.department) === String(departmentId) && d.status !== false));
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const activeDepts = await fetchAllPages(`${config.api.host}${config.api.department}`);
      setDepartments(activeDepts.filter((d: Department) => d.status));
    } catch (error) {}
  };

  const fetchEmployee = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}${id}/`);
      if (response.ok) {
        const employee: any = await response.json();
        
        setFormData({
          emp_code: employee.emp_code,
          username: employee.username || "",
          email: employee.email,
          password: "",
          first_name: employee.first_name,
          last_name: employee.last_name,
          contact_no: employee.contact_no || "",
          department: employee.department,
          designation: employee.designation,
          date_of_joining: employee.date_of_joining,
          is_staff: employee.is_staff || false,
          is_active: employee.is_active || true,
          address: employee.address || "",
          bank_name: employee.bank_name || "",
          bank_account_number: employee.bank_account_number || "",
          ifsc_code: employee.ifsc_code || "",
          basic_salary: employee.basic_salary || "",
          hra: employee.hra || "",
          allowance: employee.allowance || "",
        });
        if (employee.department) fetchDesignationsByDepartment(employee.department);
      }
    } catch (error) {
      // Error fetching employee
    }
  };

  const checkUsernameExists = async (username: string) => {
    if (!username || (isEdit && username === formData.username)) return;
    
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}?username=${username}`);
      if (response.ok) {
        const data = await response.json();
        const users = data.results || [];
        const existingUser = users.find((user: any) => user.username === username && (!isEdit || user.id !== id));
        
        setUsernameError(existingUser ? 'Username already exists' : '');
      }
    } catch (error) {
      // Error checking username
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, username: value }));
    setUsernameError('');
    
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    if (value.trim() && value.length >= 3) {
      const timer = setTimeout(() => checkUsernameExists(value), 500);
      setDebounceTimer(timer);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const phoneRegex = /^[0-9]{10}$/;
    
    setFormData(prev => ({ ...prev, contact_no: value }));
    
    if (value && !phoneRegex.test(value)) {
      setPhoneError('Phone number must be exactly 10 digits');
    } else {
      setPhoneError('');
    }
  };

  const handleBankAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, bank_account_number: value }));
    if (value && !/^[0-9]{9,18}$/.test(value)) {
      setBankAccountError('Account number must be 9–18 digits');
    } else {
      setBankAccountError('');
    }
  };

  const handleIfscChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, ifsc_code: value }));
    if (value && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)) {
      setIfscError('Invalid IFSC (e.g. SBIN0001234)');
    } else {
      setIfscError('');
    }
  };

  const handleBankNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, bank_name: value }));
    if (value && !/^[a-zA-Z ]{2,}$/.test(value)) {
      setBankNameError('Bank name must contain only letters');
    } else {
      setBankNameError('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name === 'department') {
      setFormData((prev) => ({ ...prev, department: value, designation: '' }));
      fetchDesignationsByDepartment(value);
      return;
    }
    if (name === 'basic_salary') {
      const basicSalary = parseFloat(value) || 0;
      const hra = Math.round(basicSalary * 0.4); // 40% of basic salary
      const allowance = Math.round(basicSalary * 0.15); // 15% of basic salary
      
      setFormData((prev) => ({
        ...prev,
        basic_salary: value,
        hra: hra.toString(),
        allowance: allowance.toString()
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (usernameError) {
      toast.error('Please fix the username error before submitting');
      return;
    }
    if (phoneError) {
      toast.error('Please fix the phone number error before submitting');
      return;
    }
    if (bankAccountError) {
      toast.error('Please fix the bank account number error before submitting');
      return;
    }
    if (ifscError) {
      toast.error('Please fix the IFSC code error before submitting');
      return;
    }
    if (bankNameError) {
      toast.error('Please fix the bank name error before submitting');
      return;
    }
    
    setLoading(true);

    try {
      let submitData: any = { ...formData };
      if (!isEdit) {
        const empCode = `EMP${formData.first_name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-4)}`;
        submitData = { ...formData, emp_code: empCode, role: employeeRoleId, groups: employeeRoleId ? [employeeRoleId] : [] };
      } else {
        submitData = { ...formData, groups: employeeRoleId ? [employeeRoleId] : [] };
      }

      const url = isEdit 
        ? `${config.api.host}${config.api.user}${id}/`
        : `${config.api.host}${config.api.user}`;
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await makeAuthenticatedRequest(url, {
        method,
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const employeeData = await response.json();
        toast.success(isEdit ? 'Employee updated successfully!' : 'Employee created successfully!');
        
        // Send offer letter email after creating employee
        if (!isEdit && employeeData.id) {
          try {
            const deptName = departments.find(d => d.id === employeeData.department)?.name || '';
            
            const offerLetterData = {
              candidate_contact: employeeData.contact_no,
              designation: employeeData.designation,
              department: deptName,
              joining_date: employeeData.date_of_joining,
              basic_salary: employeeData.basic_salary,
              hra: employeeData.hra,
              allowance: employeeData.allowance,
              offer_date: new Date().toISOString().split('T')[0],
              
            };
            
            const emailResponse = await makeAuthenticatedRequest(
              `${config.api.host}${config.api.user}${employeeData.id}/send_offer_letter/`,
              {
                method: 'POST',
                body: JSON.stringify(offerLetterData)
              }
            );
            
            if (emailResponse.ok) {
              toast.success("Offer letter sent to employee");
            } else {
              toast.error("Employee created but failed to send offer letter");
            }
          } catch (emailError) {
            toast.error("Employee created but failed to send offer letter");
          }
        }
        
        navigate("/employees");
      } else {
        const errorData = await response.json();
        
        if (errorData.username) {
          toast.error(`Username error: ${errorData.username[0]}`);
        } else if (errorData.email) {
          toast.error(`Email error: ${errorData.email[0]}`);
        } else if (errorData.non_field_errors) {
          toast.error(errorData.non_field_errors[0]);
        } else {
          toast.error('Failed to save employee. Please check all fields.');
        }
      }
    } catch (error) {
      toast.error('Error saving employee. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/employees");
  };

  return (
    <AdminLayout title={isEdit ? "Edit Employee" : "Add Employee"}>
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: '#ffffff' }}>
          <div className="card-body p-4">
            <h4 className="mb-0" style={{ color: '#2c3e50' }}><i className="bi bi-person-plus-fill me-2"></i>{isEdit ? "Edit Employee" : "Add Employee"}</h4>
          </div>
        </div>

      <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* <div className="col-md-6">
                <label htmlFor="emp_code" className="form-label">
                  Employee Code
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="emp_code"
                  name="emp_code"
                  value={formData.emp_code}
                  readOnly
                  style={{ backgroundColor: '#f8f9fa' }}
                />
              </div> */}

              <div className="col-md-6">
                <label htmlFor="username" className="form-label">
                  Username <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control ${usernameError ? 'is-invalid' : ''}`}
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleUsernameChange}
                  required
                />
                {usernameError && <div className="invalid-feedback">{usernameError}</div>}
              </div>

              <div className="col-md-6">
                <label htmlFor="email" className="form-label">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="col-md-6">
                <label htmlFor="password" className="form-label">
                  Password <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!isEdit}
                  placeholder={isEdit ? "Leave blank to keep current password" : ""}
                />
              </div>

              <div className="col-md-6">
                <label htmlFor="first_name" className="form-label">
                  First Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="col-md-6">
                <label htmlFor="last_name" className="form-label">
                  Last Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="col-md-6">
                <label htmlFor="contact_no" className="form-label">
                  Contact Number <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  className={`form-control ${phoneError ? 'is-invalid' : ''}`}
                  id="contact_no"
                  name="contact_no"
                  value={formData.contact_no}
                  onChange={handlePhoneChange}
                  pattern="[0-9]{10}"
                  maxLength={10}
                  placeholder="10 digit phone number"
                  required
                />
                {phoneError && <div className="invalid-feedback">{phoneError}</div>}
              </div>

              <div className="col-md-6">
                <label htmlFor="department" className="form-label">
                  Department <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.length === 0 ? (
                    <option disabled>Loading departments...</option>
                  ) : (
                    departments.filter(dept => dept.status).map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="col-md-6">
                <label htmlFor="designation" className="form-label">
                  Designation <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select"
                  id="designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  required
                  disabled={!formData.department}
                >
                  <option value="">{formData.department ? 'Select Designation' : 'Select Department first'}</option>
                  {designations.map((desig) => (
                    <option key={desig.id} value={desig.id}>{desig.name}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label htmlFor="date_of_joining" className="form-label">
                  Date of Joining <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  id="date_of_joining"
                  name="date_of_joining"
                  value={formData.date_of_joining}
                  onChange={handleChange}
                  required
                />
              </div>

              {isEdit && (
                <div className="col-md-6">
                  <label htmlFor="is_active" className="form-label">
                    Status <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    id="is_active"
                    name="is_active"
                    value={formData.is_active?.toString() || 'true'}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                    required
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              )}

              <div className="col-md-6">
                <label htmlFor="is_staff" className="form-label">
                  Staff Member
                </label>
                <select
                  className="form-select"
                  id="is_staff"
                  name="is_staff"
                  value={formData.is_staff?.toString() || 'false'}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_staff: e.target.value === 'true' }))}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div className="col-md-12">
                <label htmlFor="address" className="form-label">
                  Address
                </label>
                <textarea
                  className="form-control"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Enter full address"
                />
              </div>

              <div className="col-md-4">
                <label htmlFor="bank_name" className="form-label">Bank Name</label>
                <input
                  type="text"
                  className={`form-control ${bankNameError ? 'is-invalid' : ''}`}
                  id="bank_name"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleBankNameChange}
                  placeholder="e.g. State Bank of India"
                />
                {bankNameError && <div className="invalid-feedback">{bankNameError}</div>}
              </div>

              <div className="col-md-4">
                <label htmlFor="bank_account_number" className="form-label">Bank Account Number</label>
                <input
                  type="text"
                  className={`form-control ${bankAccountError ? 'is-invalid' : ''}`}
                  id="bank_account_number"
                  name="bank_account_number"
                  value={formData.bank_account_number}
                  onChange={handleBankAccountChange}
                  placeholder="9–18 digit account number"
                  maxLength={18}
                />
                {bankAccountError && <div className="invalid-feedback">{bankAccountError}</div>}
              </div>

              <div className="col-md-4">
                <label htmlFor="ifsc_code" className="form-label">IFSC Code</label>
                <input
                  type="text"
                  className={`form-control ${ifscError ? 'is-invalid' : ''}`}
                  id="ifsc_code"
                  name="ifsc_code"
                  value={formData.ifsc_code}
                  onChange={handleIfscChange}
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                />
                {ifscError && <div className="invalid-feedback">{ifscError}</div>}
              </div>

              <div className="col-md-4">
                <label htmlFor="basic_salary" className="form-label">
                  Basic Salary <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="basic_salary"
                  name="basic_salary"
                  value={formData.basic_salary}
                  onChange={handleChange}
                  placeholder="Enter basic salary"
                  required
                />
              </div>

              <div className="col-md-4">
                <label htmlFor="hra" className="form-label">
                  HRA (40%)
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="hra"
                  name="hra"
                  value={formData.hra}
                  readOnly
                  style={{ backgroundColor: '#f8f9fa' }}
                  placeholder="Auto-calculated"
                />
              </div>

              <div className="col-md-4">
                <label htmlFor="allowance" className="form-label">
                  Allowance (15%)
                </label>
                <input
                  type="number"
                  className="form-control"
                  id="allowance"
                  name="allowance"
                  value={formData.allowance}
                  readOnly
                  style={{ backgroundColor: '#f8f9fa' }}
                  placeholder="Auto-calculated"
                />
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn px-4 shadow" disabled={loading} style={{ background: '#2c3e50', color: 'white', borderRadius: '8px', border: 'none' }}>
                <i className="bi bi-check-circle me-2"></i>
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn px-4 shadow" onClick={handleCancel} style={{ background: '#2c3e50', color: 'white', borderRadius: '8px', border: 'none' }}>
                <i className="bi bi-x-circle me-2"></i>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </AdminLayout>
  );
}
