# HR Management System — Frontend Logic Documentation

> **Tech Stack:** React + TypeScript (Vite), React Router DOM, Fetch API  
> **Backend:** Django REST Framework (JWT Authentication)  
> **Purpose:** This document covers only the important frontend logic — no UI/styling code.

---

## Short Description

The HR Management System frontend is a role-based React application. After login, users are redirected to either the **Admin Dashboard** or the **Employee Dashboard** based on their role (`is_superuser` flag). It communicates with a Django REST API using JWT tokens, handles token refresh automatically, and supports features like attendance marking, salary slip generation, employee search, and leave management.

---

## Table of Contents

1. [Login.tsx — Authentication & Role-Based Redirect](#1-logintsx--authentication--role-based-redirect)
2. [apiUtils.ts — JWT Token Management & Authenticated Requests](#2-apiutilsts--jwt-token-management--authenticated-requests)
3. [EmployeeList.tsx — Search & Filter Logic](#3-employeelisttsx--search--filter-logic)
4. [MarkAttendance.tsx — Attendance Status Calculation Logic](#4-markattendancetsx--attendance-status-calculation-logic)
5. [SalarySlip.tsx — Salary Calculation Display Logic](#5-salarysliptsx--salary-calculation-display-logic)

---

## 1. `Login.tsx` — Authentication & Role-Based Redirect

**Purpose:** Handles user login using a JWT API, stores tokens in `localStorage`, fetches user details, and redirects to the correct dashboard based on the user's role.

### Core Logic

```tsx
const [formData, setFormData] = useState({ username: "", password: "" });
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

// Generic input handler — updates only the changed field using computed key
const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
};

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  try {
    // Step 1: Call token endpoint to get JWT access + refresh tokens
    const response = await fetch(`${config.api.host}${config.api.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const data = await response.json();

      // Step 2: Store tokens in localStorage for future API calls
      localStorage.setItem("token", data.access);
      if (data.refresh) localStorage.setItem("refreshToken", data.refresh);

      // Step 3: Fetch user list to find the logged-in user's profile
      const userResponse = await fetch(`${config.api.host}${config.api.user}`, {
        headers: { Authorization: `Bearer ${data.access}` },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();

        // Step 4: Match the logged-in username from the user list
        const currentUser = userData.results?.find(
          (user: any) => user.username === formData.username
        );

        if (currentUser) {
          localStorage.setItem("user", JSON.stringify(currentUser));

          // Step 5: Role-based redirect — admin vs employee
          if (currentUser.is_superuser === true || currentUser.username === "admin") {
            navigate("/admin-dashboard");
          } else {
            navigate("/employee-dashboard");
          }
        } else {
          setError("User not found in system");
        }
      }
    } else {
      const errorData = await response.json();
      setError(errorData.detail || "Invalid credentials"); // Show API error message
    }
  } catch {
    setError("Network error. Please try again."); // Handle network failures
  } finally {
    setLoading(false); // Always stop loading spinner
  }
};
```

**Explanation:**
- `useState` manages form fields, loading state, and error messages.
- On submit, it first calls the `/auth/token/` endpoint to get JWT tokens.
- Tokens are saved in `localStorage` so they persist across page refreshes.
- It then fetches the user list and finds the current user by matching the username.
- The `is_superuser` flag decides whether to redirect to `/admin-dashboard` or `/employee-dashboard`.
- Errors from the API (like wrong password) are shown directly to the user.

---

## 2. `apiUtils.ts` — JWT Token Management & Authenticated Requests

**Purpose:** Centralizes all API calls. Automatically checks if the JWT token is expired, refreshes it silently, and retries the original request. Prevents duplicate refresh calls using a shared promise.

### Core Logic

```ts
// Decode JWT payload and check if it expires within the next 30 seconds
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])); // Decode base64 JWT payload
    return payload.exp * 1000 < Date.now() + 30000; // 30s buffer before actual expiry
  } catch {
    return true; // If decoding fails, treat as expired
  }
};

