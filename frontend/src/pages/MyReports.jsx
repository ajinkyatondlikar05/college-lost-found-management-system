import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReports, deleteItem, getImageUrl, recoverItem, rejectFinderClaim } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiPrinter,
  FiSearch,
  FiCalendar,
  FiMapPin,
  FiClock,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiEye,
  FiTrash2,
  FiX,
  FiRefreshCw,
  FiTag,
  FiUser,
  FiMail,
  FiPhone,
  FiShield,
  FiArrowRight,
  FiInbox,
  FiPlusCircle,
  FiCheck,
} from 'react-icons/fi';
import './MyReports.css';
import OwnerRecoveryOtpModal from '../components/OwnerRecoveryOtpModal';
import { getItemPrimaryStatus, buildReportTimeline } from '../utils/reportCardUtils';

const categoryIcons = {
  Electronics: '💻',
  'Books & Notes': '📚',
  Clothing: '👕',
  Accessories: '⌚',
  'ID & Cards': '🪪',
  Keys: '🔑',
  Bags: '🎒',
  'Sports Equipment': '⚽',
  Stationery: '✏️',
  Other: '📦',
};

export default function MyReports() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals & Print
  const [selectedItem, setSelectedItem] = useState(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTargetItemId, setRejectTargetItemId] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [printMode, setPrintMode] = useState(null); // 'single' | 'history' | null
  const [itemToPrint, setItemToPrint] = useState(null);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  const fetchReports = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getMyReports();
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching reports:', err);
      toast.error('Failed to load your reports');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Summary counts calculated from real MongoDB data
  const totalCount = items.length;
  const lostCount = items.filter((i) => i.type?.toLowerCase() === 'lost').length;
  const foundCount = items.filter((i) => i.type?.toLowerCase() === 'found').length;
  const activeCount = items.filter((i) => {
    const s = (i.status || '').toLowerCase();
    return s === 'active' || s === 'pending';
  }).length;
  const claimedCount = items.filter((i) => (i.status || '').toLowerCase() === 'claimed').length;
  const resolvedCount = items.filter((i) => (i.status || '').toLowerCase() === 'resolved').length;
  const resolvedOrClaimedCount = claimedCount + resolvedCount;

  // Filter & Search Logic
  const filteredItems = items.filter((item) => {
    const s = (item.status || '').toLowerCase();
    const t = (item.type || '').toLowerCase();

    // Tab filter
    if (activeTab === 'lost' && t !== 'lost') return false;
    if (activeTab === 'found' && t !== 'found') return false;
    if (activeTab === 'active' && !(s === 'active' || s === 'pending')) return false;
    if (activeTab === 'claimed' && s !== 'claimed') return false;
    if (activeTab === 'resolved' && s !== 'resolved') return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchCat = (item.category || '').toLowerCase().includes(q);
      const matchLoc = (item.location || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCat && !matchLoc && !matchDesc) return false;
    }

    // Date range filter
    const itemDate = item.date ? new Date(item.date) : new Date(item.createdAt);
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (itemDate < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (itemDate > to) return false;
    }

    return true;
  });

  const clearFilters = () => {
    setActiveTab('all');
    setSearchTerm('');
    setFromDate('');
    setToDate('');
  };

  // Delete handling
  const handleDeleteClick = (item) => {
    const s = (item.status || '').toLowerCase();
    if (s === 'resolved' || s === 'claimed') {
      toast.error('Resolved and claimed reports cannot be deleted to preserve college history.');
      return;
    }
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await deleteItem(deleteConfirmItem._id);
      setItems((prev) => prev.filter((i) => i._id !== deleteConfirmItem._id));
      toast.success('Report deleted successfully');
      setDeleteConfirmItem(null);
      if (selectedItem && selectedItem._id === deleteConfirmItem._id) {
        setSelectedItem(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete report');
    }
  };

  const [recoveryTargetItem, setRecoveryTargetItem] = useState(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  const handleRecover = (itemOrId) => {
    const target = typeof itemOrId === 'object' && itemOrId !== null
      ? itemOrId
      : items.find((i) => i._id === itemOrId) || { _id: itemOrId };
    setRecoveryTargetItem(target);
    setIsRecoveryModalOpen(true);
  };

  const handleRejectFinder = async () => {
    if (!rejectTargetItemId) return;
    try {
      setIsRejecting(true);
      await rejectFinderClaim(rejectTargetItemId);
      toast.success('Finder report has been rejected. The item is now open for new finder reports.');
      setIsRejectModalOpen(false);
      setRejectTargetItemId(null);
      if (selectedItem && selectedItem._id === rejectTargetItemId) {
        setSelectedItem(null);
      }
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject finder report');
    } finally {
      setIsRejecting(false);
    }
  };

  // Print handlers
  const handlePrintSingle = (item) => {
    if (!item) return;
    setItemToPrint(item);
    setPrintMode('single');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintHistory = async () => {
    setItemToPrint(null);
    setPrintMode('history');
    try {
      const res = await getMyReports();
      if (Array.isArray(res.data) && res.data.length > 0) {
        setItems(res.data);
      }
    } catch (err) {
      console.warn('Could not refresh reports before printing history:', err);
    }
    setTimeout(() => {
      window.print();
    }, 150);
  };

  useEffect(() => {
    const handleBeforePrint = () => {
      setPrintMode((prev) => {
        if (prev) return prev;
        return selectedItem ? 'single' : 'history';
      });
      if (!itemToPrint && selectedItem) {
        setItemToPrint(selectedItem);
      }
    };
    const handleAfterPrint = () => {
      setPrintMode(null);
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [selectedItem, itemToPrint]);

  // Helper date formatter
  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      const dateObj = new Date(d);
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (d) => {
    if (!d) return 'N/A';
    try {
      const dateObj = new Date(d);
      return dateObj.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  const getSimpleStatusBadge = (item) => {
    if (!item) return { text: 'ACTIVE', cls: 'status-active' };
    const s = (item.status || '').toLowerCase();
    const cs = (item.claimStatus || (item.claims && item.claims[0]?.status) || '').toLowerCase();
    const hasAdminRejected = (item.claims && item.claims.some((c) => c.status === 'Admin Rejected')) || cs === 'admin rejected';

    if (s === 'resolved' || s === 'claimed') {
      return { text: 'RESOLVED', cls: 'status-resolved' };
    }
    if (hasAdminRejected) {
      return { text: 'ADMIN REJECTED', cls: 'status-rejected' };
    }
    if (item.foundBy || ['contacted', 'pending owner confirmation'].includes(cs)) {
      return { text: 'FOUND BY', cls: 'status-found-by' };
    }
    if (cs === 'rejected') {
      return { text: 'REJECTED', cls: 'status-rejected' };
    }
    if (s === 'active' && !item.type) {
      return { text: 'ACTIVE', cls: 'status-active' };
    }
    if ((item.type || '').toLowerCase() === 'lost') {
      return { text: 'LOST', cls: 'status-lost' };
    }
    if ((item.type || '').toLowerCase() === 'found') {
      return { text: 'FOUND', cls: 'status-found' };
    }
    return { text: (item.status || 'ACTIVE').toUpperCase(), cls: 'status-active' };
  };

  // Fallback student info from user context or item data
  const studentName = user?.name || items[0]?.reportedBy?.name || 'Logged-in Student';
  const studentId = user?.studentId || user?.email?.split('@')[0] || items[0]?.reportedBy?.studentId || 'N/A';
  const studentEmail = user?.email || items[0]?.reportedBy?.email || 'N/A';
  const studentPhone = user?.phone || items[0]?.reportedBy?.phone || 'N/A';

  return (
    <div className="history-page-wrapper">
      <div className="container history-container">
        {/* ========================================================
            PAGE HEADER
        ======================================================== */}
        <div className="history-page-header">
          <div className="header-titles">
            <h1 className="history-title">My Lost & Found History</h1>
            <p className="history-subtitle">View and manage all your lost and found reports.</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-refresh"
              onClick={() => fetchReports(true)}
              title="Refresh reports"
              disabled={refreshing}
            >
              <FiRefreshCw className={refreshing ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
            <button
              className="btn-print-history"
              onClick={handlePrintHistory}
              disabled={items.length === 0}
            >
              <FiPrinter />
              <span>Print History</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            SUMMARY CARDS (Calculated from MongoDB)
        ======================================================== */}
        <div className="summary-grid">
          <div className="summary-card total-card">
            <div className="summary-card-inner">
              <span className="summary-label">Total Reports</span>
              <span className="summary-number">{totalCount}</span>
            </div>
            <div className="summary-icon-wrap icon-purple">
              <FiFileText />
            </div>
          </div>

          <div className="summary-card lost-card">
            <div className="summary-card-inner">
              <span className="summary-label">Lost Reports</span>
              <span className="summary-number">{lostCount}</span>
            </div>
            <div className="summary-icon-wrap icon-red">
              <FiAlertCircle />
            </div>
          </div>

          <div className="summary-card found-card">
            <div className="summary-card-inner">
              <span className="summary-label">Found Reports</span>
              <span className="summary-number">{foundCount}</span>
            </div>
            <div className="summary-icon-wrap icon-green">
              <FiCheckCircle />
            </div>
          </div>

          <div className="summary-card active-card">
            <div className="summary-card-inner">
              <span className="summary-label">Active Reports</span>
              <span className="summary-number">{activeCount}</span>
            </div>
            <div className="summary-icon-wrap icon-blue">
              <FiClock />
            </div>
          </div>

          <div className="summary-card resolved-card">
            <div className="summary-card-inner">
              <span className="summary-label">Resolved / Claimed</span>
              <span className="summary-number">{resolvedOrClaimedCount}</span>
            </div>
            <div className="summary-icon-wrap icon-emerald">
              <FiShield />
            </div>
          </div>
        </div>

        {/* ========================================================
            FILTERS & SEARCH BAR
        ======================================================== */}
        <div className="filter-controls-card">
          <div className="filter-pills-row">
            <button
              className={`pill-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All <span className="pill-badge">{totalCount}</span>
            </button>
            <button
              className={`pill-btn ${activeTab === 'lost' ? 'active' : ''}`}
              onClick={() => setActiveTab('lost')}
            >
              Lost <span className="pill-badge">{lostCount}</span>
            </button>
            <button
              className={`pill-btn ${activeTab === 'found' ? 'active' : ''}`}
              onClick={() => setActiveTab('found')}
            >
              Found <span className="pill-badge">{foundCount}</span>
            </button>
            <button
              className={`pill-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              Active <span className="pill-badge">{activeCount}</span>
            </button>
            <button
              className={`pill-btn ${activeTab === 'claimed' ? 'active' : ''}`}
              onClick={() => setActiveTab('claimed')}
            >
              Claimed <span className="pill-badge">{claimedCount}</span>
            </button>
            <button
              className={`pill-btn ${activeTab === 'resolved' ? 'active' : ''}`}
              onClick={() => setActiveTab('resolved')}
            >
              Resolved <span className="pill-badge">{resolvedCount}</span>
            </button>
          </div>

          <div className="filter-inputs-row">
            <div className="search-input-wrapper">
              <FiSearch className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search by item name, category, location, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
                  <FiX />
                </button>
              )}
            </div>

            <div className="date-filter-group">
              <div className="date-field">
                <label>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="date-input"
                />
              </div>
              <div className="date-field">
                <label>To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="date-input"
                />
              </div>
            </div>

            {(activeTab !== 'all' || searchTerm || fromDate || toDate) && (
              <button className="btn-clear-filters" onClick={clearFilters}>
                <FiXCircle /> Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* ========================================================
            REPORTS LIST / EMPTY STATE
        ======================================================== */}
        {loading ? (
          <div className="loading-state-box">
            <div className="spinner"></div>
            <p>Loading your Lost & Found history...</p>
          </div>
        ) : items.length === 0 ? (
          /* Student has NO reports created yet */
          <div className="empty-history-box">
            <div className="empty-icon-circle">
              <FiInbox />
            </div>
            <h2>No reports yet</h2>
            <p>Your lost and found reports will appear here once you submit one.</p>
            <div className="empty-actions">
              <Link to="/report-lost" className="btn-empty-lost">
                <FiAlertCircle /> Report Lost Item
              </Link>
              <Link to="/report-found" className="btn-empty-found">
                <FiPlusCircle /> Report Found Item
              </Link>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          /* Filter returned 0 results */
          <div className="empty-filter-box">
            <FiSearch size={40} />
            <h3>No matching reports found</h3>
            <p>Try adjusting your search keywords, status filter, or date range.</p>
            <button className="btn-reset-filters" onClick={clearFilters}>
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="report-history-list">
            {filteredItems.map((item) => {
              const isLost = (item.type || '').toLowerCase() === 'lost';
              const rawStatus = (item.status || 'Active').toUpperCase();
              const categoryIcon = categoryIcons[item.category] || '📦';
              const latestClaim = item.latestClaim || (item.claims && item.claims[0]) || null;
              const claimStatus = item.claimStatus || (latestClaim ? latestClaim.status : null);
              const primaryStatus = getItemPrimaryStatus(item);
              const isRecovered = primaryStatus.state === 'recovered';
              const timelineSteps = buildReportTimeline(item);

              return (
                <div key={item._id} className="history-report-card">
                  {/* Clean Card Top Row: [Current Status] on left, [Category] on right (No Report ID, No Contradictory Badges) */}
                  <div className="card-top-row">
                    <div className="card-top-status">
                      <span className={`primary-status-badge ${primaryStatus.badgeClass}`}>
                        {primaryStatus.label}
                      </span>
                    </div>
                    <div className="card-top-category">
                      <span className="item-category-tag">
                        {categoryIcon} {item.category}
                      </span>
                    </div>
                  </div>

                  <div className="card-main-content">
                    {/* Item Image: Substantially larger thumbnail with aspect-ratio, contain fit, click to preview full image */}
                    <div
                      className="item-thumbnail-wrap"
                      onClick={() => {
                        if (item.image) {
                          setPreviewImageModal({
                            src: getImageUrl(item.image),
                            alt: item.title,
                          });
                        }
                      }}
                      style={{ cursor: item.image ? 'pointer' : 'default' }}
                      title={item.image ? 'Click to preview full image' : item.title}
                    >
                      {item.image ? (
                        <img
                          src={getImageUrl(item.image)}
                          alt={item.title}
                          className="item-thumbnail-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="item-thumbnail-placeholder"
                        style={{ display: item.image ? 'none' : 'flex' }}
                      >
                        <span className="placeholder-emoji">{categoryIcon}</span>
                        <span className="placeholder-text">No Photo</span>
                      </div>
                    </div>

                    {/* Report Information Details */}
                    <div className="item-details-body">
                      <div className="item-title-row">
                        <h3 className="item-title">{item.title}</h3>
                      </div>

                      <p className="item-description-text">{item.description}</p>

                      <div className="item-meta-grid">
                        <div className="meta-item">
                          <FiMapPin className="meta-icon" />
                          <span className="meta-label">Location:</span>
                          <span className="meta-value">{item.location}</span>
                        </div>

                        <div className="meta-item">
                          <FiCalendar className="meta-icon" />
                          <span className="meta-label">
                            {isLost ? 'Date Lost:' : 'Date Found:'}
                          </span>
                          <span className="meta-value">{formatDate(item.date)}</span>
                        </div>

                        <div className="meta-item">
                          <FiClock className="meta-icon" />
                          <span className="meta-label">Submitted:</span>
                          <span className="meta-value">{formatDate(item.createdAt)}</span>
                        </div>

                        {!isRecovered && claimStatus && (
                          <div className="meta-item">
                            <FiShield className="meta-icon" />
                            <span className="meta-label">Claim Status:</span>
                            <span className={`claim-status-text claim-${claimStatus.toLowerCase()}`}>
                              {claimStatus.charAt(0).toUpperCase() + claimStatus.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Visual Timeline Section mapped from actual data & timestamps */}
                      <div className="timeline-container">
                        <div className="timeline-header-label">Activity Timeline</div>
                        <div className="report-card-stepper">
                          {timelineSteps.map((step, idx) => (
                            <React.Fragment key={step.key || idx}>
                              <div className={`report-step-node ${step.status === 'completed' ? 'completed' : 'pending'}`}>
                                <div className="report-step-circle">
                                  {step.status === 'completed' ? (
                                    <FiCheck className="report-step-check-icon" />
                                  ) : (
                                    idx + 1
                                  )}
                                </div>
                                <div className="report-step-text-wrap">
                                  <span className="report-step-title">{step.title}</span>
                                  {step.date && <span className="report-step-date">{step.date}</span>}
                                </div>
                              </div>
                              {idx < timelineSteps.length - 1 && (
                                <div
                                  className={`report-step-line ${
                                    step.status === 'completed' && timelineSteps[idx + 1].status === 'completed'
                                      ? 'completed'
                                      : ''
                                  }`}
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="card-actions-footer">
                    <div className="footer-reporter-summary">
                      <FiUser className="user-icon" />
                      <span>Reporter: {item.reportedBy?.name || studentName}</span>
                    </div>

                    <div className="footer-button-group">
                      {isLost && rawStatus !== 'RESOLVED' && rawStatus !== 'CLAIMED' && (
                        <>
                          <button
                            className="btn-print-report"
                            style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}
                            onClick={() => handleRecover(item._id)}
                            title="I Got My Item Back"
                          >
                            <FiCheckCircle /> I Got My Item Back
                          </button>
                          {(item.foundBy || (item.claims && item.claims.some(c => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)))) && (
                            <button
                              className="btn-print-report"
                              style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                              onClick={() => {
                                setRejectTargetItemId(item._id);
                                setIsRejectModalOpen(true);
                              }}
                              title="This Is Not My Item"
                            >
                              <FiX /> This Is Not My Item
                            </button>
                          )}
                        </>
                      )}
                      <button
                        className="btn-view-details"
                        onClick={() => setSelectedItem(item)}
                      >
                        <FiEye /> View Details
                      </button>

                      <button
                        className="btn-print-report"
                        onClick={() => handlePrintSingle(item)}
                      >
                        <FiPrinter /> Print Report
                      </button>

                      {rawStatus !== 'RESOLVED' && rawStatus !== 'CLAIMED' && (
                        <button
                          className="btn-delete-report"
                          onClick={() => handleDeleteClick(item)}
                          title="Delete report"
                        >
                          <FiTrash2 /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================
            VIEW DETAILS MODAL
        ======================================================== */}
        {selectedItem && (
          <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
            <div className="modal-card modal-large" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="modal-category-breadcrumb">
                    {categoryIcons[selectedItem.category] || '📦'} {selectedItem.category}
                  </span>
                  <h2 className="modal-title">{selectedItem.title}</h2>
                </div>
                <button className="modal-close-btn" onClick={() => setSelectedItem(null)}>
                  <FiX />
                </button>
              </div>

              <div className="modal-body">
                <div className="modal-grid">
                  {/* Left Column: Image & Status */}
                  <div className="modal-col-left">
                    <div className="modal-image-wrap">
                      {selectedItem.image ? (
                        <img
                          src={getImageUrl(selectedItem.image)}
                          alt={selectedItem.title}
                          className="modal-item-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="modal-image-placeholder"
                        style={{ display: selectedItem.image ? 'none' : 'flex' }}
                      >
                        <span>{categoryIcons[selectedItem.category] || '📦'}</span>
                      </div>
                    </div>

                    <div className="modal-status-box">
                      <div className="status-box-row">
                        <span className="box-label">Current Status:</span>
                        <span
                          className={`primary-status-badge ${getItemPrimaryStatus(selectedItem).badgeClass}`}
                        >
                          {getItemPrimaryStatus(selectedItem).label}
                        </span>
                      </div>
                      {getItemPrimaryStatus(selectedItem).state !== 'recovered' && selectedItem.claimStatus && (
                        <div className="status-box-row">
                          <span className="box-label">Claim Status:</span>
                          <span
                            className={`claim-badge claim-${selectedItem.claimStatus.toLowerCase()}`}
                          >
                            {selectedItem.claimStatus.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Complete Information */}
                  <div className="modal-col-right">
                    <div className="detail-section">
                      <h4 className="section-title">Item Description & Details</h4>
                      <p className="detail-desc-content">{selectedItem.description}</p>
                      <div className="modal-detail-list">
                        <div className="detail-row">
                          <span className="row-key">Category:</span>
                          <span className="row-val">
                            {categoryIcons[selectedItem.category] || '📦'} {selectedItem.category}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="row-key">Location:</span>
                          <span className="row-val">{selectedItem.location}</span>
                        </div>
                        <div className="detail-row">
                          <span className="row-key">
                            {selectedItem.type === 'lost' ? 'Date Lost:' : 'Date Found:'}
                          </span>
                          <span className="row-val">{formatDate(selectedItem.date)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="row-key">Submitted At:</span>
                          <span className="row-val">{formatDateTime(selectedItem.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Reporter Box */}
                    <div className="detail-section reporter-section">
                      <h4 className="section-title">Reporter Information</h4>
                      <div className="modal-detail-list">
                        <div className="detail-row">
                          <span className="row-key">Student Name:</span>
                          <span className="row-val">
                            {selectedItem.reportedBy?.name || studentName}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="row-key">Student ID:</span>
                          <span className="row-val">
                            {selectedItem.reportedBy?.studentId || studentId}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="row-key">College Email:</span>
                          <span className="row-val">
                            {selectedItem.reportedBy?.email || studentEmail}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="row-key">Phone:</span>
                          <span className="row-val">
                            {selectedItem.reportedBy?.phone || studentPhone || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Claim / Resolution Box */}
                    <div className="detail-section resolution-section">
                      <h4 className="section-title">Claim & Resolution Status</h4>
                      <div className="modal-detail-list">
                        <div className="detail-row">
                          <span className="row-key">Claim Status:</span>
                          <span className="row-val">
                            {selectedItem.recoveryType === 'owner_found'
                              ? 'RESOLVED (OWNER FOUND)'
                              : (selectedItem.claimStatus
                                ? selectedItem.claimStatus.toUpperCase()
                                : 'No claims recorded')}
                          </span>
                        </div>
                        {selectedItem.recoveryType === 'owner_found' && (
                          <div
                            style={{
                              margin: '14px 0',
                              padding: '12px 14px',
                              background: '#f0fdf4',
                              border: '1.5px solid #86efac',
                              borderRadius: '8px',
                            }}
                          >
                            <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FiCheckCircle /> Recovered By Owner
                            </div>
                            <div className="detail-row" style={{ marginTop: '4px' }}>
                              <span className="row-key">Recovery Type:</span>
                              <span className="row-val" style={{ fontWeight: 700, color: '#059669' }}>Owner Found Item</span>
                            </div>
                            <div className="detail-row" style={{ marginTop: '4px' }}>
                              <span className="row-key">Verification:</span>
                              <span className="row-val" style={{ color: '#15803d', fontWeight: 600 }}>OTP Verified</span>
                            </div>
                            <div className="detail-row" style={{ marginTop: '4px' }}>
                              <span className="row-key">Status:</span>
                              <span className="row-val" style={{ fontWeight: 700, color: '#15803d' }}>Resolved</span>
                            </div>
                          </div>
                        )}
                        {selectedItem.latestClaim && (
                          <>
                            <div className="detail-row">
                              <span className="row-key">Claimant:</span>
                              <span className="row-val">{selectedItem.latestClaim.fullName}</span>
                            </div>
                            <div className="detail-row">
                              <span className="row-key">Claim Date:</span>
                              <span className="row-val">
                                {formatDateTime(selectedItem.latestClaim.createdAt)}
                              </span>
                            </div>
                            {selectedItem.latestClaim.additionalDetails && (
                              <div className="detail-row">
                                <span className="row-key">Claim Details:</span>
                                <span className="row-val">
                                  {selectedItem.latestClaim.additionalDetails}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        {/* Active Finder / Found By State */}
                        {(selectedItem.foundBy || selectedItem.latestClaim) &&
                          (selectedItem.type || '').toLowerCase() === 'lost' &&
                          (selectedItem.status || '').toLowerCase() !== 'resolved' && (
                            <div
                              style={{
                                margin: '14px 0',
                                padding: '14px',
                                background: '#f0fdf4',
                                border: '1.5px solid #86efac',
                                borderRadius: '10px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontWeight: 800, fontSize: '0.92rem' }}>
                                  <FiCheckCircle style={{ fontSize: '1.2rem', strokeWidth: 2.5 }} /> FOUND BY
                                </div>
                                <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px' }}>
                                  Finder Reported
                                </span>
                              </div>
                              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                                {selectedItem.latestClaim?.fullName || (typeof selectedItem.foundBy === 'object' ? selectedItem.foundBy?.name : selectedItem.foundBy) || 'A Student'}
                              </div>
                              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>
                                Found on: {formatDateTime(selectedItem.latestClaim?.createdAt || selectedItem.updatedAt)}
                              </div>
                              {(selectedItem.latestClaim?.finderMessage || selectedItem.latestClaim?.additionalDetails) && (
                                <div style={{ marginBottom: '6px', fontSize: '0.88rem', color: '#334155' }}>
                                  <strong>Finder Message:</strong> "{selectedItem.latestClaim.finderMessage || selectedItem.latestClaim.additionalDetails}"
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.85rem', color: '#334155' }}>
                                {(selectedItem.latestClaim?.email || selectedItem.foundBy?.email) && (
                                  <div>
                                    <strong>Email:</strong>{' '}
                                    <a href={`mailto:${selectedItem.latestClaim?.email || selectedItem.foundBy?.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                      {selectedItem.latestClaim?.email || selectedItem.foundBy?.email}
                                    </a>
                                  </div>
                                )}
                                {(selectedItem.latestClaim?.phone || selectedItem.foundBy?.phone) && (
                                  <div>
                                    <strong>Phone:</strong>{' '}
                                    <a href={`tel:${selectedItem.latestClaim?.phone || selectedItem.foundBy?.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                                      {selectedItem.latestClaim?.phone || selectedItem.foundBy?.phone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        {selectedItem.foundBy && (selectedItem.status === 'Resolved' || selectedItem.status === 'resolved') && (
                          <div className="detail-row">
                            <span className="row-key">Found By:</span>
                            <span className="row-val">
                              {typeof selectedItem.foundBy === 'object'
                                ? `${selectedItem.foundBy.name} (${selectedItem.foundBy.email || ''})`
                                : selectedItem.foundBy}
                            </span>
                          </div>
                        )}
                        {(selectedItem.status === 'Resolved' ||
                          selectedItem.status === 'Claimed') && (
                          <>
                            <div className="detail-row">
                              <span className="row-key">Resolution Date:</span>
                              <span className="row-val">
                                {formatDateTime(selectedItem.resolvedAt || selectedItem.updatedAt)}
                              </span>
                            </div>
                            <div className="detail-row">
                              <span className="row-key">Resolution Details:</span>
                              <span className="row-val">
                                Report officially marked as {selectedItem.status} in College Lost &
                                Found Records.
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                {(selectedItem.type || '').toLowerCase() === 'lost' &&
                  (selectedItem.status || '').toLowerCase() !== 'resolved' &&
                  (selectedItem.status || '').toLowerCase() !== 'claimed' && (
                    <>
                      <button
                        className="btn-print-report"
                        style={{ background: '#059669', color: '#fff', borderColor: '#059669' }}
                        onClick={() => handleRecover(selectedItem._id)}
                      >
                        <FiCheckCircle /> I Got My Item Back
                      </button>
                      {(selectedItem.foundBy || (selectedItem.claims && selectedItem.claims.some((c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)))) && (
                        <button
                          className="btn-print-report"
                          style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                          onClick={() => {
                            setRejectTargetItemId(selectedItem._id);
                            setIsRejectModalOpen(true);
                          }}
                        >
                          <FiX /> This Is Not My Item
                        </button>
                      )}
                    </>
                  )}
                <button
                  className="btn-print-report"
                  onClick={() => handlePrintSingle(selectedItem)}
                >
                  <FiPrinter /> Print This Report
                </button>
                <button className="btn-modal-close" onClick={() => setSelectedItem(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            DELETE CONFIRMATION DIALOG
        ======================================================== */}
        {deleteConfirmItem && (
          <div className="modal-backdrop" onClick={() => setDeleteConfirmItem(null)}>
            <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-icon-wrap">
                <FiTrash2 />
              </div>
              <h3 className="confirm-title">Delete Report?</h3>
              <p className="confirm-text">
                Are you sure you want to delete report{' '}
                <strong>"{deleteConfirmItem.title}"</strong>?
                This action cannot be undone.
              </p>
              <div className="confirm-actions">
                <button className="btn-cancel" onClick={() => setDeleteConfirmItem(null)}>
                  Cancel
                </button>
                <button className="btn-confirm-delete" onClick={confirmDelete}>
                  Yes, Delete Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog: "This Is Not My Item" (Requirement 2) */}
        {isRejectModalOpen && (
          <div className="modal-backdrop" onClick={() => !isRejecting && setIsRejectModalOpen(false)}>
            <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
              <div className="confirm-icon-wrap" style={{ background: '#fee2e2', color: '#ef4444' }}>
                <FiX />
              </div>
              <h3 className="confirm-title">Are you sure this is not your item?</h3>
              <p className="confirm-text">
                Rejecting this report will clear the current finder and make your lost item available for new reports by other students.
              </p>
              <div className="confirm-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  className="btn-modal-close"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm-delete"
                  style={{ background: '#dc2626' }}
                  onClick={handleRejectFinder}
                  disabled={isRejecting}
                >
                  {isRejecting ? 'Rejecting...' : 'Yes, This Is Not My Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewImageModal && (
          <div className="modal-backdrop" onClick={() => setPreviewImageModal(null)}>
            <div className="image-preview-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="image-preview-header">
                <span className="image-preview-title">{previewImageModal.alt}</span>
                <button
                  className="modal-close-btn"
                  onClick={() => setPreviewImageModal(null)}
                  title="Close preview"
                >
                  <FiX />
                </button>
              </div>
              <div className="image-preview-body">
                <img
                  src={previewImageModal.src}
                  alt={previewImageModal.alt}
                  className="image-preview-full"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          PRINTABLE VIEWS (Hidden on Screen, Shown in @media print)
      ======================================================== */}

      {/* 1. SINGLE REPORT PRINT VIEW (Simplified Individual Item Report) */}
      {printMode === 'single' && itemToPrint && (() => {
        const statusBadge = getSimpleStatusBadge(itemToPrint);
        const activeClaim = itemToPrint.claims?.find(
          (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved', 'resolved'].includes(c.status)
        ) || (itemToPrint.claims && itemToPrint.claims[0]) || null;

        const hasClaimOrFinder = Boolean(
          itemToPrint.foundBy ||
          activeClaim ||
          itemToPrint.claimStatus
        );

        const isResolved =
          (itemToPrint.status || '').toLowerCase() === 'resolved' ||
          (itemToPrint.status || '').toLowerCase() === 'claimed';

        const showFinderHistory =
          itemToPrint.claims &&
          (itemToPrint.claims.length > 1 || itemToPrint.claims.some((c) => c.status === 'rejected'));

        return (
          <div className="printable-single-report simple-report-container">
            {/* HEADER */}
            <div className="simple-report-header">
              <h1 className="simple-report-main-title">COLLEGE LOST & FOUND MANAGEMENT SYSTEM</h1>
              <h2 className="simple-report-sub-title">Individual Item Report</h2>
            </div>

            <div className="simple-report-divider" />

            {/* 1. ITEM DETAILS */}
            <div className="simple-report-section">
              <h3 className="simple-report-section-title">Item Details</h3>
              <div className="simple-report-data-list">
                <div className="simple-report-row">
                  <span className="simple-report-label">Item Name:</span>
                  <span className="simple-report-value font-bold">{itemToPrint.title}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Category:</span>
                  <span className="simple-report-value">{itemToPrint.category}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Location:</span>
                  <span className="simple-report-value">{itemToPrint.location}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">
                    {(itemToPrint.type || '').toLowerCase() === 'lost' ? 'Date Lost:' : 'Date Found:'}
                  </span>
                  <span className="simple-report-value">{formatDate(itemToPrint.date)}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Description:</span>
                  <span className="simple-report-value">{itemToPrint.description || 'No description provided'}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Report Type:</span>
                  <span className={`simple-report-badge badge-${(itemToPrint.type || '').toLowerCase()}`}>
                    {(itemToPrint.type || '').toUpperCase()}
                  </span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Current Status:</span>
                  <span className={`simple-report-status-badge ${statusBadge.cls}`}>
                    {statusBadge.text}
                  </span>
                </div>
              </div>
            </div>

            <div className="simple-report-divider" />

            {/* 2. REPORTED BY */}
            <div className="simple-report-section">
              <h3 className="simple-report-section-title">Reported By</h3>
              <div className="simple-report-data-list">
                <div className="simple-report-row">
                  <span className="simple-report-label">Student Name:</span>
                  <span className="simple-report-value">{itemToPrint.reportedBy?.name || studentName}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Student ID:</span>
                  <span className="simple-report-value">{itemToPrint.reportedBy?.studentId || studentId}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">College Email:</span>
                  <span className="simple-report-value">{itemToPrint.reportedBy?.email || studentEmail}</span>
                </div>
                <div className="simple-report-row">
                  <span className="simple-report-label">Phone:</span>
                  <span className="simple-report-value">{itemToPrint.reportedBy?.phone || studentPhone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* 3. CLAIM / FINDER (Only show this section when claim/finder information exists) */}
            {hasClaimOrFinder && (
              <>
                <div className="simple-report-divider" />
                <div className="simple-report-section">
                  <h3 className="simple-report-section-title">Claim / Finder</h3>
                  <div className="simple-report-data-list">
                    <div className="simple-report-row">
                      <span className="simple-report-label">Claim Status:</span>
                      <span className="simple-report-value font-semibold">
                        {itemToPrint.claimStatus
                          ? itemToPrint.claimStatus.toUpperCase()
                          : (activeClaim?.status ? activeClaim.status.toUpperCase() : 'PENDING')}
                      </span>
                    </div>
                    <div className="simple-report-row">
                      <span className="simple-report-label">Found By:</span>
                      <span className="simple-report-value">
                        {itemToPrint.foundBy?.name || activeClaim?.fullName || activeClaim?.finder?.name || 'Finder Reported'}
                      </span>
                    </div>
                    <div className="simple-report-row">
                      <span className="simple-report-label">Finder Name:</span>
                      <span className="simple-report-value font-bold">
                        {itemToPrint.foundBy?.name || activeClaim?.fullName || activeClaim?.finder?.name || 'N/A'}
                      </span>
                    </div>
                    <div className="simple-report-row">
                      <span className="simple-report-label">Claim Date:</span>
                      <span className="simple-report-value">
                        {formatDate(activeClaim?.submittedAt || activeClaim?.createdAt || itemToPrint.updatedAt)}
                      </span>
                    </div>
                    {(activeClaim?.finderMessage || activeClaim?.additionalDetails) && (
                      <div className="simple-report-row">
                        <span className="simple-report-label">Finder Message:</span>
                        <span className="simple-report-value">
                          {activeClaim.finderMessage || activeClaim.additionalDetails}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 4. RESOLUTION (Only show when applicable) */}
            {isResolved && (
              <>
                <div className="simple-report-divider" />
                <div className="simple-report-section">
                  <h3 className="simple-report-section-title">Resolution</h3>
                  <div className="simple-report-data-list">
                    <div className="simple-report-row">
                      <span className="simple-report-label">Resolution Status:</span>
                      <span className="simple-report-status-badge status-resolved">RESOLVED</span>
                    </div>
                    <div className="simple-report-row">
                      <span className="simple-report-label">Resolution Date:</span>
                      <span className="simple-report-value">{formatDate(itemToPrint.resolvedAt || itemToPrint.updatedAt)}</span>
                    </div>
                    <div className="simple-report-row">
                      <span className="simple-report-label">Resolved By:</span>
                      <span className="simple-report-value">
                        {itemToPrint.claimedBy?.name || itemToPrint.foundBy?.name || 'Owner Confirmed / Admin Verified'}
                      </span>
                    </div>
                    <div className="simple-report-row">
                      <span className="simple-report-label">Message:</span>
                      <span className="simple-report-value">
                        This item has been officially recovered and marked as resolved.
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 5. FINDER HISTORY (Only show this section when there are multiple finder attempts) */}
            {showFinderHistory && (
              <>
                <div className="simple-report-divider" />
                <div className="simple-report-section">
                  <h3 className="simple-report-section-title">Finder History</h3>
                  <div className="simple-finder-history-container">
                    {itemToPrint.claims.map((attempt, idx) => (
                      <div key={attempt._id || idx} className="simple-finder-history-card">
                        <div className="simple-report-row">
                          <span className="simple-report-label">Finder:</span>
                          <span className="simple-report-value font-semibold">
                            {attempt.fullName || attempt.finder?.name || 'Student'}
                          </span>
                        </div>
                        <div className="simple-report-row">
                          <span className="simple-report-label">Status:</span>
                          <span className="simple-report-value">
                            <span className={`simple-history-tag tag-${(attempt.status || '').toLowerCase()}`}>
                              {attempt.status === 'rejected'
                                ? 'Rejected'
                                : attempt.status === 'resolved'
                                ? 'Resolved'
                                : attempt.status}
                            </span>
                          </span>
                        </div>
                        <div className="simple-report-row">
                          <span className="simple-report-label">Date:</span>
                          <span className="simple-report-value">
                            {formatDate(attempt.rejectedAt || attempt.submittedAt || attempt.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="simple-report-divider" />

            <div className="simple-report-footer">
              <span>Report ID: {itemToPrint._id}</span>
              <span>Generated: {formatDateTime(new Date())}</span>
            </div>
          </div>
        );
      })()}

      {/* 2. COMPLETE HISTORY PRINT VIEW (Simplified Collection of All Reports) */}
      {printMode === 'history' && (
        <div className="printable-history-report simple-history-container">
          <div className="simple-history-header">
            <h1 className="simple-history-main-title">COLLEGE LOST & FOUND MANAGEMENT SYSTEM</h1>
            <h2 className="simple-history-sub-title">Complete Reports History</h2>
            <div className="simple-history-meta">
              <span><strong>Generated Date/Time:</strong> {formatDateTime(new Date())}</span>
              <span><strong>Total Records:</strong> {items.length}</span>
            </div>
          </div>

          <div className="simple-history-divider" />

          {/* SUMMARY */}
          <div className="simple-history-summary">
            <div className="summary-stat-item">Total Reports: <strong>{items.length}</strong></div>
            <div className="summary-stat-item">Lost Reports: <strong>{lostCount}</strong></div>
            <div className="summary-stat-item">Found Reports: <strong>{foundCount}</strong></div>
            <div className="summary-stat-item">Active Reports: <strong>{activeCount}</strong></div>
            <div className="summary-stat-item">Claimed Reports: <strong>{claimedCount}</strong></div>
            <div className="summary-stat-item">Resolved Reports: <strong>{resolvedCount}</strong></div>
          </div>

          <div className="simple-history-divider-thick" />

          {/* REPEAT REPORT 1, REPORT 2, ... for ALL reports */}
          <div className="simple-history-cards-list">
            {items.map((it, idx) => {
              const itemStatusBadge = getSimpleStatusBadge(it);
              const activeClaim = it.claims?.find(
                (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved', 'resolved'].includes(c.status)
              ) || (it.claims && it.claims[0]) || null;

              const hasClaimOrFinder = Boolean(
                it.foundBy ||
                activeClaim ||
                it.claimStatus
              );

              const isResolved =
                (it.status || '').toLowerCase() === 'resolved' ||
                (it.status || '').toLowerCase() === 'claimed';

              const rejectedClaims = (it.claims || []).filter((c) => c.status === 'rejected');
              const hasRejectedHistory = rejectedClaims.length > 0;

              return (
                <div key={it._id || idx} className="simple-history-report-card">
                  <div className="simple-report-card-top">
                    <span className="simple-report-number">REPORT {idx + 1}</span>
                    <span className="simple-report-id">Report ID: {it._id}</span>
                  </div>

                  <div className="simple-report-divider" />

                  {/* 1. Item Details */}
                  <div className="simple-report-section">
                    <h3 className="simple-report-section-title">Item Details</h3>
                    <div className="simple-report-data-list">
                      <div className="simple-report-row">
                        <span className="simple-report-label">Item Name:</span>
                        <span className="simple-report-value font-bold">{it.title}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Type:</span>
                        <span className={`simple-report-badge badge-${(it.type || '').toLowerCase()}`}>
                          {(it.type || '').toUpperCase()}
                        </span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Category:</span>
                        <span className="simple-report-value">{it.category}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Location:</span>
                        <span className="simple-report-value">{it.location}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Date:</span>
                        <span className="simple-report-value">{formatDate(it.date)}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Description:</span>
                        <span className="simple-report-value">{it.description || 'No description provided'}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Current Status:</span>
                        <span className={`simple-report-status-badge ${itemStatusBadge.cls}`}>
                          {itemStatusBadge.text}
                        </span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Claim Status:</span>
                        <span className="simple-report-value font-semibold">
                          {it.claimStatus ? it.claimStatus.toUpperCase() : (activeClaim?.status ? activeClaim.status.toUpperCase() : 'NONE')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="simple-report-divider" />

                  {/* 2. Reported By */}
                  <div className="simple-report-section">
                    <h3 className="simple-report-section-title">Reported By</h3>
                    <div className="simple-report-data-list">
                      <div className="simple-report-row">
                        <span className="simple-report-label">Student Name:</span>
                        <span className="simple-report-value">{it.reportedBy?.name || studentName}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Student ID:</span>
                        <span className="simple-report-value">{it.reportedBy?.studentId || studentId}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">College Email:</span>
                        <span className="simple-report-value">{it.reportedBy?.email || studentEmail}</span>
                      </div>
                      <div className="simple-report-row">
                        <span className="simple-report-label">Phone:</span>
                        <span className="simple-report-value">{it.reportedBy?.phone || studentPhone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Finder / Claim (Only show when a finder/claim exists) */}
                  {hasClaimOrFinder && (
                    <>
                      <div className="simple-report-divider" />
                      <div className="simple-report-section">
                        <h3 className="simple-report-section-title">Finder / Claim</h3>
                        <div className="simple-report-data-list">
                          <div className="simple-report-row">
                            <span className="simple-report-label">Finder Name:</span>
                            <span className="simple-report-value font-bold">
                              {it.foundBy?.name || activeClaim?.fullName || activeClaim?.finder?.name || 'N/A'}
                            </span>
                          </div>
                          <div className="simple-report-row">
                            <span className="simple-report-label">Finder Status:</span>
                            <span className="simple-report-value">
                              {it.foundBy ? 'Finder Reported' : (activeClaim ? activeClaim.status : 'None')}
                            </span>
                          </div>
                          <div className="simple-report-row">
                            <span className="simple-report-label">Claim Date:</span>
                            <span className="simple-report-value">
                              {formatDate(activeClaim?.submittedAt || activeClaim?.createdAt || it.updatedAt)}
                            </span>
                          </div>
                          {(activeClaim?.finderMessage || activeClaim?.additionalDetails) && (
                            <div className="simple-report-row">
                              <span className="simple-report-label">Finder Message:</span>
                              <span className="simple-report-value">
                                {activeClaim.finderMessage || activeClaim.additionalDetails}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* 4. Resolution (Only show when applicable) */}
                  {isResolved && (
                    <>
                      <div className="simple-report-divider" />
                      <div className="simple-report-section">
                        <h3 className="simple-report-section-title">Resolution</h3>
                        <div className="simple-report-data-list">
                          <div className="simple-report-row">
                            <span className="simple-report-label">Resolution Status:</span>
                            <span className="simple-report-status-badge status-resolved">RESOLVED</span>
                          </div>
                          <div className="simple-report-row">
                            <span className="simple-report-label">Resolution Date:</span>
                            <span className="simple-report-value">{formatDate(it.resolvedAt || it.updatedAt)}</span>
                          </div>
                          <div className="simple-report-row">
                            <span className="simple-report-label">Admin Verified / Resolved By:</span>
                            <span className="simple-report-value">
                              {it.claimedBy?.name || it.foundBy?.name || 'Owner Confirmed / Admin Verified'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 5. Rejected Finder History (Only show when rejected finder attempts exist) */}
                  {hasRejectedHistory && (
                    <>
                      <div className="simple-report-divider" />
                      <div className="simple-report-section">
                        <h3 className="simple-report-section-title">Finder History</h3>
                        <div className="simple-rejected-history-list">
                          {rejectedClaims.map((rej, rejIdx) => (
                            <div key={rej._id || rejIdx} className="simple-rejected-item">
                              <div className="simple-report-row">
                                <span className="simple-report-label font-bold" style={{ width: 'auto' }}>
                                  {rej.fullName || rej.finder?.name || 'Finder'} — Rejected
                                </span>
                              </div>
                              <div className="simple-report-row">
                                <span className="simple-report-label">Date:</span>
                                <span className="simple-report-value">
                                  {formatDate(rej.rejectedAt || rej.submittedAt || rej.createdAt)}
                                </span>
                              </div>
                              <div className="simple-report-row">
                                <span className="simple-report-label">Reason/Details:</span>
                                <span className="simple-report-value">
                                  {rej.rejectionReason || 'Claim rejected by owner ("This Is Not My Item")'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="simple-history-divider-thick" />

          <div className="simple-report-footer">
            <span>COLLEGE LOST & FOUND MANAGEMENT SYSTEM</span>
            <span>Complete Reports History — {items.length} Records</span>
            <span>Generated: {formatDateTime(new Date())}</span>
          </div>
        </div>
      )}

      {/* Owner Recovery OTP Verification Modal */}
      <OwnerRecoveryOtpModal
        isOpen={isRecoveryModalOpen}
        onClose={() => {
          setIsRecoveryModalOpen(false);
          setRecoveryTargetItem(null);
        }}
        itemId={recoveryTargetItem?._id}
        itemTitle={recoveryTargetItem?.title}
        onSuccess={() => {
          fetchReports();
          if (selectedItem && selectedItem._id === recoveryTargetItem?._id) {
            setSelectedItem(null);
          }
        }}
      />
    </div>
  );
}
