interface AttendanceRecord {
  employee_id: string;
  date: string;
  login_time: string;
  logout_time?: string;
  total_minutes: number;
  status: 'present' | 'absent';
}

class AttendanceService {
  private static instance: AttendanceService;
  private attendanceKey = 'employee_attendance_records';

  static getInstance(): AttendanceService {
    if (!AttendanceService.instance) {
      AttendanceService.instance = new AttendanceService();
    }
    return AttendanceService.instance;
  }

  saveAttendance(record: AttendanceRecord): void {
    const records = this.getAttendanceRecords();
    const today = new Date().toISOString().split('T')[0];
    
    // Remove any existing record for today
    const filteredRecords = records.filter(
      r => !(r.employee_id === record.employee_id && r.date === today)
    );
    
    // Add new record
    filteredRecords.push(record);
    localStorage.setItem(this.attendanceKey, JSON.stringify(filteredRecords));
  }

  getAttendanceRecords(): AttendanceRecord[] {
    const records = localStorage.getItem(this.attendanceKey);
    return records ? JSON.parse(records) : [];
  }

  getTodayAttendance(employeeId: string): AttendanceRecord | null {
    const records = this.getAttendanceRecords();
    const today = new Date().toISOString().split('T')[0];
    return records.find(r => r.employee_id === employeeId && r.date === today) || null;
  }

  isEmployeePresentToday(employeeId: string): boolean {
    const todayRecord = this.getTodayAttendance(employeeId);
    return todayRecord?.status === 'present' && (todayRecord?.total_minutes || 0) >= 1;
  }
}

export default AttendanceService;