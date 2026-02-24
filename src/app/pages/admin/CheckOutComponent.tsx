import { useState } from 'react';
import toast from 'react-hot-toast';
import config from '../../../config/global.json';

interface CheckOutProps {
  attendanceId: string;
  employeeName: string;
  onSuccess: () => void;
  disabled: boolean;
}

export function CheckOutComponent({ attendanceId, employeeName, onSuccess, disabled }: CheckOutProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckOut = async () => {
    if (disabled) {
      toast.error(`${employeeName} is already checked out today!`);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const now = new Date();

      const response = await fetch(`${config.api.host}/api/v1/Attendance/${attendanceId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          check_out: now.toTimeString().split(' ')[0]
        })
      });

      if (response.ok) {
        toast.success(`${employeeName} checked out successfully!`);
        onSuccess();
      } else {
        const errorData = await response.text();
                if (errorData.includes('already') || errorData.includes('not found')) {
          toast.error(`${employeeName} cannot check out - either not checked in or already checked out!`);
        } else {
          toast.error('Failed to check out');
        }
      }
    } catch (error) {
            toast.error('Error checking out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="btn btn-danger btn-sm"
      onClick={handleCheckOut}
      disabled={loading}
    >
      {disabled ? 'Already Checked Out' : loading ? 'Checking Out...' : 'Check Out'}
    </button>
  );
}