import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { AdminLayout } from '../../components/AdminLayout';

interface Department {
  id: string;
  name: string;
  status: boolean;
}

interface Employee {
  id: string;
  emp_code: string;
  username?: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
  contact_no: string;
  designation: string;
  date_of_joining: string;
  is_active: boolean;
  is_staff: boolean;
}

export function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

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
    is_staff: false,
    is_active: true,
    groups: [1],
  });

  const refreshToken = async () => {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) return null;

    try {
      const response = await fetch(`${config.api.host}${config.api.refreshToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access);
        return data.access;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
    return null;
  };

  const getToken = async () => {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');
    
    if (!username || !password) {
      console.error('No login credentials found. Please login first.');
      // Redirect to login if no credentials
      navigate('/login');
      return null;
    }

    try {
      console.log('Getting new token for user:', username);
      const response = await fetch(`${config.api.host}${config.api.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (response.ok) {
        const data = await response.json();
        console.log('New token received');
        localStorage.setItem('token', data.access);
        if (data.refresh) {
          localStorage.setItem('refreshToken', data.refresh);
        }
        return data.access;
      } else {
        console.error('Failed to get token:', response.status);
        navigate('/login');
      }
    } catch (error) {
      console.error('Error getting token:', error);
      navigate('/login');
    }
    return null;
  };

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    let token = localStorage.getItem('token');
    
    // If no token, try to get a new one
    if (!token) {
      token = await refreshToken() || await getToken();
      if (!token) {
        console.error('Unable to get valid token');
        return new Response(JSON.stringify({error: 'Authentication failed'}), {status: 401});
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    let response = await fetch(url, { ...options, headers });
    
    // If token is invalid, try to refresh and retry once
    if (response.status === 401) {
      console.log('Token expired, attempting refresh...');
      localStorage.removeItem('token'); // Clear invalid token
      
      token = await refreshToken() || await getToken();
      if (token) {
        console.log('Got new token, retrying request...');
        response = await fetch(url, {
          ...options,
          headers: { ...headers, 'Authorization': `Bearer ${token}` }
        });
      } else {
        console.error('Failed to refresh token');
      }
    }
    
    return response;
  };

  const generateEmployeeCode = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}`);
      if (response.ok) {
        const data = await response.json();
        const employees = data.results || [];
        
        // Find highest employee code number
        let maxEmpNum = 0;
        employees.forEach((emp: any) => {
          if (emp.emp_code) {
            const match = emp.emp_code.match(/EMP(\d+)/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxEmpNum) {
                maxEmpNum = num;
              }
            }
          }
        });
        
        // Generate next employee code
        const nextEmpCode = `EMP${String(maxEmpNum + 1).padStart(3, '0')}`;
        setFormData(prev => ({ ...prev, emp_code: nextEmpCode }));
      }
    } catch (error) {
      console.error('Error generating employee code:', error);
      // Fallback to timestamp-based code
      const fallbackCode = `EMP${String(Date.now()).slice(-3)}`;
      setFormData(prev => ({ ...prev, emp_code: fallbackCode }));
    }
  };

  useEffect(() => {
    fetchDepartments();
    if (isEdit) {
      fetchEmployee();
    } else {
      generateEmployeeCode();
    }
  }, [id]);

  const fetchDepartments = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.department}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Departments data:', data); // Debug log
        setDepartments(data.results || data || []);
      } else {
        console.error('Failed to fetch departments:', response.status);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchEmployee = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}${id}/`);
      if (response.ok) {
        const employee: Employee = await response.json();
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
          groups: [1],
        });
      }
    } catch (error) {
      console.error('Error fetching employee:', error);
    }
  };

  const checkUsernameExists = async (username: string) => {
    if (!username || (isEdit && username === formData.username)) return;
    
    try {
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}`);
      if (response.ok) {
        const data = await response.json();
        const users = data.results || [];
        const existingUser = users.find((user: any) => user.username === username && (!isEdit || user.id !== id));
        
        if (existingUser) {
          setUsernameError('Username already exists');
        } else {
          setUsernameError('');
        }
      }
    } catch (error) {
      console.error('Error checking username:', error);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, username: value }));
    setUsernameError('');
    
    if (value.trim()) {
      setTimeout(() => checkUsernameExists(value), 500);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
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
    
    setLoading(true);

    try {
      // Generate employee code if not editing
      let submitData = { ...formData };
      if (!isEdit) {
        // Generate emp_code based on first name and timestamp
        const empCode = `EMP${formData.first_name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-4)}`;
        submitData = { ...formData, emp_code: empCode };
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
        toast.success(isEdit ? 'Employee updated successfully!' : 'Employee created successfully!');
        // Force refresh of employee list by clearing any cached data
        localStorage.removeItem('employeeListCache');
        navigate("/employees");
      } else {
        const errorData = await response.json();
        console.error('Error saving employee:', errorData);
        console.error('Response status:', response.status);
        console.error('Submit data:', submitData);
        
        // Show specific error messages if available
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
      console.error('Error saving employee:', error);
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
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="card-body p-4 text-white">
            <h4 className="mb-0"><i className="bi bi-person-plus-fill me-2"></i>{isEdit ? "Edit Employee" : "Add Employee"}</h4>
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
                <input
                  type="text"
                  className="form-control"
                  id="designation"
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  required
                />
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
            </div>

            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn text-white px-4 shadow" disabled={loading} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '8px', border: 'none' }}>
                <i className="bi bi-check-circle me-2"></i>
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary px-4 shadow" onClick={handleCancel} style={{ borderRadius: '8px' }}>
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
