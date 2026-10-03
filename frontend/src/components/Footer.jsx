import { Link } from 'react-router-dom';
import { MdFindInPage } from 'react-icons/md';
import { FiGithub, FiMail } from 'react-icons/fi';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <MdFindInPage />
              <span>Lost<span style={{color:'var(--primary)'}}>&#38;Found</span></span>
            </Link>
            <p>Helping the college community recover what matters.</p>
          </div>
          <div className="footer-links-group">
            <h4>Navigation</h4>
            <Link to="/items">Browse Items</Link>
            <Link to="/report-lost">Report Lost</Link>
            <Link to="/report-found">Report Found</Link>
          </div>
          <div className="footer-links-group">
            <h4>Account</h4>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 College Lost & Found. All rights reserved.</p>
        </div>
      </div>
      <style>{`
        .footer {
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          padding: 3rem 0 1.5rem;
          margin-top: 4rem;
        }
        .footer-inner {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 3rem;
          margin-bottom: 2rem;
        }
        .footer-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.2rem;
          font-weight: 800;
          color: #0f172a;
          text-decoration: none;
          margin-bottom: 0.75rem;
        }
        .footer-logo svg { font-size: 1.5rem; color: var(--primary); }
        .footer-brand p {
          color: #64748b;
          font-size: 0.875rem;
          max-width: 280px;
        }
        .footer-links-group h4 {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #1e293b;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        .footer-links-group a {
          display: block;
          color: #64748b;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
          transition: color 0.2s;
        }
        .footer-links-group a:hover { color: var(--primary); }
        .footer-bottom {
          border-top: 1px solid #f1f5f9;
          padding-top: 1.5rem;
          text-align: center;
          color: #94a3b8;
          font-size: 0.8rem;
        }
        @media (max-width: 768px) {
          .footer-inner { grid-template-columns: 1fr; gap: 2rem; }
        }
      `}</style>
    </footer>
  );
}
