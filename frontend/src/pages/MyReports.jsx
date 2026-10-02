import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReports, deleteItem } from '../api';
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
  FiPlusCircle
} from 'react-icons/fi';
import './MyReports.css';

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
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [printMode, setPrintMode] = useState(null); // 'single' | 'history' | null
  const [itemToPrint, setItemToPrint] = useState(null);

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

  // Print handlers
  const handlePrintSingle = (item) => {
    setItemToPrint(item);
    setPrintMode('single');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintHistory = () => {
    setPrintMode('history');
    setTimeout(() => {
      window.print();
    }, 150);
  };

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

              // Timeline progression calculation
              let timelineStep = 1;
              if (rawStatus === 'ACTIVE') timelineStep = 2;
              if (claimStatus) timelineStep = 3;
              if (claimStatus === 'approved') timelineStep = 4;
              if (rawStatus === 'CLAIMED' || rawStatus === 'RESOLVED') timelineStep = 5;

              return (
                <div key={item._id} className="history-report-card">
                  {/* Top info line */}
                  <div className="card-top-row">
                    <div className="report-id-pill">
                      Report ID: <span>{item._id}</span>
                    </div>
                    <div className="report-badges-group">
                      <span className={`type-badge ${isLost ? 'badge-lost' : 'badge-found'}`}>
                        {isLost ? '🔴 LOST' : '🟢 FOUND'}
                      </span>
                      <span className={`status-badge status-${rawStatus.toLowerCase()}`}>
                        {rawStatus}
                      </span>
                      {claimStatus && (
                        <span className={`claim-badge claim-${claimStatus.toLowerCase()}`}>
                          Claim: {claimStatus.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-main-content">
                    {/* Item Image */}
                    <div className="item-thumbnail-wrap">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="item-thumbnail-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="item-thumbnail-placeholder"
                        style={{ display: item.image ? 'none' : 'flex' }}
                      >
                        <span className="placeholder-emoji">{categoryIcon}</span>
                      </div>
                    </div>

                    {/* Report Information Details */}
                    <div className="item-details-body">
                      <div className="item-title-row">
                        <h3 className="item-title">{item.title}</h3>
                        <span className="item-category-tag">
                          {categoryIcon} {item.category}
                        </span>
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

                        {claimStatus && (
                          <div className="meta-item">
                            <FiShield className="meta-icon" />
                            <span className="meta-label">Claim Status:</span>
                            <span className={`claim-status-text claim-${claimStatus.toLowerCase()}`}>
                              {claimStatus.charAt(0).toUpperCase() + claimStatus.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Visual Timeline Section */}
                      <div className="timeline-container">
                        <div className="timeline-header-label">Activity Timeline</div>
                        <div className="timeline-stepper">
                          {isLost ? (
                            <>
                              <div className={`step-node ${timelineStep >= 1 ? 'completed' : ''}`}>
                                <div className="step-circle">1</div>
                                <span className="step-title">Reported Lost</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 2 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 2 ? 'completed' : ''}`}>
                                <div className="step-circle">2</div>
                                <span className="step-title">Active</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 3 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 3 ? 'completed' : ''}`}>
                                <div className="step-circle">3</div>
                                <span className="step-title">Claim Submitted</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 4 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 4 ? 'completed' : ''}`}>
                                <div className="step-circle">4</div>
                                <span className="step-title">Claim Approved</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 5 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 5 ? 'completed' : ''}`}>
                                <div className="step-circle">5</div>
                                <span className="step-title">Claimed / Resolved</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className={`step-node ${timelineStep >= 1 ? 'completed' : ''}`}>
                                <div className="step-circle">1</div>
                                <span className="step-title">Found Item</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 2 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 2 ? 'completed' : ''}`}>
                                <div className="step-circle">2</div>
                                <span className="step-title">Active</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 3 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 3 ? 'completed' : ''}`}>
                                <div className="step-circle">3</div>
                                <span className="step-title">Owner Claim Received</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 4 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 4 ? 'completed' : ''}`}>
                                <div className="step-circle">4</div>
                                <span className="step-title">Claim Approved</span>
                              </div>
                              <div className={`step-line ${timelineStep >= 5 ? 'completed' : ''}`} />
                              <div className={`step-node ${timelineStep >= 5 ? 'completed' : ''}`}>
                                <div className="step-circle">5</div>
                                <span className="step-title">Resolved</span>
                              </div>
                            </>
                          )}
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
                  <div className="modal-sub-id">Report ID: {selectedItem._id}</div>
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
                          src={selectedItem.image}
                          alt={selectedItem.title}
                          className="modal-item-img"
                        />
                      ) : (
                        <div className="modal-image-placeholder">
                          <span>{categoryIcons[selectedItem.category] || '📦'}</span>
                        </div>
                      )}
                    </div>

                    <div className="modal-status-box">
                      <div className="status-box-row">
                        <span className="box-label">Report Type:</span>
                        <span
                          className={`type-badge ${
                            selectedItem.type === 'lost' ? 'badge-lost' : 'badge-found'
                          }`}
                        >
                          {selectedItem.type?.toUpperCase()}
                        </span>
                      </div>
                      <div className="status-box-row">
                        <span className="box-label">Current Status:</span>
                        <span
                          className={`status-badge status-${(
                            selectedItem.status || 'Active'
                          ).toLowerCase()}`}
                        >
                          {(selectedItem.status || 'Active').toUpperCase()}
                        </span>
                      </div>
                      {selectedItem.claimStatus && (
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
                            {selectedItem.claimStatus
                              ? selectedItem.claimStatus.toUpperCase()
                              : 'No claims recorded'}
                          </span>
                        </div>
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
                        {(selectedItem.status === 'Resolved' ||
                          selectedItem.status === 'Claimed') && (
                          <>
                            <div className="detail-row">
                              <span className="row-key">Resolution Date:</span>
                              <span className="row-val">
                                {formatDateTime(selectedItem.updatedAt)}
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
                <strong>"{deleteConfirmItem.title}"</strong> (ID: {deleteConfirmItem._id})?
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
      </div>

      {/* ========================================================
          PRINTABLE VIEWS (Hidden on Screen, Shown in @media print)
      ======================================================== */}

      {/* 1. SINGLE REPORT PRINT VIEW */}
      {itemToPrint && (
        <div className="printable-single-report">
          <div className="print-header">
            <h1 className="print-main-title">COLLEGE LOST & FOUND MANAGEMENT SYSTEM</h1>
            <p className="print-sub-title">Official Item Activity & Incident Record</p>
          </div>

          <div className="print-divider" />

          <div className="print-section">
            <h2 className="print-section-title">REPORT DETAILS</h2>
            <div className="print-table">
              <div className="print-row">
                <span className="print-label">Report ID:</span>
                <span className="print-value">{itemToPrint._id}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Report Type:</span>
                <span className="print-value print-type-badge">
                  {itemToPrint.type?.toUpperCase()}
                </span>
              </div>
              <div className="print-row">
                <span className="print-label">Item Name:</span>
                <span className="print-value font-bold">{itemToPrint.title}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Category:</span>
                <span className="print-value">{itemToPrint.category}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Description:</span>
                <span className="print-value">{itemToPrint.description}</span>
              </div>
              <div className="print-row">
                <span className="print-label">
                  {itemToPrint.type === 'lost' ? 'Date Lost:' : 'Date Found:'}
                </span>
                <span className="print-value">{formatDate(itemToPrint.date)}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Location:</span>
                <span className="print-value">{itemToPrint.location}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Submitted At:</span>
                <span className="print-value">{formatDateTime(itemToPrint.createdAt)}</span>
              </div>
              <div className="print-row">
                <span className="print-label">Current Status:</span>
                <span className="print-value print-status-badge">
                  {(itemToPrint.status || 'Active').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="print-divider" />

          <div className="print-section">
            <h2 className="print-section-title">STUDENT DETAILS</h2>
            <div className="print-table">
              <div className="print-row">
                <span className="print-label">Student Name:</span>
                <span className="print-value">
                  {itemToPrint.reportedBy?.name || studentName}
                </span>
              </div>
              <div className="print-row">
                <span className="print-label">Student ID:</span>
                <span className="print-value">
                  {itemToPrint.reportedBy?.studentId || studentId}
                </span>
              </div>
              <div className="print-row">
                <span className="print-label">College Email:</span>
                <span className="print-value">
                  {itemToPrint.reportedBy?.email || studentEmail}
                </span>
              </div>
              <div className="print-row">
                <span className="print-label">Phone:</span>
                <span className="print-value">
                  {itemToPrint.reportedBy?.phone || studentPhone || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="print-divider" />

          <div className="print-section">
            <h2 className="print-section-title">CLAIM / RESOLUTION</h2>
            <div className="print-table">
              <div className="print-row">
                <span className="print-label">Claim Status:</span>
                <span className="print-value">
                  {itemToPrint.claimStatus
                    ? itemToPrint.claimStatus.toUpperCase()
                    : 'No Claims Filed'}
                </span>
              </div>
              <div className="print-row">
                <span className="print-label">Resolution:</span>
                <span className="print-value">
                  {itemToPrint.status === 'Resolved' || itemToPrint.status === 'Claimed'
                    ? `Item officially marked as ${itemToPrint.status} on ${formatDate(
                        itemToPrint.updatedAt
                      )}`
                    : 'In Progress / Active Investigation'}
                </span>
              </div>
            </div>
          </div>

          <div className="print-divider" />

          <div className="print-footer">
            <p>This report is generated from the College Lost & Found Management System.</p>
            <p>Verification Timestamp: {new Date().toLocaleString('en-GB')}</p>
          </div>
        </div>
      )}

      {/* 2. COMPLETE STUDENT HISTORY PRINT VIEW */}
      <div className="printable-history-report">
        <div className="print-header">
          <h1 className="print-main-title">COLLEGE LOST & FOUND MANAGEMENT SYSTEM</h1>
          <h2 className="print-doc-title">STUDENT LOST & FOUND HISTORY</h2>
          <p className="print-sub-title">Official Student Activity Record for Academic & Administrative File</p>
        </div>

        <div className="print-divider" />

        <div className="print-summary-box">
          <div className="print-student-info">
            <div><strong>Student Name:</strong> {studentName}</div>
            <div><strong>Student ID:</strong> {studentId}</div>
            <div><strong>College Email:</strong> {studentEmail}</div>
          </div>

          <div className="print-counts-row">
            <div className="count-box">Total Reports: <strong>{totalCount}</strong></div>
            <div className="count-box">Lost Reports: <strong>{lostCount}</strong></div>
            <div className="count-box">Found Reports: <strong>{foundCount}</strong></div>
            <div className="count-box">Active Reports: <strong>{activeCount}</strong></div>
            <div className="count-box">Claimed Reports: <strong>{claimedCount}</strong></div>
            <div className="count-box">Resolved Reports: <strong>{resolvedCount}</strong></div>
          </div>
        </div>

        <div className="print-divider" />

        <div className="print-section">
          <h3 className="print-section-title">REPORTS ACTIVITY LEDGER</h3>
          <table className="print-history-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Item</th>
                <th>Type</th>
                <th>Category</th>
                <th>Location</th>
                <th>Date</th>
                <th>Status</th>
                <th>Claim Status</th>
                <th>Resolution</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id}>
                  <td className="mono">{it._id.slice(-6)}</td>
                  <td><strong>{it.title}</strong></td>
                  <td>{it.type?.toUpperCase()}</td>
                  <td>{it.category}</td>
                  <td>{it.location}</td>
                  <td>{formatDate(it.date)}</td>
                  <td>{it.status}</td>
                  <td>{it.claimStatus || 'None'}</td>
                  <td>
                    {it.status === 'Resolved' || it.status === 'Claimed'
                      ? `${it.status} (${formatDate(it.updatedAt)})`
                      : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-divider" />

        <div className="print-footer">
          <p>This report is generated from the College Lost & Found Management System.</p>
          <p>Generated on: {new Date().toLocaleString('en-GB')}</p>
        </div>
      </div>
    </div>
  );
}
