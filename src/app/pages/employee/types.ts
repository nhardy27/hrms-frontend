export interface Employee {
  id: string;
  emp_code?: string;
  first_name: string;
  last_name: string;
  email: string;
  username?: string;
  department?: string;
  department_name?: string;
  designation?: string;
}

export interface Attendance {
  id: string;
  user?: number;
  date: string;
  check_in: string;
  check_out?: string;
  total_hours?: string;
  status: string;
}

export interface Leave {
  id: string;
  user?: number;
  from_date: string;
  to_date: string;
  reason: string;
  status?: string;
}