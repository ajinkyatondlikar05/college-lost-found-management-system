import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { isLoggingOut, setIsLoggingOut } = useAuth() || {};

  useEffect(() => {
    if (isLoggingOut && typeof setIsLoggingOut === 'function') {
      setIsLoggingOut(false);
    }
  }, [isLoggingOut, setIsLoggingOut]);

  return (
    <div className="landing-page">
      {/* College/Institute Top Header */}
      <header className="institute-top-header" id="institute-header">
        <div className="institute-header-container">
          <img
            src="/apsit-logo.png"
            alt="A. P. Shah Institute of Technology Logo"
            className="institute-logo"
            id="institute-logo"
          />
          <div className="institute-text-block">
            <div className="institute-line-trust">
              Parshvanath Charitable Trust's
            </div>
            <h2 className="institute-line-name">
              A. P. SHAH INSTITUTE OF TECHNOLOGY
            </h2>
            <div className="institute-line-affil">
              (Approved by AICTE New Delhi &amp; Govt. of Maharashtra, Affiliated to University of Mumbai)
            </div>
            <div className="institute-line-minority">
              (Religious Jain Minority)
            </div>
          </div>
        </div>
      </header>

      {/* Dark Portal Body */}
      <div className="landing-portal-body">
        {/* Background subtle pattern */}
        <div className="landing-bg-pattern"></div>

        <div className="landing-content animate-fadeInUp">
        {/* Header */}
        <div className="landing-header">
          <div className="landing-portal-icon" aria-hidden="true">
            {/* Door/Portal SVG icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              width="56"
              height="56"
            >
              <path d="M11 2C9.9 2 9 2.9 9 4v1H5c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-4V4c0-1.1-.9-2-2-2h-2zm0 2h2v3h-2V4zM5 7h14v13H5V7zm7 2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c-1.34 0-4 .67-4 2v1h8v-1c0-1.33-2.66-2-4-2z" />
            </svg>
          </div>
          <h1 className="landing-title">Welcome to Portal</h1>
          <p className="landing-subtitle">Choose your access portal to continue</p>
        </div>

        {/* Portal Cards */}
        <div className="portal-cards">
          {/* Admin Portal Card */}
          <div className="portal-card" id="admin-portal-card">
            <div className="portal-card-icon" aria-hidden="true">
              {/* Admin / user-with-shield SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                width="80"
                height="80"
                fill="none"
              >
                {/* Person body */}
                <circle cx="28" cy="20" r="10" fill="#1a237e" />
                <path
                  d="M8 54c0-11.046 8.954-18 20-18h4c4.2 0 8.1 1.2 11.3 3.3"
                  stroke="#1a237e"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Shield */}
                <path
                  d="M46 34l8 3.5v7.5c0 4.5-3.5 8.5-8 10-4.5-1.5-8-5.5-8-10v-7.5L46 34z"
                  fill="#1a237e"
                />
                <path
                  d="M43 44.5l2.5 2.5 5-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>

            <h2 className="portal-card-title">Admin Portal</h2>
            <p className="portal-card-desc">
              Access the administrative dashboard to manage users, view analytics, and control system settings.
            </p>
            <p className="portal-card-note">Full administrative privileges required.</p>

            <button
              id="enter-admin-portal-btn"
              className="portal-btn"
              onClick={() => navigate('/admin/login')}
              aria-label="Enter Admin Portal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
              </svg>
              Enter Admin Portal
            </button>
          </div>

          {/* User Portal Card */}
          <div className="portal-card" id="user-portal-card">
            <div className="portal-card-icon" aria-hidden="true">
              {/* Regular user SVG */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 64 64"
                width="80"
                height="80"
                fill="none"
              >
                <circle cx="32" cy="20" r="12" fill="#1a237e" />
                <path
                  d="M8 56c0-13.255 10.745-20 24-20s24 6.745 24 20"
                  stroke="#1a237e"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>

            <h2 className="portal-card-title">User Portal</h2>
            <p className="portal-card-desc">
              Access the user dashboard to manage your profile, submit requests, and interact with system features.
            </p>
            <p className="portal-card-note">Available for all registered users.</p>

            <button
              id="enter-user-portal-btn"
              className="portal-btn"
              onClick={() => navigate('/user/login')}
              aria-label="Enter User Portal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z" />
              </svg>
              Enter User Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