// Use the refresh token to get a new access token
export const refreshToken = async (): Promise<string | null> => {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return null;

  const response = await fetch(`${config.api.host}${config.api.refreshToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (response.ok) {
    const data = await response.json();
    localStorage.setItem("token", data.access); // Save new access token
    if (data.refresh) localStorage.setItem("refreshToken", data.refresh);
    return data.access;
  }

  // Refresh token itself expired — force logout by clearing storage
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  return null;
};

// Shared promise to prevent multiple simultaneous refresh calls
let refreshPromise: Promise<string | null> | null = null;

const getValidToken = async (): Promise<string | null> => {
  const token = localStorage.getItem("token");
  if (token && !isTokenExpired(token)) return token; // Token is still valid

  // If a refresh is already in progress, wait for it instead of calling again
  if (!refreshPromise) {
    refreshPromise = refreshToken().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

// Wraps fetch with a 10-second timeout using AbortController
const fetchWithTimeout = (url: string, options: RequestInit, ms = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// Main function used across the app for all protected API calls
export const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}) => {
  let token = await getValidToken();

  const buildHeaders = (t: string | null) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${t}`,
    ...options.headers,
  });

  let response = await fetchWithTimeout(url, { ...options, headers: buildHeaders(token) });

  // If 401 Unauthorized, try refreshing once and retry the request
  if (response.status === 401) {
    token = await refreshToken();
    if (token) {
      response = await fetchWithTimeout(url, { ...options, headers: buildHeaders(token) });
    }
  }

  return response;
};

// Fetches all pages of a paginated API endpoint
export const fetchAllPages = async (baseUrl: string) => {
  let allData: any[] = [];
  let page = 1;

  while (true) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const response = await makeAuthenticatedRequest(`${baseUrl}${sep}page=${page}&page_size=100`);
    if (!response.ok) break;
    const data = await response.json();
    allData.push(...(data.results || []));
    if (!data.next) break; // Stop when there's no next page
    page++;
  }

  return allData;
};
```

**Explanation:**
- `isTokenExpired` decodes the JWT (base64) and checks the `exp` field with a 30-second safety buffer.
- `getValidToken` returns the current token if valid, or triggers a refresh.
- The `refreshPromise` deduplication pattern ensures that if 5 API calls fire at the same time with an expired token, only **one** refresh request is made — the others wait for it.
- `makeAuthenticatedRequest` is the single function used everywhere in the app for API calls. It handles the 401 retry automatically.
- `fetchAllPages` handles Django REST Framework's paginated responses by looping until `data.next` is null.

---

## 3. `EmployeeList.tsx` — Search & Filter Logic

**Purpose:** Fetches all employees across paginated API pages, resolves department names, and filters the list in real-time based on a search term without making new API calls.

### Core Logic

```tsx
const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // Full unfiltered list
const [employees, setEmployees] = useState<Employee[]>([]);       // Filtered display list
const [searchTerm, setSearchTerm] = useState("");
const [currentPage, setCurrentPage] = useState(1);
const itemsPerPage = 10;

// Re-run filter whenever search term or full employee list changes
useEffect(() => {
  setCurrentPage(1); // Reset to page 1 on new search
  filterEmployees();
}, [searchTerm, allEmployees]);

