import { useState, ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import config from "../../config/global.json";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${config.api.host}${config.api.token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("token", data.access);
        if (data.refresh) {
          localStorage.setItem("refreshToken", data.refresh);
        }

        // Get user details to determine role
        const userResponse = await fetch(`${config.api.host}${config.api.user}`, {
          headers: {
            Authorization: `Bearer ${data.access}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          const currentUser = userData.results?.find(
            (user: any) => user.username === formData.username
          );

          if (currentUser) {
            localStorage.setItem("user", JSON.stringify(currentUser));
            
            // Debug logs
            console.log('Current User:', currentUser);
            console.log('is_superuser:', currentUser.is_superuser);
            console.log('is_staff:', currentUser.is_staff);

            // Redirect based on user role
            if (currentUser.is_superuser === true || (currentUser.is_staff === true && currentUser.username === 'admin')) {
              console.log('Redirecting to admin dashboard');
              navigate("/admin-dashboard");
            } else {
              console.log('Redirecting to employee dashboard');
              navigate("/employee-dashboard");
            }
          } else {
            setError("User not found");
          }
        } else {
          setError("Failed to get user details");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Invalid credentials");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card shadow" style={{ width: "400px" }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <h3 className="card-title text-primary">HR Management System</h3>
            <p className="text-muted">Login to your account</p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                type="text"
                className="form-control"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                className="form-control"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="text-center mt-3">
            <small className="text-muted">
              Admins will be redirected to Admin Dashboard<br />
              Employees will be redirected to Employee Dashboard
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;