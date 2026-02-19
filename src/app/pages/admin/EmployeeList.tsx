import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import config from '../../../config/global.json';
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
import { AdminLayout } from '../../components/AdminLayout';
import { LoadingAnimation } from '../../components/LoadingAnimation';

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
  address?: string;
  bank_name?: string;
  bank_account_number?: string;
  ifsc_code?: string;
}

interface Department {
  id: string;
  name: string;
  status: boolean;
}

export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    const initializeData = async () => {
      await fetchDepartments();
    };
    initializeData();
    
    const handleFocus = async () => {
      await fetchDepartments();
      await fetchEmployees();
    };
    
    const handleDepartmentChange = async () => {
      await fetchDepartments();
      await fetchEmployees();
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('departmentChanged', handleDepartmentChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('departmentChanged', handleDepartmentChange);
    };
  }, []);

  useEffect(() => {
    if (departments.length > 0 && allEmployees.length === 0) {
      fetchEmployees();
    }
  }, [departments]);

  useEffect(() => {
    setCurrentPage(1);
    filterEmployees();
  }, [searchTerm, allEmployees]);

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
          }
  };

  const filterEmployees = () => {
    let filtered = allEmployees;
    
    if (searchTerm) {
      filtered = allEmployees.filter(emp => 
        emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.emp_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setEmployees(filtered);
    setTotalCount(filtered.length);
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let allData: Employee[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const url = `${config.api.host}${config.api.user}?page=${page}`;
        const response = await makeAuthenticatedRequest(url);
        
        if (response.ok) {
          const data = await response.json();
          const pageEmployees = data.results || [];
          
          const regularEmployees = pageEmployees.filter((emp: Employee) => 
            !emp.is_superuser && emp.username !== 'admin'
          );
          
          const employeesWithDepartments = regularEmployees.map((emp: Employee) => {
            if (emp.department) {
              const department = departments.find(dept => dept.id.toString() === emp.department.toString());
              return {
                ...emp,
                department_name: department ? department.name : 'N/A'
              };
            }
            return {
              ...emp,
              department_name: 'N/A'
            };
          });
          
          allData = [...allData, ...employeesWithDepartments];
          hasMore = !!data.next;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      setAllEmployees(allData);
      setEmployees(allData);
      setTotalCount(allData.length);
      setTotalPages(Math.ceil(allData.length / itemsPerPage));
    } catch (error) {
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
                toast.error('Error deleting employee');
      }
    }
  };

  return (
    <AdminLayout title="Employee Management">
      {loading && <LoadingAnimation />}
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: '#ffffff' }}>
          <div className="card-body p-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h4 className="mb-1" style={{ color: '#2c3e50' }}>
                  <i className="bi bi-people-fill me-2"></i>Employees
                </h4>
                <small className="text-muted">
                  Total: <strong>{totalCount}</strong> employees | 
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </small>
              </div>
              <div className="d-flex gap-2">
                <div className="input-group" style={{ width: '300px' }}>
                  <span className="input-group-text" style={{ background: '#f8f9fa', border: '1px solid #dee2e6' }}>
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by name, email, code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ border: '1px solid #dee2e6' }}
                  />
                </div>
                <Link 
                  to="/employees/add" 
                  className="btn btn-primary px-4 shadow-sm d-flex align-items-center gap-2"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <i className="bi bi-plus-circle"></i>
                  <span>Add Employee</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-body">
            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="table table-hover align-middle" style={{ minWidth: '1400px' }}>
                <thead>
                  <tr>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>ID</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Employee Code</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Name</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Email</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Department</th>
                    <th style={{ verticalAlign: 'middle', minWidth: '150px', whiteSpace: 'nowrap' }}>Address</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Bank Name</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Account Number</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>IFSC Code</th>
                    <th style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ verticalAlign: 'middle', minWidth: '180px', whiteSpace: 'nowrap' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((employee) => (
                      <tr key={employee.id}>
                        <td style={{ verticalAlign: 'middle' }}><strong>{employee.id}</strong></td>
                        <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{employee.emp_code || `EMP${employee.id.toString().padStart(3, '0')}`}</td>
                        <td style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{`${employee.first_name} ${employee.last_name}`}</td>
                        <td style={{ verticalAlign: 'middle' }}>{employee.email}</td>
                        <td style={{ verticalAlign: 'middle' }}>{employee.department_name || 'N/A'}</td>
                        <td style={{ verticalAlign: 'middle', whiteSpace: 'pre-wrap', maxWidth: '200px' }}>
                          {employee.address ? (
                            <small style={{ fontSize: '0.85em', lineHeight: '1.4' }}>
                              {employee.address}
                            </small>
                          ) : 'N/A'}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>{employee.bank_name || 'N/A'}</td>
                        <td style={{ verticalAlign: 'middle' }}>{employee.bank_account_number || 'N/A'}</td>
                        <td style={{ verticalAlign: 'middle' }}>{employee.ifsc_code || 'N/A'}</td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span className={`badge ${employee.is_active ? '' : 'bg-secondary'}`} style={{ backgroundColor: employee.is_active ? '#2ecc71' : undefined }}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div className="d-flex gap-1">
                            <Link 
                              to={`/employees/edit/${employee.id}`} 
                              className="btn btn-sm shadow-sm"
                              style={{ background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px' }}
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
                          </div>
                        </td>
                      </tr>
                    ))}
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
                Page {currentPage} of {totalPages} (Total: {totalCount} employees)
              </div>
            </nav>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}