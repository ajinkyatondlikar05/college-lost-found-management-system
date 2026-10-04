import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllItems, createItem, createClaim, recoverItem, rejectFinderClaim, sendReportOtp, verifyReportOtp, getImageUrl } from '../api';
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
  FiFilter,
} from 'react-icons/fi';
import { MdFindInPage } from 'react-icons/md';
import './Dashboard.css';
import OwnerRecoveryOtpModal from '../components/OwnerRecoveryOtpModal';

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

  // Mobile filters drawer
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTargetItemId, setRejectTargetItemId] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false); // Report Lost Item modal
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false); // Report Found Item / Claim modal
  const [claimTargetItem, setClaimTargetItem] = useState(null);
  const [claimStep, setClaimStep] = useState('form'); // 'form' | 'otp' | 'success'
  const [claimErrors, setClaimErrors] = useState({});
  const [claimOtp, setClaimOtp] = useState('');
  const [claimOtpError, setClaimOtpError] = useState('');
  const [claimResendCooldown, setClaimResendCooldown] = useState(0);
  const [isClaimSendingOtp, setIsClaimSendingOtp] = useState(false);
  const [isClaimVerifyingOtp, setIsClaimVerifyingOtp] = useState(false);

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

  // Close user dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
  useEffect(() => {
    let timer;
    if (claimResendCooldown > 0) {
      timer = setInterval(() => {
        setClaimResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [claimResendCooldown]);

  const handleOpenClaimModal = (item) => {
    setClaimTargetItem(item);
    setSelectedItem(null); // Close detail modal
    setClaimStep('form');
    setClaimErrors({});
    setClaimOtp('');
    setClaimOtpError('');
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

  const handleCloseClaimModal = () => {
    setIsClaimModalOpen(false);
    setClaimTargetItem(null);
    setClaimStep('form');
    setClaimImageFile(null);
    setClaimImagePreview(null);
    setClaimErrors({});
    setClaimOtp('');
    setClaimOtpError('');
  };

  const handleClaimInputChange = (e) => {
    const { name, value } = e.target;
    setClaimForm((prev) => ({ ...prev, [name]: value }));
    setClaimErrors((prev) => ({ ...prev, [name]: '' }));
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
      setClaimErrors((prev) => ({ ...prev, image: '' }));
    }
  };

  const validateClaimForm = () => {
    const errs = {};
    const trimmedName = (claimForm.fullName || '').trim();
    if (!trimmedName) {
      errs.fullName = 'Full Name is required';
    } else if (trimmedName.length < 2) {
      errs.fullName = 'Full Name must be at least 2 characters long';
    }

    // ============================================================================
    // PERMANENT PRODUCTION / DEMO FINDER EXCEPTION (ajinkyatondlikar@gmail.com)
    // ============================================================================
    const DEMO_FINDER_EMAIL = (import.meta.env.VITE_DEMO_LOGIN_EMAIL || import.meta.env.VITE_TEMP_TEST_LOGIN_EMAIL || 'ajinkyatondlikar@gmail.com').trim().toLowerCase();
    const isAllowedFinderEmail = (e) => {
      if (!e) return false;
      const normalized = e.trim().toLowerCase();
      return normalized.endsWith('@apsit.edu.in') || normalized === DEMO_FINDER_EMAIL;
    };
    // ============================================================================

    const trimmedEmail = (claimForm.email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      errs.email = 'College Email Address is required';
    } else if (!isAllowedFinderEmail(trimmedEmail)) {
      errs.email = 'Email must end with @apsit.edu.in';
    }

    const cleanPhone = (claimForm.phone || '').trim().replace(/[\s\-\(\)]/g, '').replace(/^(\+91|0)/, '');
    if (!cleanPhone) {
      errs.phone = 'Phone Number is required';
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Please enter a valid 10-digit Indian mobile number (starting with 6-9)';
    }

    if (!claimImageFile) {
      errs.image = 'Found Item Image / Proof Photo is required';
    }

    const trimmedDetails = (claimForm.additionalDetails || '').trim();
    if (!trimmedDetails) {
      errs.additionalDetails = 'Additional details describing where/how you found the item are required';
    }

    setClaimErrors(errs);
    return {
      isValid: Object.keys(errs).length === 0,
      cleanName: trimmedName,
      cleanEmail: trimmedEmail,
      cleanPhone,
      cleanDetails: trimmedDetails,
    };
  };

  const handleProceedToClaimOtp = async (e) => {
    e.preventDefault();
    const { isValid, cleanEmail, cleanName } = validateClaimForm();
    if (!isValid) {
      toast.error('Please fix the errors in the form before proceeding');
      return;
    }

    try {
      setIsClaimSendingOtp(true);
      const res = await sendReportOtp({
        email: cleanEmail,
        name: cleanName,
        type: 'found',
      });
      setClaimStep('otp');
      setClaimResendCooldown(60);
      setClaimOtp('');
      setClaimOtpError('');
      toast.success(res.data?.message || `We've sent a 6-digit OTP to ${cleanEmail}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification OTP. Please try again.';
      setClaimOtpError(msg);
      toast.error(msg);
    } finally {
      setIsClaimSendingOtp(false);
    }
  };

  const handleResendClaimOtp = async () => {
    if (claimResendCooldown > 0 || isClaimSendingOtp) return;
    try {
      setIsClaimSendingOtp(true);
      const cleanEmail = (claimForm.email || '').trim().toLowerCase();
      const cleanName = (claimForm.fullName || '').trim();
      const res = await sendReportOtp({
        email: cleanEmail,
        name: cleanName,
        type: 'found',
      });
      setClaimResendCooldown(60);
      toast.success(res.data?.message || `We've sent a new 6-digit OTP to ${cleanEmail}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setIsClaimSendingOtp(false);
    }
  };

  const handleVerifyAndSubmitClaim = async (e) => {
    e.preventDefault();
    const cleanOtp = claimOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setClaimOtpError('Please enter the 6-digit OTP');
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    const { isValid, cleanName, cleanEmail, cleanPhone, cleanDetails } = validateClaimForm();
    if (!isValid) {
      setClaimStep('form');
      toast.error('Please ensure all required fields are filled');
      return;
    }

    try {
      setIsClaimVerifyingOtp(true);
      await verifyReportOtp({
        email: cleanEmail,
        otp: cleanOtp,
      });

      const formData = new FormData();
      if (claimTargetItem?._id) {
        formData.append('itemId', claimTargetItem._id);
        formData.append('itemName', claimTargetItem.title);
      } else {
        formData.append('itemName', 'Unspecified Found Item');
      }
      formData.append('fullName', cleanName);
      formData.append('email', cleanEmail);
      formData.append('phone', cleanPhone);
      formData.append('additionalDetails', cleanDetails);
      formData.append('finderMessage', cleanDetails);
      formData.append('otp', cleanOtp);
      if (claimImageFile) {
        formData.append('image', claimImageFile);
      }

      await createClaim(formData);

      const ownerName = claimTargetItem?.reportedBy?.name || 'Owner';
      setClaimStep('success');
      toast.success(`Found Item Report Submitted Successfully! ${ownerName} has been notified by email.`, { duration: 6000 });
      fetchItems();
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification or claim submission failed';
      setClaimOtpError(msg);
      toast.error(msg);
    } finally {
      setIsClaimVerifyingOtp(false);
    }
  };

  const [recoveryTargetItemId, setRecoveryTargetItemId] = useState(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  const handleRecoverItem = (itemId) => {
    setRecoveryTargetItemId(itemId);
    setIsRecoveryModalOpen(true);
  };

  const handleRejectFinderClaim = async () => {
    if (!rejectTargetItemId) return;
    try {
      setIsRejecting(true);
      await rejectFinderClaim(rejectTargetItemId);
      toast.success('Finder report has been rejected. The item is now open for new finder reports.');
      setIsRejectModalOpen(false);
      setSelectedItem(null);
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject finder report');
    } finally {
      setIsRejecting(false);
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
          <div
            className="ud-brand"
            onClick={(e) => {
              if (window.innerWidth <= 768) {
                e.preventDefault();
                return;
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
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
                type="button"
                className="ud-user-pill-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen((prev) => !prev);
                }}
                title={user?.email}
                aria-expanded={userMenuOpen}
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
                    type="button"
                    className="ud-dropdown-action ud-logout-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      logoutUser();
                      navigate('/', { replace: true });
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
          {/* Mobile Filter Backdrop */}
          {mobileFiltersOpen && (
            <div
              className="ud-filter-backdrop"
              onClick={() => setMobileFiltersOpen(false)}
              aria-label="Close filter drawer"
            />
          )}

          {/* FILTER SIDEBAR (White Rounded Panel / Mobile Drawer) */}
          <aside className={`ud-filter-sidebar ${mobileFiltersOpen ? 'mobile-drawer-open' : ''}`}>
            <div className="ud-filter-header">
              <div className="ud-filter-header-left">
                <h2 className="ud-filter-title">Filters</h2>
                <button className="ud-filter-clear-btn" onClick={handleClearFilters}>
                  Clear
                </button>
              </div>
              <button
                type="button"
                className="ud-filter-close-btn"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filters"
              >
                <FiX />
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
              <div className="ud-items-header-left">
                <button
                  type="button"
                  className="ud-mobile-filter-trigger"
                  onClick={() => setMobileFiltersOpen(true)}
                  aria-label="Open Filters"
                >
                  <FiFilter className="ud-filter-icon" /> Filters
                  {(selectedCategory !== 'All Categories' || locationFilter || fromDate || toDate) && (
                    <span className="ud-filter-active-dot" />
                  )}
                </button>
                <span className="ud-items-count-text">
                  Showing <strong>{items.length}</strong> {activeTab} items
                </span>
              </div>
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
                            src={getImageUrl(item.image)}
                            alt={item.title}
                            className="ud-card-image"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="ud-card-image-fallback"
                          style={{ display: item.image ? 'none' : 'flex' }}
                        >
                          <MdFindInPage className="ud-fallback-icon" />
                          <span>{item.category}</span>
                        </div>
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
                    src={getImageUrl(selectedItem.image)}
                    alt={selectedItem.title}
                    className="ud-details-image"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.nextElementSibling) {
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <div
                  className="ud-details-image-placeholder"
                  style={{ display: selectedItem.image ? 'none' : 'flex' }}
                >
                  <MdFindInPage className="ud-placeholder-icon" />
                  <span>{selectedItem.image ? 'Image unavailable' : 'No image provided'}</span>
                </div>
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

                {/* Found By and Action Buttons */}
                {(() => {
                  const selReportedById = selectedItem.reportedBy?._id || selectedItem.reportedBy;
                  const isActualOwner = Boolean(user && selReportedById && String(selReportedById) === String(user._id));
                  const isOwner = isActualOwner || user?.role === 'admin';
                  const isLost = selectedItem.type === 'lost';
                  const isResolved = (selectedItem.status || '').toLowerCase() === 'resolved';

                  const activeClaim = selectedItem.claims?.find(
                    (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
                  );

                  const hasActiveFinder = Boolean(selectedItem.foundBy || activeClaim);
                  const finderName = activeClaim?.fullName || selectedItem.foundBy?.name || activeClaim?.finder?.name || 'A Student';
                  const foundDate = activeClaim?.createdAt || selectedItem.updatedAt || selectedItem.createdAt;
                  const formattedFoundDate = foundDate ? new Date(foundDate).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }) : 'Recently';

                  return (
                    <>
                      {/* Active Finder / Found By State */}
                      {hasActiveFinder && isLost && !isResolved && (
                        <div
                          className="ud-found-by-card"
                          style={{
                            marginTop: '1.25rem',
                            marginBottom: '1rem',
                            padding: '1.1rem',
                            background: '#f0fdf4',
                            border: '1.5px solid #86efac',
                            borderRadius: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 800, fontSize: '0.92rem' }}>
                              <FiCheckCircle style={{ fontSize: '1.2rem', strokeWidth: 2.5 }} /> FOUND BY
                            </div>
                            <span
                              style={{
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '9999px',
                              }}
                            >
                              Finder Reported
                            </span>
                          </div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '3px' }}>
                            {finderName}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: (isActualOwner || user?.role === 'admin') ? '10px' : '0' }}>
                            Found on: {formattedFoundDate}
                          </div>

                          {(isActualOwner || user?.role === 'admin') && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                              {(activeClaim?.finderMessage || activeClaim?.additionalDetails) && (
                                <div style={{ marginBottom: '6px', fontSize: '0.88rem', color: '#334155' }}>
                                  <strong>Finder Message:</strong> "{activeClaim.finderMessage || activeClaim.additionalDetails}"
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.85rem', color: '#334155' }}>
                                {(activeClaim?.email || selectedItem.foundBy?.email) && (
                                  <div>
                                    <strong>Email:</strong>{' '}
                                    <a href={`mailto:${activeClaim?.email || selectedItem.foundBy?.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                      {activeClaim?.email || selectedItem.foundBy?.email}
                                    </a>
                                  </div>
                                )}
                                {(activeClaim?.phone || selectedItem.foundBy?.phone) && (
                                  <div>
                                    <strong>Phone:</strong>{' '}
                                    <a href={`tel:${activeClaim?.phone || selectedItem.foundBy?.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                      {activeClaim?.phone || selectedItem.foundBy?.phone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action button */}
                      <div className="ud-details-action-wrap">
                        {isResolved ? (
                          <span className="ud-status-badge ud-status-resolved" style={{ padding: '8px 16px', fontSize: '13px' }}>
                            ✓ This item has been recovered and resolved.
                          </span>
                        ) : isOwner ? (
                          isLost ? (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                className="ud-btn-action-primary"
                                style={{ background: '#10b981', borderColor: '#10b981' }}
                                onClick={() => handleRecoverItem(selectedItem._id)}
                              >
                                I Got My Item Back
                              </button>
                              {hasActiveFinder && (
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '13px' }}
                                  onClick={() => {
                                    setRejectTargetItemId(selectedItem._id);
                                    setIsRejectModalOpen(true);
                                  }}
                                >
                                  This Is Not My Item
                                </button>
                              )}
                            </div>
                          ) : null
                        ) : user ? (
                          isLost ? (
                            !hasActiveFinder ? (
                              <button
                                className="ud-btn-action-primary"
                                onClick={() => handleOpenClaimModal(selectedItem)}
                              >
                                I Found This Item
                              </button>
                            ) : null
                          ) : (
                            <button
                              className="ud-btn-action-primary"
                              onClick={() => handleOpenClaimModal(selectedItem)}
                            >
                              Claim This Item
                            </button>
                          )
                        ) : null}
                      </div>
                    </>
                  );
                })()}
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
        <div className="ud-modal-backdrop" onClick={handleCloseClaimModal}>
          <div
            className="ud-modal-card ud-claim-modal animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ud-modal-header">
              <div>
                <h3 className="ud-modal-title">
                  {claimStep === 'otp'
                    ? 'Verify Your Email'
                    : claimStep === 'success'
                    ? 'Report Submitted'
                    : claimTargetItem?.type === 'lost'
                    ? 'Report Found Item'
                    : 'Claim Item'}
                </h3>
                {claimTargetItem && (
                  <p className="ud-modal-subtitle">
                    {claimStep === 'otp' ? (
                      <>We've sent a 6-digit OTP to <strong>{claimForm.email}</strong></>
                    ) : (
                      <>Regarding: <strong>{claimTargetItem.title}</strong></>
                    )}
                  </p>
                )}
              </div>
              <button
                className="ud-modal-close-btn"
                onClick={handleCloseClaimModal}
                title="Close"
              >
                <FiX />
              </button>
            </div>

            {claimStep === 'form' && (
              <form onSubmit={handleProceedToClaimOtp} className="ud-form">
                <div className="ud-form-grid">
                  <div className="ud-form-group">
                    <label className="ud-form-label">
                      Full Name <span className="ud-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      placeholder="Your full name"
                      className="ud-form-input"
                      value={claimForm.fullName}
                      onChange={handleClaimInputChange}
                    />
                    {claimErrors.fullName && (
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                        {claimErrors.fullName}
                      </span>
                    )}
                  </div>

                  <div className="ud-form-group">
                    <label className="ud-form-label">
                      College Email Address <span className="ud-required">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="e.g. 24107000@apsit.edu.in"
                      className="ud-form-input"
                      value={claimForm.email}
                      onChange={handleClaimInputChange}
                    />
                    {claimErrors.email && (
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                        {claimErrors.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Phone Number <span className="ud-required">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="10-digit mobile number (e.g. 9876543210)"
                    className="ud-form-input"
                    value={claimForm.phone}
                    onChange={handleClaimInputChange}
                  />
                  {claimErrors.phone && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                      {claimErrors.phone}
                    </span>
                  )}
                </div>

                {/* Found Item Image / Proof Upload (Required) */}
                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Found Item Image / Proof Photo <span className="ud-required">*</span>
                  </label>
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
                        <span className="ud-dropzone-text">Click to upload found item photo</span>
                        <span className="ud-dropzone-subtext">JPG, PNG under 2MB</span>
                      </label>
                    )}
                  </div>
                  {claimErrors.image && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                      {claimErrors.image}
                    </span>
                  )}
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Additional Details <span className="ud-required">*</span>
                  </label>
                  <textarea
                    name="additionalDetails"
                    rows={3}
                    placeholder="Describe where or how you found the item, and how the owner can collect it from you..."
                    className="ud-form-textarea"
                    value={claimForm.additionalDetails}
                    onChange={handleClaimInputChange}
                  />
                  {claimErrors.additionalDetails && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                      {claimErrors.additionalDetails}
                    </span>
                  )}
                </div>

                <div className="ud-modal-footer">
                  <button
                    type="button"
                    className="ud-btn-cancel"
                    onClick={handleCloseClaimModal}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="ud-btn-submit-green" disabled={isClaimSendingOtp}>
                    {isClaimSendingOtp ? 'Sending OTP...' : 'Send Verification OTP'}
                  </button>
                </div>
              </form>
            )}

            {claimStep === 'otp' && (
              <form onSubmit={handleVerifyAndSubmitClaim} className="ud-form">
                <div className="ud-form-group" style={{ textAlign: 'center' }}>
                  <label className="ud-form-label" style={{ marginBottom: '8px' }}>
                    Enter 6-Digit OTP <span className="ud-required">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="••••••"
                    className="ud-form-input"
                    style={{
                      letterSpacing: '6px',
                      fontSize: '1.4rem',
                      textAlign: 'center',
                      fontWeight: 700,
                      maxWidth: '240px',
                      margin: '0 auto',
                    }}
                    value={claimOtp}
                    onChange={(e) => {
                      setClaimOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setClaimOtpError('');
                    }}
                    autoFocus
                  />
                  {claimOtpError && (
                    <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                      {claimOtpError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Didn't receive the OTP?
                  </span>
                  <button
                    type="button"
                    disabled={claimResendCooldown > 0 || isClaimSendingOtp}
                    onClick={handleResendClaimOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: claimResendCooldown > 0 ? '#94a3b8' : '#2563eb',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: claimResendCooldown > 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {claimResendCooldown > 0 ? `Resend in ${claimResendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>

                <div className="ud-modal-footer">
                  <button
                    type="button"
                    className="ud-btn-cancel"
                    onClick={() => setClaimStep('form')}
                    disabled={isClaimVerifyingOtp}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="ud-btn-submit-green"
                    disabled={isClaimVerifyingOtp}
                  >
                    {isClaimVerifyingOtp ? 'Verifying & Submitting...' : 'Confirm & Submit'}
                  </button>
                </div>
              </form>
            )}

            {claimStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    fontSize: '32px',
                  }}
                >
                  ✓
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Found Item Report Submitted Successfully
                </h3>
                <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '24px' }}>
                  <strong>{claimTargetItem?.reportedBy?.name || 'Ajinkya'}</strong> has been notified by email.
                </p>
                <button
                  type="button"
                  className="ud-btn-submit-green"
                  style={{ width: '100%' }}
                  onClick={handleCloseClaimModal}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog: "This Is Not My Item" (Requirement 2) */}
      {isRejectModalOpen && (
        <div className="ud-modal-backdrop" onClick={() => !isRejecting && setIsRejectModalOpen(false)}>
          <div
            className="ud-modal-card animate-scaleUp"
            style={{ maxWidth: '440px', textAlign: 'center', padding: '24px 20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '28px',
              }}
            >
              <FiX />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Are you sure this is not your item?
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '24px', lineHeight: 1.5 }}>
              Rejecting this report will clear the current finder and make your lost item available for new reports by other students.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ud-btn-cancel"
                style={{ minWidth: '110px' }}
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isRejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ minWidth: '180px', padding: '10px 18px', borderRadius: '8px', fontWeight: 600 }}
                onClick={handleRejectFinderClaim}
                disabled={isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Yes, This Is Not My Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Recovery OTP Verification Modal */}
      <OwnerRecoveryOtpModal
        isOpen={isRecoveryModalOpen}
        onClose={() => {
          setIsRecoveryModalOpen(false);
          setRecoveryTargetItemId(null);
        }}
        itemId={recoveryTargetItemId}
        itemTitle={selectedItem?.title}
        onSuccess={() => {
          setSelectedItem(null);
          fetchItems();
        }}
      />
    </div>
  );
}
