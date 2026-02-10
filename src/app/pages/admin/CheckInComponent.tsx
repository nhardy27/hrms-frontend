import { useState } from 'react';
import toast from 'react-hot-toast';
import config from '../../../config/global.json';

interface CheckInProps {
  employeeId: string;
  employeeName: string;
  onSuccess: () => void;
  disabled: boolean;
}

export function CheckInComponent({ employeeId, employeeName, onSuccess, disabled }: CheckInProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    if (disabled) {
      toast.error(`${employeeName} is already checked in today!`);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const now = new Date();
      
      // Get attendance status ID
      const statusResponse = await fetch(`${config.api.host}/api/v1/AttendanceStatus/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error('Failed to get attendance status');
      }
      
      const statusData = await statusResponse.json();
      const presentStatus = (statusData.results || []).find((status: any) => status.present === true);
      
      if (!presentStatus) {
        throw new Error('Present status not found');
      }

      const response = await fetch(`${config.api.host}/api/v1/Attendance/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: parseInt(employeeId),
          date: now.toISOString().split('T')[0],
          attendance_status: presentStatus.id,
          check_in: now.toTimeString().split(' ')[0]
        })
      });

      if (response.ok) {
        toast.success(`${employeeName} checked in successfully!`);
        onSuccess();
      } else {
        const errorData = await response.text();
        console.error('Check-in failed:', errorData);
        if (errorData.includes('already') || errorData.includes('duplicate')) {
          toast.error(`${employeeName} is already checked in today!`);
        } else {
          toast.error('Failed to check in');
        }
      }
    } catch (error) {
      console.error('Error checking in:', error);
      toast.error('Error checking in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className="btn btn-success btn-sm"
      onClick={handleCheckIn}
      disabled={loading}
    >
      {disabled ? 'Already Checked In' : loading ? 'Checking In...' : 'Check In'}
    </button>
  );
}