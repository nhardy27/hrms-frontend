import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
import { LoadingAnimation } from '../../components/LoadingAnimation';

interface SalaryRecord {
  id: string;
  month: number;
  year: string;
  basic_salary: string;
  hra: string;
  allowance: string;
  present_days: number;
  absent_days: number;
  half_days: number;
  deduction: string;
  pf_percentage: string;
  pf_amount: string;
  net_salary: string;
  payment_status: string;
  user?: any;
}

interface Employee {
  id: number;
  basic_salary?: number;
  hra?: number;
  allowance?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function SalaryTab() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalaries();
  }, []);

  const fetchSalaries = async () => {
    try {
      const user = localStorage.getItem('user');
      if (!user) return;
      
      const userData = JSON.parse(user);
      
      // Fetch employees
      const empResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}`);
      if (empResponse.ok) {
        const empData = await empResponse.json();
        setEmployees(empData.results || []);
      }
      
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.salary}`);
      
      if (response.ok) {
        const data = await response.json();
        
        const yearResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.year}`);
        const years = yearResponse.ok ? (await yearResponse.json()).results : [];
        
        const userSalaries = (data.results || []).filter((s: any) => {
          const salaryUserId = typeof s.user === 'number' ? s.user : s.user?.id;
          return salaryUserId === userData.id;
        }).map((s: any) => ({
          ...s,
          year: typeof s.year === 'object' ? s.year.year : years.find((y: any) => y.id === s.year)?.year || s.year
        }));
        
        setSalaries(userSalaries);
      }
    } catch (error) {
      toast.error("Failed to load salary records");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (salaryId: string) => {
    window.open(`/employee-salary-slip/${salaryId}`, '_blank');
  };

  if (loading) {
    return <LoadingAnimation />;
  }

  const totalPF = salaries.reduce((sum, salary) => sum + parseFloat(salary.pf_amount || '0'), 0);

  return (
    <div className="card shadow-sm border-0" style={{ background: '#ffffff' }}>
      <div className="card-header" style={{ background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
        <h5 className="mb-0" style={{ color: '#2c3e50' }}><i className="bi bi-cash-stack me-2"></i>My Salary</h5>
      </div>
      <div className="card-body">
        {salaries.length > 0 && (
          <div className="alert alert-info mb-3" role="alert">
            <i className="bi bi-piggy-bank me-2"></i>
            <strong>PF Status:</strong> Total PF Amount: <strong>₹{totalPF.toFixed(2)}</strong>
          </div>
        )}
        {salaries.length === 0 ? (
          <p className="text-muted text-center">No salary records found</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Month/Year</th>
                  <th>Basic</th>
                  <th>HRA</th>
                  <th>Allowance</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>PF</th>
                  <th>Deduction</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((salary) => {
                  const employee = employees.find(emp => emp.id === (typeof salary.user === 'number' ? salary.user : salary.user?.id));
                  return (
                  <tr key={salary.id}>
                    <td>{MONTHS[salary.month - 1]} {salary.year}</td>
                    <td>₹{parseFloat(employee?.basic_salary?.toString() || salary.basic_salary).toFixed(2)}</td>
                    <td>₹{parseFloat(employee?.hra?.toString() || salary.hra).toFixed(2)}</td>
                    <td>₹{parseFloat(employee?.allowance?.toString() || salary.allowance).toFixed(2)}</td>
                    <td>{salary.present_days}</td>
                    <td>{salary.absent_days}</td>
                    <td>₹{parseFloat(salary.pf_amount || '0').toFixed(2)}</td>
                    <td>₹{parseFloat(salary.deduction).toFixed(2)}</td>
                    <td className="fw-bold">₹{parseFloat(salary.net_salary).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${salary.payment_status === 'paid' ? 'bg-success' : 'bg-warning'}`}>
                        {salary.payment_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => handleDownload(salary.id)}
                        title="Download Salary Slip"
                      >
                        <i className="bi bi-download"></i>
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
  );
}
