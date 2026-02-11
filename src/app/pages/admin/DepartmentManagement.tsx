import { useState, useEffect } from "react";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
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
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    status: true
  });

  const apiUrl = `${config.api.host}${config.api.department}`;

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
      console.error('No login credentials found');
      return null;
    }

    try {
      const response = await fetch(`${config.api.host}${config.api.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access);
        if (data.refresh) {
          localStorage.setItem('refreshToken', data.refresh);
        }
        return data.access;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return null;
  };

  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
    let token = localStorage.getItem('token');
    if (!token) {
      token = await refreshToken() || await getToken();
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    let response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      token = await refreshToken() || await getToken();
      if (token) {
        response = await fetch(url, {
          ...options,
          headers: { ...headers, 'Authorization': `Bearer ${token}` }
        });
      }
    }
    
    return response;
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await makeAuthenticatedRequest(apiUrl);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.results || []);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
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
      console.error('Error saving department:', error);
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
        console.error('Error deleting department:', error);
        toast.error('Error deleting department');
      }
    }
  };

  return (
    <AdminLayout title="Department Management">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center text-white">
              <h4 className="mb-0"><i className="bi bi-building-fill me-2"></i>Departments</h4>
              <button 
                className="btn text-white px-4 shadow"
                onClick={() => setShowForm(true)}
                style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', border: 'none' }}
              >
                <i className="bi bi-plus-circle me-2"></i>
                Add Department
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px' }}>
            <div className="card-header" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: '15px 15px 0 0', border: 'none' }}>
              <h5 className="mb-0 text-white"><i className="bi bi-pencil-square me-2"></i>{editingDepartment ? "Edit Department" : "Add New Department"}</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label">Department Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-4">
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
                  <button type="submit" className="btn text-white px-4 shadow me-2" disabled={loading} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '8px', border: 'none' }}>
                    {loading ? 'Saving...' : (editingDepartment ? "Update" : "Create")} Department
                  </button>
                  <button type="button" className="btn btn-secondary px-4 shadow" onClick={resetForm} style={{ borderRadius: '8px' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card border-0 shadow-lg" style={{ borderRadius: '15px' }}>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(departments) && departments.map((department) => (
                    <tr key={department.id}>
                      <td className="fw-semibold">{department.name}</td>
                      <td>
                        <span className={`badge bg-${department.status ? 'success' : 'secondary'}`}>
                          {department.status ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(department.created_at).toLocaleDateString()}</td>
                      <td>{new Date(department.updated_at).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn btn-sm shadow-sm me-2"
                          onClick={() => handleEdit(department)}
                          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px' }}
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
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}