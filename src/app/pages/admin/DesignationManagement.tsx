import { useState, useEffect } from "react";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest, fetchAllPages } from "../../../utils/apiUtils";
import { AdminLayout } from '../../components/AdminLayout';

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
  department: string;
  department_name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export function DesignationPage() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", department: "", status: true });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(designations.length / itemsPerPage);

  const apiUrl = `${config.api.host}${config.api.designation}`;
  const deptUrl = `${config.api.host}${config.api.department}`;

  useEffect(() => {
    fetchDesignations();
    fetchDepartments();
    const interval = setInterval(fetchDesignations, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDesignations = async () => {
    try {
      const data = await fetchAllPages(apiUrl);
      setDesignations(data);
    } catch {}
  };

  const fetchDepartments = async () => {
    try {
      const data = await fetchAllPages(deptUrl);
      setDepartments(data);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDesignation) {
        const res = await makeAuthenticatedRequest(`${apiUrl}${editingDesignation.id}/`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updated = await res.json();
          const dept = departments.find(d => d.id === updated.department);
          const updatedWithDeptName = { ...updated, department_name: dept?.name || 'N/A' };
          setDesignations(prev => prev.map(d => d.id === editingDesignation.id ? updatedWithDeptName : d));
          toast.success('Designation updated successfully!');
        } else {
          toast.error('Failed to update designation');
        }
      } else {
        const res = await makeAuthenticatedRequest(apiUrl, {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          const dept = departments.find(d => d.id === created.department);
          const createdWithDeptName = { ...created, department_name: dept?.name || 'N/A' };
          setDesignations(prev => [...prev, createdWithDeptName]);
          toast.success('Designation created successfully!');
        } else {
          toast.error('Failed to create designation');
        }
      }
      resetForm();
    } catch {
      toast.error('Error saving designation');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", department: "", status: true });
    setShowForm(false);
    setEditingDesignation(null);
  };

  const handleEdit = (designation: Designation) => {
    setEditingDesignation(designation);
    setFormData({ name: designation.name, department: designation.department, status: designation.status });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this designation?")) {
      try {
        const res = await makeAuthenticatedRequest(`${apiUrl}${id}/`, { method: 'DELETE' });
        if (res.ok) {
          setDesignations(prev => prev.filter(d => d.id !== id));
          toast.success('Designation deleted successfully!');
        } else {
          toast.error('Failed to delete designation');
        }
      } catch {
        toast.error('Error deleting designation');
      }
    }
  };

  return (
    <AdminLayout title="Designation Management">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px', background: '#ffffff' }}>
          <div className="card-body p-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
              <div>
                <h4 className="mb-0" style={{ color: '#2c3e50' }}><i className="bi bi-briefcase-fill me-2"></i>Designations</h4>
                <small className="text-muted">Total: <strong>{designations.length}</strong> designations | Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong></small>
              </div>
              <button
                className="btn px-4 shadow w-100 w-md-auto"
                onClick={() => setShowForm(true)}
                style={{ background: '#2c3e50', color: 'white', borderRadius: '8px', border: 'none', maxWidth: '200px' }}
              >
                <i className="bi bi-plus-circle me-2"></i>Add Designation
              </button>
            </div>
          </div>
        </div>

        {showForm && (
          <div className="card border-0 shadow-lg mb-4" style={{ borderRadius: '15px' }}>
            <div className="card-header" style={{ background: '#2c3e50', borderRadius: '15px 15px 0 0', border: 'none' }}>
              <h5 className="mb-0 text-white"><i className="bi bi-pencil-square me-2"></i>{editingDesignation ? "Edit Designation" : "Add New Designation"}</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12 col-md-5">
                    <label className="form-label">Designation Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Department</label>
                    <select
                      className="form-select"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-3">
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
                    {loading ? 'Saving...' : (editingDesignation ? "Update" : "Create")} Designation
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
                    <th>Designation Name</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {designations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((designation) => (
                    <tr key={designation.id}>
                      <td className="fw-semibold">{designation.name}</td>
                      <td>{designation.department_name}</td>
                      <td>
                        <span className={`badge ${designation.status ? '' : 'bg-secondary'}`} style={{ backgroundColor: designation.status ? '#2ecc71' : undefined }}>
                          {designation.status ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{new Date(designation.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-sm shadow-sm me-2"
                          onClick={() => handleEdit(designation)}
                          style={{ background: '#9b59b6', color: 'white', border: 'none', borderRadius: '6px' }}
                        >
                          <i className="bi bi-pencil"></i> Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger shadow-sm"
                          onClick={() => handleDelete(designation.id)}
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

            {/* Pagination */}
            <nav className="mt-3">
              <ul className="pagination mb-0">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(prev => prev - 1)} disabled={currentPage === 1}>Previous</button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(page)}>{page}</button>
                  </li>
                ))}
                <li className={`page-item ${currentPage >= totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage >= totalPages}>Next</button>
                </li>
              </ul>
              <div className="mt-2 text-muted small">Page {currentPage} of {totalPages} (Total: {designations.length} designations)</div>
            </nav>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
