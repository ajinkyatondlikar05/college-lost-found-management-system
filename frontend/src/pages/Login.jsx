import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../api';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { MdFindInPage } from 'react-icons/md';
import './Auth.css';

export default function Login() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = form.email.trim().toLowerCase();
    const collegeEmailRegex = /^[0-9]+@apsit\.edu\.in$/i;

    // Enforce student email for student logins while allowing admin emails
    if (!collegeEmailRegex.test(normalizedEmail) && !normalizedEmail.startsWith('admin')) {
      setError('Please use your official college email (example: 24107068@apsit.edu.in).');
      return;
    }

    setLoading(true);
    try {
      const { data } = await loginApi({
        ...form,
        email: normalizedEmail,
      });
      loginUser(data, data.token);
      toast.success(`Welcome back, ${data.name}!`);
      navigate(data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1"></div>
      <div className="auth-glow auth-glow-2"></div>

      <div className="auth-card animate-fadeInUp">
        <div className="auth-logo">
          <MdFindInPage className="auth-logo-icon" />
          <span>Lost<span className="logo-accent">&Found</span></span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account to continue</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrap">
              <FiMail className="input-icon" />
              <input
                type="email"
                name="email"
                className="form-input input-with-icon"
                placeholder="Student ID@apsit.edu.in"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              Use your official APSIT email (e.g. 24107068@apsit.edu.in)
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrap">
              <FiLock className="input-icon" />
              <input
                type={showPwd ? 'text' : 'password'}
                name="password"
                className="form-input input-with-icon input-with-icon-right"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button type="button" className="input-icon-right" onClick={() => setShowPwd(!showPwd)}>
                {showPwd ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
            {loading ? <><span className="spinner spinner-sm"></span> Signing in...</> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
