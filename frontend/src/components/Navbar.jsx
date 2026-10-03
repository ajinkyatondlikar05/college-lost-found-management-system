import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiMenu, FiX, FiUser, FiLogOut, FiPlusCircle, FiShield, FiFileText } from 'react-icons/fi';
import { MdFindInPage } from 'react-icons/md';
import './Navbar.css';

export default function Navbar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleLogout = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    logoutUser();
    navigate('/', { replace: true });
    setDropdownOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-inner">
          {/* Logo */}
          <Link to="/" className="navbar-logo">
            <MdFindInPage className="logo-icon" />
            <span>Lost<span className="logo-accent">&Found</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
            {user && (
              <>
                <NavLink to="/report-lost" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
                  <FiPlusCircle /> Report Lost
                </NavLink>
                <NavLink to="/report-found" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
                  <FiPlusCircle /> Report Found
                </NavLink>
                {user.role === 'admin' && (
                  <NavLink to="/admin" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setMenuOpen(false)}>
                    <FiShield /> Admin
                  </NavLink>
                )}
              </>
            )}
          </div>

          {/* Right Side */}
          <div className="navbar-right">
            {user ? (
              <div className="user-menu" ref={dropdownRef}>
                <button
                  type="button"
                  className="user-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen((prev) => !prev);
                  }}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="user-avatar">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="user-name">
                    {user?.name ? user.name.split(' ')[0] : 'User'}
                  </span>
                </button>
                {dropdownOpen && (
                  <div
                    className="user-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="dropdown-header">
                      <div className="dropdown-avatar">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="dropdown-info">
                        <div className="dropdown-name">{user?.name || 'User'}</div>
                        <div className="dropdown-email">{user?.email || ''}</div>
                        {user?.role === 'admin' ? (
                          <span className="dropdown-role">Admin</span>
                        ) : (
                          <span className="dropdown-role" style={{ background: '#ecfdf5', color: '#059669' }}>
                            Approved Student
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    <Link to="/my-reports" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                      <FiFileText /> My Reports
                    </Link>
                    {user?.role === 'admin' && (
                      <Link to="/admin" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <FiShield /> Admin Panel
                      </Link>
                    )}
                    <div className="dropdown-divider"></div>
                    <button
                      type="button"
                      className="dropdown-item logout"
                      onClick={handleLogout}
                    >
                      <FiLogOut /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn btn-secondary btn-sm">Login</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Register</Link>
              </div>
            )}

            {/* Mobile toggle */}
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