// Client-side filter — searches across multiple fields
const filterEmployees = () => {
  let filtered = allEmployees;

  if (searchTerm) {
    filtered = allEmployees.filter(emp =>
      emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.emp_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  setEmployees(filtered);
  setTotalCount(filtered.length);
  setTotalPages(Math.ceil(filtered.length / itemsPerPage));
};

// Fetch all employees across all pages, then resolve department names
const fetchEmployees = async () => {
  let allData: Employee[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await makeAuthenticatedRequest(
      `${config.api.host}${config.api.user}?page=${page}`
    );
    if (response.ok) {
      const data = await response.json();

      // Exclude admin/superuser accounts from the employee list
      const regularEmployees = data.results.filter(
        (emp: Employee) => !emp.is_superuser && emp.username !== "admin"
      );

      // Resolve department ID → department name using already-fetched departments
      const withDepartments = regularEmployees.map((emp: Employee) => {
        const dept = departments.find(d => d.id.toString() === emp.department?.toString());
        return { ...emp, department_name: dept ? dept.name : "N/A" };
      });

      allData = [...allData, ...withDepartments];
      hasMore = !!data.next; // Continue if there's a next page
      page++;
    } else {
      hasMore = false;
    }
  }

  // Sort by employee code numerically
  allData.sort((a, b) =>
    (a.emp_code || "").localeCompare(b.emp_code || "", undefined, { numeric: true })
  );

  setAllEmployees(allData);
  setEmployees(allData);
};

// Client-side pagination — slice the filtered array
const currentPageData = employees.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);
```

**Explanation:**
- All employees are fetched once and stored in `allEmployees`. The `employees` state holds the filtered subset.
- Search is done **client-side** — no extra API calls on each keystroke. This is fast and works offline.
- The filter checks `first_name`, `last_name`, `email`, `emp_code`, and `department_name` — all case-insensitive.
- Department names are resolved by matching the department ID from the employee object against the pre-fetched departments list.
- Pagination is also client-side using `Array.slice()`.

---

## 4. `MarkAttendance.tsx` — Attendance Status Calculation Logic

**Purpose:** Admin can manually set check-in/check-out times for employees. The system automatically calculates total hours and determines attendance status (Present / Half Day / Absent) based on hours worked.

### Core Logic

```tsx
// Store manual time inputs per employee ID
const [manualTimes, setManualTimes] = useState<Record<string, { check_in: string; check_out: string }>>({});

// Update only the specific field (check_in or check_out) for a specific employee
const handleManualTimeChange = (employeeId: string, field: "check_in" | "check_out", value: string) => {
  setManualTimes(prev => ({
    ...prev,
    [employeeId]: { ...prev[employeeId], [field]: value },
  }));
};

// Determine attendance status based on total hours worked
// Rules: >= 7 hours = Present, >= 4 hours = Half Day, < 4 hours = Absent
const getAutoStatus = (checkIn: string, checkOut: string) => {
  const checkInDate = new Date(`1970-01-01T${checkIn}`);
  const checkOutDate = new Date(`1970-01-01T${checkOut}`);
  const totalHours = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);

  if (totalHours >= 7) return { status: "Present", class: "bg-success" };
  if (totalHours >= 4) return { status: "Half Day", class: "bg-warning" };
  return { status: "Absent", class: "bg-danger" };
};

