import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as registerApi } from '../api';
import toast from 'react-hot-toast';
import { FiUser, FiMail, FiLock, FiPhone, FiBook, FiEye, FiEyeOff } from 'react-icons/fi';
import { MdFindInPage } from 'react-icons/md';
import './Auth.css';

export default function Register() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = form.email.trim().toLowerCase();
    const collegeEmailRegex = /^[0-9]+@apsit\.edu\.in$/i;

    // ============================================================================
    // PERMANENT PRODUCTION / DEMO SIGNUP EXCEPTION (ajinkyatondlikar@gmail.com)
    // ============================================================================
    const demoEmail = (import.meta.env.VITE_DEMO_LOGIN_EMAIL || import.meta.env.VITE_TEMP_TEST_LOGIN_EMAIL || 'ajinkyatondlikar@gmail.com').trim().toLowerCase();
    const isAllowedSignupEmail = (email) => {
      if (!email) return false;
      const normalized = email.trim().toLowerCase();
      return collegeEmailRegex.test(normalized) || (demoEmail && normalized === demoEmail);
    };
    // ============================================================================

    if (!isAllowedSignupEmail(normalizedEmail)) {
      setError('Please use your official college email (example: 24107068@apsit.edu.in).');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { data } = await registerApi({
        ...form,
        email: normalizedEmail,
      });
      toast.success(data.message || 'Registration submitted successfully. Your account is waiting for admin approval.', {
        duration: 7000,
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1"></div>
      <div className="auth-glow auth-glow-2"></div>

      <div className="auth-card auth-card-wide animate-fadeInUp">
        <div className="auth-logo">
          <MdFindInPage className="auth-logo-icon" />
          <span>Lost<span className="logo-accent">&Found</span></span>
        </div>

        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join the campus community today</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-grid">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <div className="input-icon-wrap">
                <FiUser className="input-icon" />
                <input type="text" name="name" className="form-input input-with-icon" placeholder="John Doe" value={form.name} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <div className="input-icon-wrap">
                <FiMail className="input-icon" />
                <input type="email" name="email" className="form-input input-with-icon" placeholder="Student ID@apsit.edu.in" value={form.email} onChange={handleChange} required />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Use your official APSIT email (e.g. 24107068@apsit.edu.in)
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-icon-wrap">
                <FiPhone className="input-icon" />
                <input type="tel" name="phone" className="form-input input-with-icon" placeholder="+91 9876543210" value={form.phone} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <div className="input-icon-wrap">
                <FiBook className="input-icon" />
                <input type="text" name="department" className="form-input input-with-icon" placeholder="e.g. Computer Science" value={form.department} onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <div className="input-icon-wrap">
              <FiLock className="input-icon" />
              <input
                type={showPwd ? 'text' : 'password'}
                name="password"
                className="form-input input-with-icon input-with-icon-right"
                placeholder="Min 6 characters"
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
            {loading ? <><span className="spinner spinner-sm"></span> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
