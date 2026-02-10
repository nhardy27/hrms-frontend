import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';

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
  net_salary: string;
  payment_status: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function SalaryTab() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalaries();
  }, []);

  const fetchSalaries = async () => {
    try {
      const user = localStorage.getItem('user');
      if (!user) return;
      
      const userData = JSON.parse(user);
      console.log('Current user ID:', userData.id);
      
      const response = await makeAuthenticatedRequest(`${config.api.host}${config.api.salary}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('All salary data:', data.results);
        
        const yearResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.year}`);
        const years = yearResponse.ok ? (await yearResponse.json()).results : [];
        
        const userSalaries = (data.results || []).filter((s: any) => {
          const salaryUserId = typeof s.user === 'number' ? s.user : s.user?.id;
          console.log('Comparing salary user:', salaryUserId, 'with current user:', userData.id);
          return salaryUserId === userData.id;
        }).map((s: any) => ({
          ...s,
          year: typeof s.year === 'object' ? s.year.year : years.find((y: any) => y.id === s.year)?.year || s.year
        }));
        
        console.log('Filtered user salaries:', userSalaries);
        setSalaries(userSalaries);
      }
    } catch (error) {
      console.error("Error fetching salaries:", error);
      toast.error("Failed to load salary records");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border"></div></div>;
  }

  return (
    <div className="card">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0"><i className="bi bi-cash-stack me-2"></i>My Salary</h5>
      </div>
      <div className="card-body">
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
                  <th>Deduction</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((salary) => (
                  <tr key={salary.id}>
                    <td>{MONTHS[salary.month - 1]} {salary.year}</td>
                    <td>₹{parseFloat(salary.basic_salary).toFixed(2)}</td>
                    <td>₹{parseFloat(salary.hra).toFixed(2)}</td>
                    <td>₹{parseFloat(salary.allowance).toFixed(2)}</td>
                    <td>{salary.present_days}</td>
                    <td>{salary.absent_days}</td>
                    <td>₹{parseFloat(salary.deduction).toFixed(2)}</td>
                    <td className="fw-bold">₹{parseFloat(salary.net_salary).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${salary.payment_status === 'paid' ? 'bg-success' : 'bg-warning'}`}>
                        {salary.payment_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
