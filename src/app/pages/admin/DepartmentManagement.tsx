import { useState, useEffect } from "react";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest, fetchAllPages } from "../../../utils/apiUtils";
import { AdminLayout } from '../../components/AdminLayout';

interface Department {
  id: string;
  name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    status: true
  });

  const apiUrl = `${config.api.host}${config.api.department}`;

  useEffect(() => {
    fetchDepartments();
    const interval = setInterval(fetchDepartments, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDepartments = async () => {
    try {
      const data = await fetchAllPages(apiUrl);
      setDepartments(data);
    } catch (error) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (editingDepartment) {
        const response = await makeAuthenticatedRequest(`${apiUrl}${editingDepartment.id}/`, {
          method: 'PUT',
          body: JSON.stringify({ name: formData.name, status: formData.status })
        });
        if (response.ok) {
          const updatedDept = await response.json();
          setDepartments(prev => prev.map(dept => 
            dept.id === editingDepartment.id ? updatedDept : dept
          ));
          toast.success('Department updated successfully!');
        } else {
          toast.error('Failed to update department');
        }
      } else {
        const response = await makeAuthenticatedRequest(apiUrl, {
          method: 'POST',
          body: JSON.stringify({ name: formData.name })
        });
        if (response.ok) {
          const newDept = await response.json();
          setDepartments(prev => [...prev, newDept]);
          toast.success('Department created successfully!');
        } else {
          toast.error('Failed to create department');
        }
      }
      resetForm();
    } catch (error) {
            toast.error('Error saving department');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", status: true });
    setShowForm(false);
    setEditingDepartment(null);
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      status: department.status
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this department?")) {
      try {
        const response = await makeAuthenticatedRequest(`${apiUrl}${id}/`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setDepartments(prev => prev.filter(dept => dept.id !== id));
          toast.success('Department deleted successfully!');
        } else {
          toast.error('Failed to delete department');
        }
      } catch (error) {
                toast.error('Error deleting department');
      }
    }
  };

  return (
    <AdminLayout title="Department Management">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: '#ffffff' }}>
          <div className="card-body p-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
              <h4 className="mb-0" style={{ color: '#2c3e50' }}><i className="bi bi-building-fill me-2"></i>Departments</h4>
              <button 
                className="btn px-4 shadow w-100 w-md-auto"
                onClick={() => setShowForm(true)}
                style={{ background: '#2c3e50', color: 'white', borderRadius: '8px', border: 'none', maxWidth: '200px' }}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Add Department
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px' }}>
            <div className="card-header" style={{ background: '#2c3e50', borderRadius: '15px 15px 0 0', border: 'none' }}>
              <h5 className="mb-0 text-white"><i className="bi bi-pencil-square me-2"></i>{editingDepartment ? "Edit Department" : "Add New Department"}</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12 col-md-8">
                    <label className="form-label">Department Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status.toString()}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value === 'true' }))}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <button type="submit" className="btn px-4 shadow me-2" disabled={loading} style={{ background: '#2c3e50', color: 'white', borderRadius: '8px', border: 'none' }}>
                    {loading ? 'Saving...' : (editingDepartment ? "Update" : "Create")} Department
                  </button>
                  <button type="button" className="btn px-4 shadow" onClick={resetForm} style={{ background: '#2c3e50', color: 'white', borderRadius: '8px', border: 'none' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-body">
            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="table table-hover" style={{ minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(departments) && departments.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((department) => (
                    <tr key={department.id}>
                      <td className="fw-semibold">{department.name}</td>
                      <td>
                        <span className={`badge ${department.status ? '' : 'bg-secondary'}`} style={{ backgroundColor: department.status ? '#2ecc71' : undefined }}>
                          {department.status ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(department.created_at).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn btn-sm shadow-sm me-2"
                          onClick={() => handleEdit(department)}
                          style={{ background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px' }}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger shadow-sm"
                          onClick={() => handleDelete(department.id)}
                          style={{ borderRadius: '6px' }}
                        >
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {departments.length > pageSize && (
              <div className="d-flex justify-content-between align-items-center px-2 pt-3">
                <small className="text-muted">Showing {Math.min((currentPage - 1) * pageSize + 1, departments.length)}–{Math.min(currentPage * pageSize, departments.length)} of {departments.length}</small>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(p => p - 1)}>‹</button>
                  </li>
                  {Array.from({ length: Math.ceil(departments.length / pageSize) }, (_, i) => (
                    <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                      <button className="page-link" style={currentPage === i + 1 ? { background: '#2c3e50', borderColor: '#2c3e50' } : {}} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage === Math.ceil(departments.length / pageSize) ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(p => p + 1)}>›</button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}