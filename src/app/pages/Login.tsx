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
        const userResponse = await fetch(`${config.api.host}${config.api.user}?username=${formData.username}`, {
          headers: {
            Authorization: `Bearer ${data.access}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          const currentUser = userData.results?.[0];

          if (currentUser) {
            localStorage.setItem("user", JSON.stringify(currentUser));
            localStorage.setItem("username", formData.username);
            localStorage.setItem("password", formData.password);

            // Redirect based on user role
            if (currentUser.is_superuser === true || currentUser.username === 'admin') {
              navigate("/admin-dashboard");
            } else {
              navigate("/employee-dashboard");
            }
          } else {
            setError("User not found in system");
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
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: '#f8f9fa' }}>
      <div className="card shadow-lg border-0" style={{ width: "400px", borderRadius: '15px' }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <img src="/Logo.png" alt="HR Management System" style={{ height: '60px', marginBottom: '20px', objectFit: 'contain' }} />
            <h3 className="card-title fw-bold" style={{ color: '#2c3e50' }}>HR Management System</h3>
            <p className="text-muted">Login to your account</p>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label fw-semibold" style={{ color: '#2c3e50' }}>
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
                style={{ borderRadius: '8px', padding: '10px' }}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold" style={{ color: '#2c3e50' }}>
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
                style={{ borderRadius: '8px', padding: '10px' }}
              />
            </div>

            <button
              type="submit"
              className="btn w-100 text-white shadow"
              disabled={loading}
              style={{ background: '#2c3e50', borderRadius: '8px', padding: '10px', border: 'none' }}
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