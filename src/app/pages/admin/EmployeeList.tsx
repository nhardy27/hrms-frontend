import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import config from '../../../config/global.json';
import { fetchAllPages, makeAuthenticatedRequest } from '../../../utils/apiUtils';
import { AdminLayout } from '../../components/AdminLayout';

interface Employee {
  id: string;
  emp_code: string;
  first_name: string;
  last_name: string;
  department: string;
  department_name?: string;
  email: string;
  phone: string;
  designation: string;
  date_of_joining: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  username?: string;
  is_superuser?: boolean;
}

interface Department {
  id: string;
  name: string;
  status: boolean;
}

export function EmployeeList() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
    
    // Listen for focus events to refresh data when returning from other pages
    const handleFocus = () => {
      fetchEmployees();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (departments.length > 0) {
      fetchEmployees();
    }
  }, [currentPage, departments]);

  const fetchDepartments = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.department}`
      );
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.results || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      console.log('Fetching all employees...');
      const allEmployees = await fetchAllPages(`${config.api.host}${config.api.user}`);
      
      console.log('All employees from all pages:', allEmployees.length);
      
      // Filter out superusers and admin users
      const regularEmployees = allEmployees.filter((emp: Employee) => 
        !emp.is_superuser && emp.username !== 'admin'
      );
      
      // Map department names to employees
      const employeesWithDepartments = regularEmployees.map((emp: Employee) => {
        const department = departments.find(dept => dept.id.toString() === emp.department.toString());
        return {
          ...emp,
          department_name: department ? department.name : 'N/A'
        };
      });
      
      // Sort by ID in descending order (latest first)
      employeesWithDepartments.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      
      console.log('Final employees with departments:', employeesWithDepartments);
      setEmployees(employeesWithDepartments);
      setTotalPages(Math.ceil(employeesWithDepartments.length / itemsPerPage));
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Error loading employees');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      try {
        const response = await makeAuthenticatedRequest(
          `${config.api.host}${config.api.user}${id}/`,
          { method: 'DELETE' }
        );
        if (response.ok) {
          toast.success('Employee deleted successfully!');
          fetchEmployees();
        } else {
          toast.error('Failed to delete employee');
        }
      } catch (error) {
        console.error('Error deleting employee:', error);
        toast.error('Error deleting employee');
      }
    }
  };

  return (
    <AdminLayout title="Employee Management">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center text-white">
              <div>
                <h4 className="mb-1"><i className="bi bi-people-fill me-2"></i>Employees</h4>
                <small className="opacity-75">
                  Total: {employees.length} employees | 
                  Showing: {Math.min((currentPage - 1) * itemsPerPage + 1, employees.length)}-{Math.min(currentPage * itemsPerPage, employees.length)} of {employees.length}
                </small>
              </div>
              <Link to="/employees/add" className="btn text-white px-4 shadow" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', border: 'none' }}>
                <i className="bi bi-plus-circle me-2"></i>
                Add Employee
              </Link>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center">Loading...</td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center">No employees found</td>
                    </tr>
                  ) : (
                    employees
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((employee) => (
                      <tr key={employee.id}>
                        <td><strong>{employee.id}</strong></td>
                        <td>{employee.emp_code || `EMP${employee.id.toString().padStart(3, '0')}`}</td>
                        <td>{`${employee.first_name} ${employee.last_name}`}</td>
                        <td>{employee.email}</td>
                        <td>{employee.department_name || 'N/A'}</td>
                        <td>
                          <span className={`badge bg-${employee.is_active ? 'success' : 'secondary'}`}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <Link 
                            to={`/employees/edit/${employee.id}`} 
                            className="btn btn-sm shadow-sm me-2"
                            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px' }}
                          >
                            <i className="bi bi-pencil"></i> Edit
                          </Link>
                          <button 
                            className="btn btn-sm btn-outline-danger shadow-sm"
                            onClick={() => handleDelete(employee.id)}
                            style={{ borderRadius: '6px' }}
                          >
                            <i className="bi bi-trash"></i> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <nav className="mt-3">
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(page)}>
                      {page}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                  <button 
                    className="page-link" 
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </button>
                </li>
              </ul>
              <div className="mt-2 text-muted small">
                Page {currentPage} of {totalPages} (Total: {employees.length} employees)
              </div>
            </nav>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}