// On save: create or update attendance records for all modified employees
const handleSubmit = async () => {
  // Only process employees who have manual time entries
  const employeesToProcess = employees.filter(emp => {
    const t = manualTimes[emp.id];
    return t && (t.check_in || t.check_out);
  });

  const requests = employeesToProcess.map(async emp => {
    const manualTime = manualTimes[emp.id];
    const existing = getEmployeeAttendance(emp.id); // Check if record exists for today

    // Calculate total_hours string in HH:MM:SS format
    let totalHours = null;
    if (manualTime.check_in && manualTime.check_out) {
      const ms = new Date(`1970-01-01T${manualTime.check_out}`).getTime()
               - new Date(`1970-01-01T${manualTime.check_in}`).getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      totalHours = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    if (existing) {
      // PATCH — update existing attendance record
      return makeAuthenticatedRequest(
        `${config.api.host}${config.api.attendance}${existing.id}/`,
        { method: "PATCH", body: JSON.stringify({ ...manualTime, total_hours: totalHours }) }
      );
    } else {
      // POST — create new attendance record with auto-determined status
      const hoursDecimal = totalHours
        ? parseInt(totalHours) + (parseInt(totalHours.split(":")[1]) / 60)
        : 0;
      const statusId =
        hoursDecimal >= 7 ? presentStatus.id :
        hoursDecimal >= 4 ? halfDayStatus?.id :
        absentStatus?.id;

      return makeAuthenticatedRequest(
        `${config.api.host}${config.api.attendance}`,
        {
          method: "POST",
          body: JSON.stringify({
            user: parseInt(emp.id),
            date: selectedDate,
            attendance_status: statusId,
            check_in: manualTime.check_in,
            check_out: manualTime.check_out,
            total_hours: totalHours,
          }),
        }
      );
    }
  });

  // Run all attendance save requests in parallel
  const results = await Promise.all(requests);
  const successCount = results.filter(r => r.ok).length;
  toast.success(`Attendance saved for ${successCount} employees`);
};
```

**Explanation:**
- `manualTimes` is a dictionary keyed by employee ID, so each employee's input is tracked independently.
- Total hours are calculated by subtracting check-in from check-out using `Date` objects on a fixed date (`1970-01-01`).
- Status rules: **≥ 7 hours = Present**, **≥ 4 hours = Half Day**, **< 4 hours = Absent**.
- If an attendance record already exists for the selected date, it sends a `PATCH` request; otherwise it sends a `POST`.
- `Promise.all` runs all save requests in parallel for better performance.

---

## 5. `SalarySlip.tsx` — Salary Calculation Display Logic

**Purpose:** Fetches salary data for a specific employee by ID, resolves related user/department/designation/year details using parallel API calls, and calculates gross salary, deductions, and net salary for display.

### Core Logic

```tsx
const { id } = useParams(); // Get salary record ID from URL
const [salary, setSalary] = useState<any>(null);

useEffect(() => {
  fetchSalaryDetails();
}, [id]); // Re-fetch if the ID in the URL changes

const fetchSalaryDetails = async () => {
  const response = await makeAuthenticatedRequest(
    `${config.api.host}${config.api.salary}${id}/`
  );

  if (response.ok) {
    const data = await response.json();
    setSalary(data);

    // Fetch user details and designation list in parallel for performance
    if (data.user?.id) {
      const [userResponse, desigResponse] = await Promise.all([
        makeAuthenticatedRequest(`${config.api.host}${config.api.user}${data.user.id}/`),
        makeAuthenticatedRequest(`${config.api.host}${config.api.designation}`),
      ]);

      if (userResponse.ok) {
        const userData = await userResponse.json();

        // Resolve department ID → department name
        if (userData.department) {
          const deptRes = await makeAuthenticatedRequest(
            `${config.api.host}${config.api.department}${userData.department}/`
          );
          if (deptRes.ok) {
            const deptData = await deptRes.json();
            userData.departmentName = deptData.name;
          }
        }

        // Build a map of designation ID → designation name, then resolve
        if (desigResponse.ok) {
          const desigData = await desigResponse.json();
          const desigMap: Record<string, string> = {};
          (desigData.results || []).forEach((d: any) => {
            desigMap[String(d.id)] = d.name || d.designation_name || String(d.id);
          });
          userData.designation = desigMap[String(userData.designation)] || userData.designation;
        }

        // Merge resolved user details into salary state
        setSalary((prev: any) => ({ ...prev, userDetails: userData }));
      }
    }

    // Fetch the financial year details separately
    if (data.year) {
      const yearRes = await makeAuthenticatedRequest(
        `${config.api.host}${config.api.year}${data.year}/`
      );
      if (yearRes.ok) {
        const yearData = await yearRes.json();
        setSalary((prev: any) => ({ ...prev, yearDetails: yearData }));
      }
    }
  }
};

// --- Salary Calculation ---
// Gross = Basic + HRA + Allowance (from user profile)
const grossSalary =
  parseFloat(salary.userDetails?.basic_salary || salary.basic_salary) +
  parseFloat(salary.userDetails?.hra || salary.hra) +
  parseFloat(salary.userDetails?.allowance || salary.allowance);

const pfAmount = parseFloat(salary.pf_amount || 0);
const totalDeduction = parseFloat(salary.deduction || 0);

// Loss of Pay = Total Deduction minus PF (remaining deduction is unpaid leave)
const lossOfPay = totalDeduction - pfAmount;

// Net Salary = Earned Salary - PF (already computed by backend)
// Display: Earned Salary (₹X) - PF (₹Y) = ₹Z
const netSalary = parseFloat(salary.net_salary);
```

**Explanation:**
- `useParams` reads the salary record ID from the URL (e.g., `/salary-slip/42`).
- `Promise.all` fetches user details and designation list simultaneously to reduce wait time.
- Designation is stored as a UUID in the user profile, so a map (`desigMap`) is built to convert it to a readable name.
- Department name is resolved by fetching the department endpoint with the department ID.
- `setSalary(prev => ({ ...prev, ... }))` is used to incrementally merge data as each sub-request completes, without losing previously loaded data.
- Salary breakdown:
  - **Gross Salary** = Basic + HRA + Allowance
  - **Loss of Pay** = Total Deduction − PF Amount (deduction for unpaid leaves)
  - **Net Salary** = Earned Salary − PF (computed by the backend, displayed here)

---

## Summary Table

| File | Key Logic |
|---|---|
| `Login.tsx` | JWT login, token storage, role-based redirect |
| `apiUtils.ts` | Token expiry check, auto-refresh, deduplication, timeout, pagination |
| `EmployeeList.tsx` | Client-side search/filter, department name resolution, pagination |
| `MarkAttendance.tsx` | Hours calculation, Present/Half Day/Absent logic, PATCH vs POST |
| `SalarySlip.tsx` | Parallel API fetching, ID-to-name resolution, salary breakdown |
