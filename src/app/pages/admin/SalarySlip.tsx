import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast, { Toaster } from 'react-hot-toast';
import config from "../../../config/global.json";
import { makeAuthenticatedRequest } from '../../../utils/apiUtils';
import { AdminLayout } from '../../components/AdminLayout';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function SalarySlip() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [salary, setSalary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSalaryDetails();
  }, [id]);

  // Fetch salary details and user information
  const fetchSalaryDetails = async () => {
    try {
      const url = `${config.api.host}${config.api.salary}${id}/`;
      const response = await makeAuthenticatedRequest(url);
      
      if (response.ok) {
        const data = await response.json();
        setSalary(data);
        
        // Fetch full user details
        if (data.user?.id) {
          const userResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.user}${data.user.id}/`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            
            // Fetch department name if department ID exists
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
        
        // Fetch year details
        if (data.year) {
          const yearResponse = await makeAuthenticatedRequest(`${config.api.host}${config.api.year}${data.year}/`);
          if (yearResponse.ok) {
            const yearData = await yearResponse.json();
            setSalary((prev: any) => ({ ...prev, yearDetails: yearData }));
          }
        }
      } else {
        await response.text();
        toast.error("Failed to fetch salary details");
      }
    } catch (error) {
            toast.error("Error loading salary slip");
    } finally {
      setLoading(false);
    }
  };

  // Print salary slip
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <AdminLayout title="Salary Slip">
        <div className="text-center p-5">Loading...</div>
      </AdminLayout>
    );
  }

  if (!salary) {
    return (
      <AdminLayout title="Salary Slip">
        <div className="text-center p-5">Salary record not found</div>
      </AdminLayout>
    );
  }

  const grossSalary = parseFloat(salary.userDetails?.basic_salary || salary.basic_salary) + parseFloat(salary.userDetails?.hra || salary.hra) + parseFloat(salary.userDetails?.allowance || salary.allowance);
  const totalDeduction = parseFloat(salary.pf_amount || 0) + parseFloat(salary.deduction || 0);

  return (
    <AdminLayout title="Salary Slip">
      <Toaster position="bottom-center" />
      <div className="container-fluid p-4">
        <div className="d-flex justify-content-end mb-3 no-print">
          <button className="btn btn-secondary me-2" onClick={() => navigate('/salary-management')}>
            <i className="bi bi-arrow-left me-2"></i>Back
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <i className="bi bi-printer me-2"></i>Print
          </button>
        </div>

        <div className="card border-0 shadow-lg" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <h2 style={{ color: '#2c3e50', fontWeight: 'bold' }}>SALARY SLIP</h2>
              <p style={{ color: '#7f8c8d' }}>
                For the month of {MONTHS[salary.month - 1]} {salary.yearDetails?.year || ''}
              </p>
            </div>

            <hr style={{ border: '2px solid #2c3e50' }} />

            <div className="row mb-4">
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

            <div className="text-center mb-3">
              <strong>Payment Status: </strong>
              <span className={`badge ${salary.payment_status === 'paid' ? 'bg-success' : 'bg-warning'}`} style={{ padding: '6px 12px', fontSize: '12px' }}>
                {salary.payment_status.toUpperCase()}
              </span>
              {salary.payment_date && (
                <span style={{ marginLeft: '20px' }}>
                  <strong>Payment Date: </strong>{new Date(salary.payment_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>

            <hr />

            <div className="row mb-4">
              <div className="col-6">
                <h5 style={{ color: '#2c3e50', marginBottom: '20px' }}>EARNINGS</h5>
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td><strong>Basic Salary</strong></td>
                      <td className="text-end">₹ {parseFloat(salary.userDetails?.basic_salary || salary.basic_salary).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td><strong>HRA</strong></td>
                      <td className="text-end">₹ {parseFloat(salary.userDetails?.hra || salary.hra).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td><strong>Allowance</strong></td>
                      <td className="text-end">₹ {parseFloat(salary.userDetails?.allowance || salary.allowance).toFixed(2)}</td>
                    </tr>
                    <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                      <td><strong>Gross Salary</strong></td>
                      <td className="text-end"><strong>₹ {grossSalary.toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="col-6">
                <h5 style={{ color: '#2c3e50', marginBottom: '20px' }}>DEDUCTIONS</h5>
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td><strong>PF ({salary.pf_percentage || 0}%)</strong></td>
                      <td className="text-end">₹ {parseFloat(salary.pf_amount || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td><strong>Deduction</strong></td>
                      <td className="text-end">₹ {parseFloat(salary.deduction || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td></td>
                      <td></td>
                    </tr>
                    <tr style={{ backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>
                      <td><strong>Total Deduction</strong></td>
                      <td className="text-end"><strong>₹ {totalDeduction.toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="row mb-4">
              <div className="col-12">
                <h5 style={{ color: '#2c3e50', marginBottom: '20px' }}>ATTENDANCE</h5>
                <table className="table table-bordered">
                  <tbody>
                    <tr>
                      <td style={{ width: '25%' }}><strong>Working Days</strong></td>
                      <td className="text-end" style={{ width: '25%' }}>{salary.total_working_days}</td>
                      <td style={{ width: '25%' }}><strong>Present Days</strong></td>
                      <td className="text-end" style={{ width: '25%' }}>{salary.present_days}</td>
                    </tr>
                    <tr>
                      <td><strong>Half Days</strong></td>
                      <td className="text-end">{salary.half_days}</td>
                      <td><strong>Absent Days</strong></td>
                      <td className="text-end">{salary.absent_days}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <hr style={{ border: '2px solid #2c3e50' }} />

            <div className="row mb-4">
              <div className="col-12">
                <table className="table table-bordered">
                  <tbody>
                    <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                      <td><strong style={{ fontSize: '18px' }}>NET SALARY</strong></td>
                      <td className="text-end"><strong style={{ fontSize: '18px' }}>₹ {parseFloat(salary.net_salary).toFixed(2)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-center mt-5" style={{ color: '#7f8c8d', fontSize: '12px' }}>
              <p>This is a computer-generated salary slip.</p>
              <p>For queries, contact HR department.</p>
              <p>hr.humbingo@gmail.com</p>
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
          .no-print {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .card, .card * {
            visibility: visible;
          }
          .card {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100% !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
