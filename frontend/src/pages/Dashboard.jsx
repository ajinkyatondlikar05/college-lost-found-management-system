import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllItems, createItem, createClaim, sendReportOtp } from '../api';
import toast from 'react-hot-toast';
import {
  FiSearch,
  FiMapPin,
  FiCalendar,
  FiPlus,
  FiX,
  FiCheckCircle,
  FiMail,
  FiPhone,
  FiUser,
  FiUploadCloud,
  FiChevronDown,
  FiLogOut,
  FiFileText,
  FiInfo,
  FiShield,
  FiHelpCircle,
  FiInbox,
} from 'react-icons/fi';
import { MdFindInPage } from 'react-icons/md';
import './Dashboard.css';

const CATEGORIES = [
  'All Categories',
  'Watches',
  'Mobile Phone',
  'Wallet',
  'Bag',
  'Jewelry',
  'Keys',
  'Documents',
  'Electronics',
  'Clothing',
  'Other',
];

export default function Dashboard() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  // Navigation & User menu
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Tab switcher: 'lost' or 'found'
  const [activeTab, setActiveTab] = useState('lost');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [locationFilter, setLocationFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Items data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedItem, setSelectedItem] = useState(null); // Item details modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false); // Report Lost Item modal
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false); // Report Found Item / Claim modal
  const [claimTargetItem, setClaimTargetItem] = useState(null);

  // OTP Verification state for reporting lost items
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  // Report Lost Item Form State
  const [reportForm, setReportForm] = useState({
    title: '',
    category: 'Electronics',
    description: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [reportImageFile, setReportImageFile] = useState(null);
  const [reportImagePreview, setReportImagePreview] = useState(null);

  // Claim Form State
  const [claimForm, setClaimForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    additionalDetails: '',
  });
  const [claimImageFile, setClaimImageFile] = useState(null);
  const [claimImagePreview, setClaimImagePreview] = useState(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // Fetch Items from Backend API
  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = {
        type: activeTab,
        sortBy,
      };
      if (selectedCategory && selectedCategory !== 'All Categories') {
        params.category = selectedCategory;
      }
      if (locationFilter.trim()) {
        params.location = locationFilter.trim();
      }
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await getAllItems(params);
      setItems(res.data.items || []);
    } catch (err) {
      console.error('Error fetching items:', err);
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab, selectedCategory, locationFilter, fromDate, toDate, sortBy]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update form defaults when user context loads
  useEffect(() => {
    if (user) {
      setReportForm((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
      }));
      setClaimForm((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user]);

  // Search handler
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchItems();
  };

  // Clear filters
  const handleClearFilters = () => {
    setSelectedCategory('All Categories');
    setLocationFilter('');
    setFromDate('');
    setToDate('');
    setSortBy('newest');
    setSearchQuery('');
  };

  // Report Lost Item Form Handling
  const handleReportInputChange = (e) => {
    const { name, value } = e.target;
    setReportForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleReportImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be less than 2MB');
        return;
      }
      setReportImageFile(file);
      setReportImagePreview(URL.createObjectURL(file));
    }
  };

  // Step 1: Submit Report Lost Item form -> Validates & sends OTP
  const handleInitiateReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.title.trim()) {
      toast.error('Item Name is required');
      return;
    }
    if (!reportForm.date) {
      toast.error('Date Lost is required');
      return;
    }
    if (!reportForm.location.trim()) {
      toast.error('Location Lost is required');
      return;
    }
    if (!reportForm.name.trim()) {
      toast.error('Your Name is required');
      return;
    }
    if (!reportForm.email.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await sendReportOtp({
        email: reportForm.email.trim(),
        name: reportForm.name.trim(),
      });
      toast.success(res.data.message || 'OTP sent to your email');
      setResendCooldown(60);
      setIsReportModalOpen(false);
      setIsOtpModalOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send verification OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      setIsSendingOtp(true);
      const res = await sendReportOtp({
        email: reportForm.email.trim(),
        name: reportForm.name.trim(),
      });
      toast.success(res.data.message || 'New OTP sent');
      setResendCooldown(60);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 3: Verify OTP and create report in MongoDB
  const handleVerifyOtpAndCreateReport = async (e) => {
    e.preventDefault();
    if (!enteredOtp || enteredOtp.trim().length < 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const formData = new FormData();
      formData.append('title', reportForm.title.trim());
      formData.append('category', reportForm.category);
      formData.append('description', reportForm.description.trim() || 'No description provided');
      formData.append('date', reportForm.date);
      formData.append('location', reportForm.location.trim());
      formData.append('type', 'lost');
      formData.append('name', reportForm.name.trim());
      formData.append('email', reportForm.email.trim());
      formData.append('phone', reportForm.phone.trim());
      formData.append('otp', enteredOtp.trim());
      if (reportImageFile) {
        formData.append('image', reportImageFile);
      }

      await createItem(formData);

      // Close OTP modal and show Success modal
      setIsOtpModalOpen(false);
      setEnteredOtp('');
      setIsSuccessModalOpen(true);

      // Refresh items list
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP code. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Reset report modal
  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
  };

  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false);
    // Reset report form
    setReportForm({
      title: '',
      category: 'Electronics',
      description: '',
      date: new Date().toISOString().split('T')[0],
      location: '',
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setReportImageFile(null);
    setReportImagePreview(null);
  };

  // Claim / Report Found Item Modal Handlers
  const handleOpenClaimModal = (item) => {
    setClaimTargetItem(item);
    setSelectedItem(null); // Close detail modal
    setClaimForm({
      fullName: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      additionalDetails: '',
    });
    setClaimImageFile(null);
    setClaimImagePreview(null);
    setIsClaimModalOpen(true);
  };

  const handleClaimInputChange = (e) => {
    const { name, value } = e.target;
    setClaimForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleClaimImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size must be under 2MB');
        return;
      }
      setClaimImageFile(file);
      setClaimImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (!claimForm.email.trim()) {
      toast.error('Email Address is required');
      return;
    }
    if (!claimForm.phone.trim()) {
      toast.error('Phone Number is required');
      return;
    }

    try {
      setIsSubmittingClaim(true);
      const formData = new FormData();
      if (claimTargetItem?._id) {
        formData.append('itemId', claimTargetItem._id);
        formData.append('itemName', claimTargetItem.title);
      } else {
        formData.append('itemName', 'Unspecified Found Item');
      }
      formData.append('fullName', claimForm.fullName.trim());
      formData.append('email', claimForm.email.trim());
      formData.append('phone', claimForm.phone.trim());
      formData.append('additionalDetails', claimForm.additionalDetails.trim());
      if (claimImageFile) {
        formData.append('image', claimImageFile);
      }

      await createClaim(formData);
      toast.success('Claim submitted successfully! The admin will review it.');
      setIsClaimModalOpen(false);
      setClaimTargetItem(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit claim request');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToItemsGrid = (tab) => {
    setActiveTab(tab);
    const el = document.getElementById('items-browser-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="ud-dashboard-root">
      {/* ========================================================
          1. TOP NAVIGATION (Clean White Header)
          ======================================================== */}
      <header className="ud-navbar">
        <div className="ud-navbar-container">
          {/* Left: Found & Lost Logo */}
          <div className="ud-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="ud-brand-icon">
              <MdFindInPage />
            </div>
            <span className="ud-brand-title">
              Found <span className="ud-brand-amp">&</span> Lost
            </span>
          </div>

          {/* Center Navigation Links */}
          <nav className="ud-nav-links">
            <button
              className="ud-nav-link"
              onClick={() => {
                handleClearFilters();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Home
            </button>
            <button
              className={`ud-nav-link ${activeTab === 'lost' ? 'active-nav' : ''}`}
              onClick={() => scrollToItemsGrid('lost')}
            >
              Lost Items
            </button>
            <button
              className={`ud-nav-link ${activeTab === 'found' ? 'active-nav' : ''}`}
              onClick={() => scrollToItemsGrid('found')}
            >
              Found Items
            </button>
            <button className="ud-nav-link" onClick={scrollToHowItWorks}>
              How It Works
            </button>
          </nav>

          {/* Right Action & User Profile */}
          <div className="ud-navbar-actions">
            <button
              className="ud-btn-report-item"
              onClick={() => setIsReportModalOpen(true)}
              title="Report an item you lost on campus"
            >
              <FiPlus className="ud-btn-icon" /> + Report Item
            </button>

            {/* User Dropdown */}
            <div className="ud-user-menu-wrapper" ref={userMenuRef}>
              <button
                className="ud-user-pill-btn"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                title={user?.email}
              >
                <div className="ud-user-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="ud-user-firstname">
                  {user?.name ? user.name.split(' ')[0] : 'Student'}
                </span>
                <FiChevronDown className="ud-chevron-icon" />
              </button>

              {userMenuOpen && (
                <div className="ud-user-dropdown-panel animate-fadeIn">
                  <div className="ud-dropdown-user-header">
                    <div className="ud-dropdown-avatar">
                      {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="ud-dropdown-info">
                      <div className="ud-dropdown-name">{user?.name}</div>
                      <div className="ud-dropdown-email">{user?.email}</div>
                      <span className="ud-dropdown-badge">Approved Student</span>
                    </div>
                  </div>
                  <div className="ud-dropdown-divider" />
                  <button
                    className="ud-dropdown-action"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/my-reports');
                    }}
                  >
                    <FiFileText /> My Reports
                  </button>
                  <div className="ud-dropdown-divider" />
                  <button
                    className="ud-dropdown-action ud-logout-action"
                    onClick={() => {
                      logoutUser();
                      navigate('/user/login');
                    }}
                  >
                    <FiLogOut /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. HOME / HERO SECTION (Large Dark Navy, Rounded Corners)
          ======================================================== */}
      <section className="ud-hero-section">
        <div className="ud-hero-content">
          <h1 className="ud-hero-title">Find Your Lost Belongings</h1>
          <p className="ud-hero-subtitle">
            Search through our database of lost and found items. Reuniting people with their valuables
            since 2025.
          </p>

          {/* Large Horizontal Search Bar */}
          <form className="ud-hero-search-bar" onSubmit={handleSearchSubmit}>
            <div className="ud-search-input-wrapper">
              <FiSearch className="ud-search-icon" />
              <input
                type="text"
                className="ud-search-input"
                placeholder="Search lost or found items by name, category, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="ud-btn-search">
              <FiSearch className="ud-btn-search-icon" />
              <span>Search</span>
            </button>
          </form>
        </div>
      </section>

      {/* ========================================================
          3. LOST ITEMS / FOUND ITEMS SWITCHER
          ======================================================== */}
      <section className="ud-main-container" id="items-browser-section">
        <div className="ud-tab-switcher-wrapper">
          <div className="ud-tab-switcher">
            <button
              className={`ud-tab-btn ${activeTab === 'lost' ? 'ud-tab-active' : ''}`}
              onClick={() => setActiveTab('lost')}
            >
              Lost Items
            </button>
            <button
              className={`ud-tab-btn ${activeTab === 'found' ? 'ud-tab-active' : ''}`}
              onClick={() => setActiveTab('found')}
            >
              Found Items
            </button>
          </div>
        </div>

        {/* ========================================================
            4. FILTER SIDEBAR + 5. ITEM CARD GRID
            ======================================================== */}
        <div className="ud-browser-layout">
          {/* FILTER SIDEBAR (White Rounded Panel) */}
          <aside className="ud-filter-sidebar">
            <div className="ud-filter-header">
              <h2 className="ud-filter-title">Filters</h2>
              <button className="ud-filter-clear-btn" onClick={handleClearFilters}>
                Clear
              </button>
            </div>

            <div className="ud-filter-group">
              <label className="ud-filter-label">Category</label>
              <select
                className="ud-filter-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="ud-filter-group">
              <label className="ud-filter-label">Location</label>
              <input
                type="text"
                className="ud-filter-input"
                placeholder="Enter location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              />
            </div>

            <div className="ud-filter-group">
              <label className="ud-filter-label">Date Range</label>
              <div className="ud-date-range-inputs">
                <div className="ud-date-field">
                  <span className="ud-date-sublabel">From</span>
                  <input
                    type="date"
                    className="ud-filter-input"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="ud-date-field">
                  <span className="ud-date-sublabel">To</span>
                  <input
                    type="date"
                    className="ud-filter-input"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="ud-filter-group">
              <label className="ud-filter-label">Sort By</label>
              <select
                className="ud-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="az">Title (A-Z)</option>
                <option value="za">Title (Z-A)</option>
              </select>
            </div>
          </aside>

          {/* ITEM CARD GRID */}
          <main className="ud-items-content">
            <div className="ud-items-header-bar">
              <span className="ud-items-count-text">
                Showing <strong>{items.length}</strong> {activeTab} items
              </span>
              {(selectedCategory !== 'All Categories' || locationFilter || fromDate || toDate || searchQuery) && (
                <span className="ud-filtered-indicator">Filtered results</span>
              )}
            </div>

            {loading ? (
              <div className="ud-loading-container">
                <div className="ud-spinner" />
                <p>Loading items from college database...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="ud-empty-state-card">
                <div className="ud-empty-icon">
                  <FiInbox />
                </div>
                <h3 className="ud-empty-title">No {activeTab} items found</h3>
                <p className="ud-empty-desc">
                  Try adjusting your search query or filter parameters to find what you are looking for.
                </p>
                <button className="ud-btn-outline" onClick={handleClearFilters}>
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="ud-items-grid">
                {items.map((item) => {
                  const formattedDate = new Date(item.date || item.createdAt).toLocaleDateString(
                    'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  );
                  const statusClass = (item.status || 'Pending').toLowerCase();

                  return (
                    <div key={item._id} className="ud-item-card">
                      {/* Image Thumbnail */}
                      <div className="ud-card-image-wrap">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.title}
                            className="ud-card-image"
                            loading="lazy"
                          />
                        ) : (
                          <div className="ud-card-image-fallback">
                            <MdFindInPage className="ud-fallback-icon" />
                            <span>{item.category}</span>
                          </div>
                        )}
                        <span className={`ud-status-badge ud-status-${statusClass}`}>
                          {item.status || 'Pending'}
                        </span>
                      </div>

                      {/* Card Info */}
                      <div className="ud-card-body">
                        <h3 className="ud-card-title" title={item.title}>
                          {item.title}
                        </h3>

                        <div className="ud-card-meta-line">
                          <FiMapPin className="ud-meta-icon" />
                          <span className="ud-meta-text">{item.location || 'College Campus'}</span>
                        </div>

                        <div className="ud-card-meta-line">
                          <FiCalendar className="ud-meta-icon" />
                          <span className="ud-meta-text">{formattedDate}</span>
                        </div>

                        <button
                          className="ud-btn-view-details"
                          onClick={() => setSelectedItem(item)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </section>

      {/* ========================================================
          HOW IT WORKS SECTION
          ======================================================== */}
      <section className="ud-how-it-works-section" id="how-it-works-section">
        <div className="ud-how-container">
          <div className="ud-how-header">
            <h2 className="ud-how-title">How It Works</h2>
            <p className="ud-how-subtitle">
              Three simple steps to report, identify, and recover your lost valuables on campus.
            </p>
          </div>

          <div className="ud-how-grid">
            <div className="ud-how-card">
              <div className="ud-how-step-badge">1</div>
              <h3 className="ud-how-card-title">Report Your Item</h3>
              <p className="ud-how-card-desc">
                Submit details and photos of what you lost. An instant 6-digit OTP secures and
                confirms your submission.
              </p>
            </div>

            <div className="ud-how-card">
              <div className="ud-how-step-badge">2</div>
              <h3 className="ud-how-card-title">Browse & Match</h3>
              <p className="ud-how-card-desc">
                Filter by category, location, and date range to quickly locate items matching your
                lost possessions.
              </p>
            </div>

            <div className="ud-how-card">
              <div className="ud-how-step-badge">3</div>
              <h3 className="ud-how-card-title">Claim & Recover</h3>
              <p className="ud-how-card-desc">
                Click "Report Found Item" to submit proof or return items through the verified college
                administration portal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          FOOTER
          ======================================================== */}
      <footer className="ud-footer">
        <div className="ud-footer-inner">
          <div className="ud-footer-brand">
            <div className="ud-brand-icon-sm">
              <MdFindInPage />
            </div>
            <span>
              Found <span className="ud-brand-amp">&</span> Lost Management System
            </span>
          </div>
          <p className="ud-footer-text">
            Official APSIT College Campus Portal · Built for verified student recovery
          </p>
        </div>
      </footer>

      {/* ========================================================
          6. ITEM DETAILS MODAL (Centered Popup)
          ======================================================== */}
      {selectedItem && (
        <div className="ud-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div
            className="ud-modal-card ud-details-modal animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="ud-modal-header">
              <h3 className="ud-modal-title">{selectedItem.title}</h3>
              <button
                className="ud-modal-close-btn"
                onClick={() => setSelectedItem(null)}
                title="Close"
              >
                <FiX />
              </button>
            </div>

            {/* Modal Content */}
            <div className="ud-details-body">
              {/* Left Column: Image */}
              <div className="ud-details-image-col">
                {selectedItem.image ? (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.title}
                    className="ud-details-image"
                  />
                ) : (
                  <div className="ud-details-image-placeholder">
                    <MdFindInPage className="ud-placeholder-icon" />
                    <span>No image provided</span>
                  </div>
                )}
              </div>

              {/* Right Column: Metadata */}
              <div className="ud-details-info-col">
                <div className="ud-details-header-row">
                  <h4 className="ud-details-item-name">{selectedItem.title}</h4>
                  <span
                    className={`ud-status-badge ud-status-${(
                      selectedItem.status || 'pending'
                    ).toLowerCase()}`}
                  >
                    {selectedItem.status || 'Pending'}
                  </span>
                </div>

                <div className="ud-details-meta-grid">
                  <div className="ud-details-meta-item">
                    <span className="ud-details-label">Category:</span>
                    <span className="ud-details-val">{selectedItem.category || 'N/A'}</span>
                  </div>

                  <div className="ud-details-meta-item">
                    <span className="ud-details-label">Location:</span>
                    <span className="ud-details-val">{selectedItem.location || 'Campus'}</span>
                  </div>

                  <div className="ud-details-meta-item">
                    <span className="ud-details-label">Date Reported:</span>
                    <span className="ud-details-val">
                      {new Date(selectedItem.date || selectedItem.createdAt).toLocaleDateString(
                        'en-US',
                        {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }
                      )}
                    </span>
                  </div>
                </div>

                <div className="ud-details-description-box">
                  <span className="ud-details-label">Description:</span>
                  <p className="ud-details-desc-text">
                    {selectedItem.description || 'No additional details provided.'}
                  </p>
                </div>

                {/* Reported By Section - Securely retrieved from linked MongoDB user account */}
                {user && (
                  <div className="ud-reporter-details-card">
                    <div className="ud-reporter-header">
                      <FiUser className="ud-reporter-icon" />
                      <span className="ud-reporter-title">Reported By</span>
                    </div>
                    <div className="ud-reporter-grid">
                      <div className="ud-reporter-item">
                        <span className="ud-reporter-label">Name:</span>
                        <span className="ud-reporter-val">
                          {selectedItem.reportedBy?.name || 'Campus Student'}
                        </span>
                      </div>
                      <div className="ud-reporter-item">
                        <span className="ud-reporter-label">Student ID:</span>
                        <span className="ud-reporter-val">
                          {selectedItem.reportedBy?.studentId ||
                            (selectedItem.reportedBy?.email
                              ? selectedItem.reportedBy.email.split('@')[0]
                              : 'N/A')}
                        </span>
                      </div>
                      <div className="ud-reporter-item">
                        <span className="ud-reporter-label">College Email:</span>
                        <span className="ud-reporter-val">
                          {selectedItem.reportedBy?.email || 'N/A'}
                        </span>
                      </div>
                      <div className="ud-reporter-item">
                        <span className="ud-reporter-label">Phone:</span>
                        <span className="ud-reporter-val">
                          {selectedItem.reportedBy?.phone ||
                            (selectedItem.contactInfo && selectedItem.contactInfo.includes('Phone:')
                              ? selectedItem.contactInfo.split('Phone:')[1].split('|')[0].trim()
                              : selectedItem.contactInfo) ||
                            'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action button */}
                <div className="ud-details-action-wrap">
                  {selectedItem.type === 'lost' ? (
                    <button
                      className="ud-btn-action-primary"
                      onClick={() => handleOpenClaimModal(selectedItem)}
                    >
                      I Found This Item
                    </button>
                  ) : (
                    <button
                      className="ud-btn-action-primary"
                      onClick={() => handleOpenClaimModal(selectedItem)}
                    >
                      Claim This Item
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          7. REPORT LOST ITEM MODAL
          ======================================================== */}
      {isReportModalOpen && (
        <div className="ud-modal-backdrop" onClick={handleCloseReportModal}>
          <div
            className="ud-modal-card ud-report-modal animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="ud-modal-header">
              <div>
                <h3 className="ud-modal-title">Report Lost Item</h3>
                <p className="ud-modal-subtitle">
                  Fill in the details about the item you lost on campus.
                </p>
              </div>
              <button className="ud-modal-close-btn" onClick={handleCloseReportModal} title="Close">
                <FiX />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleInitiateReportSubmit} className="ud-form">
              <div className="ud-form-grid">
                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Item Name <span className="ud-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="e.g. Laptop Bag, Casio Watch, Scientific Calculator"
                    className="ud-form-input"
                    value={reportForm.title}
                    onChange={handleReportInputChange}
                  />
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Category <span className="ud-required">*</span>
                  </label>
                  <select
                    name="category"
                    required
                    className="ud-form-select"
                    value={reportForm.category}
                    onChange={handleReportInputChange}
                  >
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="ud-form-group">
                <label className="ud-form-label">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Describe distinguishing marks, color, brand, or unique features..."
                  className="ud-form-textarea"
                  value={reportForm.description}
                  onChange={handleReportInputChange}
                />
              </div>

              <div className="ud-form-grid">
                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Date Lost <span className="ud-required">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    className="ud-form-input"
                    value={reportForm.date}
                    onChange={handleReportInputChange}
                  />
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Location Lost <span className="ud-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    required
                    placeholder="e.g. Library 2nd Floor, Canteen, Ground"
                    className="ud-form-input"
                    value={reportForm.location}
                    onChange={handleReportInputChange}
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div className="ud-form-group">
                <label className="ud-form-label">Item Image (Accepted: JPG, JPEG, PNG, Max 2MB)</label>
                <div className="ud-image-dropzone">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    id="report-item-image"
                    style={{ display: 'none' }}
                    onChange={handleReportImageChange}
                  />
                  {reportImagePreview ? (
                    <div className="ud-preview-container">
                      <img src={reportImagePreview} alt="Preview" className="ud-preview-image" />
                      <button
                        type="button"
                        className="ud-btn-remove-preview"
                        onClick={() => {
                          setReportImageFile(null);
                          setReportImagePreview(null);
                        }}
                      >
                        <FiX /> Remove
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="report-item-image" className="ud-dropzone-label">
                      <FiUploadCloud className="ud-dropzone-icon" />
                      <span className="ud-dropzone-text">Click to browse or upload item photo</span>
                      <span className="ud-dropzone-subtext">JPG, JPEG, PNG up to 2MB</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Section: Your Contact Information */}
              <div className="ud-form-section-header">
                <h4 className="ud-section-title">Your Contact Information</h4>
              </div>

              <div className="ud-form-grid-3">
                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Your Name <span className="ud-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="ud-form-input"
                    value={reportForm.name}
                    onChange={handleReportInputChange}
                  />
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Email <span className="ud-required">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="ud-form-input"
                    value={reportForm.email}
                    onChange={handleReportInputChange}
                  />
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Phone Number <span className="ud-required">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="e.g. 9876543210"
                    className="ud-form-input"
                    value={reportForm.phone}
                    onChange={handleReportInputChange}
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="ud-info-box">
                <FiMail className="ud-info-box-icon" />
                <span className="ud-info-box-text">
                  After submitting, you'll receive an OTP via email to verify your report.
                </span>
              </div>

              {/* Bottom Buttons */}
              <div className="ud-modal-footer">
                <button
                  type="button"
                  className="ud-btn-cancel"
                  onClick={handleCloseReportModal}
                  disabled={isSendingOtp}
                >
                  Cancel
                </button>
                <button type="submit" className="ud-btn-submit-green" disabled={isSendingOtp}>
                  {isSendingOtp ? 'Sending OTP...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          8. OTP EMAIL VERIFICATION MODAL
          ======================================================== */}
      {isOtpModalOpen && (
        <div className="ud-modal-backdrop" onClick={() => setIsOtpModalOpen(false)}>
          <div
            className="ud-modal-card ud-otp-modal animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ud-modal-header">
              <div>
                <h3 className="ud-modal-title">Verify Your Email</h3>
                <p className="ud-modal-subtitle">
                  We've sent a 6-digit OTP to <strong>{reportForm.email}</strong>
                </p>
              </div>
              <button
                className="ud-modal-close-btn"
                onClick={() => setIsOtpModalOpen(false)}
                title="Cancel"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleVerifyOtpAndCreateReport} className="ud-otp-form">
              <div className="ud-otp-input-wrap">
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="Enter 6-digit OTP"
                  className="ud-otp-input"
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="ud-otp-timer-row">
                {resendCooldown > 0 ? (
                  <span className="ud-cooldown-text">Resend OTP in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    className="ud-resend-btn"
                    onClick={handleResendOtp}
                    disabled={isSendingOtp}
                  >
                    Resend OTP
                  </button>
                )}
              </div>

              <div className="ud-modal-footer">
                <button
                  type="button"
                  className="ud-btn-cancel"
                  onClick={() => setIsOtpModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ud-btn-submit-green"
                  disabled={isVerifyingOtp || enteredOtp.length < 6}
                >
                  {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          SUCCESS MODAL
          ======================================================== */}
      {isSuccessModalOpen && (
        <div className="ud-modal-backdrop">
          <div className="ud-modal-card ud-success-modal animate-scaleUp">
            <div className="ud-success-icon-wrap">
              <FiCheckCircle className="ud-success-check-icon" />
            </div>
            <h3 className="ud-success-title">Success!</h3>
            <p className="ud-success-desc">Your lost item has been reported successfully!</p>
            <button className="ud-btn-submit-green ud-btn-ok" onClick={handleCloseSuccessModal}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          9. REPORT FOUND ITEM / CLAIM MODAL
          ======================================================== */}
      {isClaimModalOpen && (
        <div className="ud-modal-backdrop" onClick={() => setIsClaimModalOpen(false)}>
          <div
            className="ud-modal-card ud-claim-modal animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ud-modal-header">
              <div>
                <h3 className="ud-modal-title">
                  {claimTargetItem?.type === 'lost' ? 'Report Found Item' : 'Claim Item'}
                </h3>
                {claimTargetItem && (
                  <p className="ud-modal-subtitle">
                    Regarding: <strong>{claimTargetItem.title}</strong>
                  </p>
                )}
              </div>
              <button
                className="ud-modal-close-btn"
                onClick={() => setIsClaimModalOpen(false)}
                title="Close"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="ud-form">
              <div className="ud-form-grid">
                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Full Name <span className="ud-required">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    className="ud-form-input"
                    value={claimForm.fullName}
                    onChange={handleClaimInputChange}
                  />
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Email Address <span className="ud-required">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="ud-form-input"
                    value={claimForm.email}
                    onChange={handleClaimInputChange}
                  />
                </div>
              </div>

              <div className="ud-form-group">
                <label className="ud-form-label">
                  Phone Number <span className="ud-required">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  placeholder="e.g. 9876543210"
                  className="ud-form-input"
                  value={claimForm.phone}
                  onChange={handleClaimInputChange}
                />
              </div>

              {/* Found Item Image / Proof Upload */}
              <div className="ud-form-group">
                <label className="ud-form-label">Found Item Image / Proof Photo</label>
                <span className="ud-helper-text">
                  Upload any documents or photos that prove this item belongs to you or was found by
                  you.
                </span>
                <div className="ud-image-dropzone">
                  <input
                    type="file"
                    accept="image/*"
                    id="claim-proof-image"
                    style={{ display: 'none' }}
                    onChange={handleClaimImageChange}
                  />
                  {claimImagePreview ? (
                    <div className="ud-preview-container">
                      <img src={claimImagePreview} alt="Proof" className="ud-preview-image" />
                      <button
                        type="button"
                        className="ud-btn-remove-preview"
                        onClick={() => {
                          setClaimImageFile(null);
                          setClaimImagePreview(null);
                        }}
                      >
                        <FiX /> Remove
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="claim-proof-image" className="ud-dropzone-label">
                      <FiUploadCloud className="ud-dropzone-icon" />
                      <span className="ud-dropzone-text">Click to upload photo or proof document</span>
                      <span className="ud-dropzone-subtext">JPG, PNG under 2MB</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="ud-form-group">
                <label className="ud-form-label">Additional Details</label>
                <textarea
                  name="additionalDetails"
                  rows={3}
                  placeholder="Provide any additional information that can help verify your claim..."
                  className="ud-form-textarea"
                  value={claimForm.additionalDetails}
                  onChange={handleClaimInputChange}
                />
              </div>

              <div className="ud-modal-footer">
                <button
                  type="button"
                  className="ud-btn-cancel"
                  onClick={() => setIsClaimModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ud-btn-submit-green" disabled={isSubmittingClaim}>
                  {isSubmittingClaim ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
