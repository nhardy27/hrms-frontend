import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function EmployeeSalarySlip() {
  const { id } = useParams();
  const [salary, setSalary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalaryDetails();
  }, [id]);

  // Fetch salary details with user and department info
  const fetchSalaryDetails = async () => {
    try {
      const url = `${config.api.host}${config.api.salary}${id}/`;
      const response = await makeAuthenticatedRequest(url);
      
      if (response.ok) {
        const data = await response.json();
        setSalary(data);
        
        if (data.user?.id) {
          const userResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}${data.user.id}/`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            
            // Fetch department name
            if (userData.department) {
              const deptResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.department}${userData.department}/`);
              if (deptResponse.ok) {
                const deptData = await deptResponse.json();
                userData.departmentName = deptData.name;
              }
            }
            
            setSalary((prev: any) => ({ ...prev, userDetails: userData }));
          }
        }
        
        if (data.year) {
          const yearResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.year}${data.year}/`);
          if (yearResponse.ok) {
            const yearData = await yearResponse.json();
            setSalary((prev: any) => ({ ...prev, yearDetails: yearData }));
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (salary && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [salary, loading]);

  if (loading || !salary) {
    return <div className="text-center p-5">Loading...</div>;
  }

  const grossSalary = parseFloat(salary.userDetails?.basic_salary || salary.basic_salary) + parseFloat(salary.userDetails?.hra || salary.hra) + parseFloat(salary.userDetails?.allowance || salary.allowance);
  const totalDeduction = parseFloat(salary.pf_amount || 0) + parseFloat(salary.deduction || 0);

  return (
    <>
      <div className="container-fluid p-4">
        <div className="card border-0 shadow-lg" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <h2 style={{ color: '#2c3e50', fontWeight: 'bold' }}>SALARY SLIP</h2>
              <p style={{ color: '#7f8c8d' }}>
                For the month of {MONTHS[salary.month - 1]} {salary.yearDetails?.year || ''}
              </p>
            </div>

            <hr style={{ border: '2px solid #2c3e50' }} />

            <div className="row mb-3">
              <div className="col-6">
                <p><strong>Employee Name:</strong> {salary.userDetails?.first_name || ''} {salary.userDetails?.last_name || ''}</p>
                <p><strong>Employee Code:</strong> {salary.userDetails?.emp_code || salary.user?.username || 'N/A'}</p>
                <p><strong>Mobile Number:</strong> {salary.userDetails?.contact_no || 'N/A'}</p>
              </div>
              <div className="col-6">
                <p><strong>Email:</strong> {salary.user?.email || ''}</p>
                <p><strong>Designation:</strong> {salary.userDetails?.designation || 'N/A'}</p>
                <p><strong>Department:</strong> {salary.userDetails?.departmentName || 'N/A'}</p>
              </div>
            </div>

            <div className="text-center mb-3" style={{ padding: '10px', backgroundColor: '#f8f9fa' }}>
              <strong>Payment Status: </strong>
              <span className={`badge ${salary.payment_status === 'paid' ? 'bg-success' : 'bg-warning'}`} style={{ padding: '6px 12px', fontSize: '12px', border: '1px solid #333' }}>
                {salary.payment_status.toUpperCase()}
              </span>
              {salary.payment_date && (
                <span style={{ marginLeft: '20px' }}>
                  <strong>Payment Date: </strong>{new Date(salary.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>

            <hr />

            <div className="row mb-3">
              <div className="col-6">
                <h6 style={{ color: '#333', marginBottom: '15px', fontWeight: 'bold', backgroundColor: '#f2f2f2', padding: '10px', border: '1px solid #ddd' }}>EARNINGS</h6>
                <table className="table table-bordered" style={{ fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Basic Salary</td>
                      <td className="text-end">₹{parseFloat(salary.userDetails?.basic_salary || salary.basic_salary).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>HRA</td>
                      <td className="text-end">₹{parseFloat(salary.userDetails?.hra || salary.hra).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Allowance</td>
                      <td className="text-end">₹{parseFloat(salary.userDetails?.allowance || salary.allowance).toFixed(2)}</td>
                    </tr>
                    <tr style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                      <td style={{ fontWeight: 'bold' }}>Gross Salary</td>
                      <td className="text-end"><strong>₹{grossSalary.toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="col-6">
                <h6 style={{ color: '#333', marginBottom: '15px', fontWeight: 'bold', backgroundColor: '#f2f2f2', padding: '10px', border: '1px solid #ddd' }}>DEDUCTIONS</h6>
                <table className="table table-bordered" style={{ fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>PF ({salary.pf_percentage || 0}%)</td>
                      <td className="text-end">₹{parseFloat(salary.pf_amount || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Deduction</td>
                      <td className="text-end">₹{parseFloat(salary.deduction || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td></td>
                      <td></td>
                    </tr>
                    <tr style={{ backgroundColor: '#f5f5f5', fontWeight: 'bold' }}>
                      <td style={{ fontWeight: 'bold' }}>Total Deduction</td>
                      <td className="text-end"><strong>₹{totalDeduction.toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-12">
                <h6 style={{ color: '#333', marginBottom: '15px', fontWeight: 'bold', backgroundColor: '#f2f2f2', padding: '10px', border: '1px solid #ddd' }}>ATTENDANCE</h6>
                <table className="table table-bordered" style={{ fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '25%' }}>Working Days</td>
                      <td className="text-end" style={{ width: '25%' }}>{salary.total_working_days}</td>
                      <td style={{ fontWeight: 'bold', width: '25%' }}>Present Days</td>
                      <td className="text-end" style={{ width: '25%' }}>{salary.present_days}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold' }}>Half Days</td>
                      <td className="text-end">{salary.half_days}</td>
                      <td style={{ fontWeight: 'bold' }}>Absent Days</td>
                      <td className="text-end">{salary.absent_days}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <hr style={{ border: '2px solid #2c3e50' }} />

            <div className="row mb-3">
              <div className="col-12">
                <table className="table table-bordered">
                  <tbody>
                    <tr style={{ backgroundColor: '#333', color: 'white', fontSize: '15px' }}>
                      <td style={{ padding: '12px 10px' }}><strong>NET SALARY</strong></td>
                      <td className="text-end" style={{ padding: '12px 10px' }}><strong>₹{parseFloat(salary.net_salary).toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-center mt-4" style={{ color: '#666', fontSize: '11px', lineHeight: '1.6' }}>
              <p style={{ margin: '3px 0' }}>This is a computer-generated salary slip.</p>
              <p style={{ margin: '3px 0' }}>For queries, contact HR department.</p>
              <p style={{ margin: '3px 0' }}>hr.humbingo@gmail.com</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 0.5cm;
            size: A4;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
}
