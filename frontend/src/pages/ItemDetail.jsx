import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getItemById, deleteItem, updateItem, recoverItem, rejectFinderClaim, createClaim, sendReportOtp, verifyReportOtp, getImageUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiUser, FiPhone, FiEdit2, FiTrash2, FiArrowLeft, FiCheckCircle, FiUploadCloud, FiX } from 'react-icons/fi';
import OwnerRecoveryOtpModal from '../components/OwnerRecoveryOtpModal';
import './ItemDetail.css';
import './Dashboard.css';

const categoryIcons = {
  Electronics: '💻', 'Books & Notes': '📚', Clothing: '👕', Accessories: '⌚',
  'ID & Cards': '🪪', Keys: '🔑', Bags: '🎒', 'Sports Equipment': '⚽', Stationery: '✏️', Other: '📦',
};


export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimStep, setClaimStep] = useState('form'); // 'form' | 'otp' | 'success'
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [claimErrors, setClaimErrors] = useState({});
  const [claimForm, setClaimForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    finderMessage: '',
  });
  const [claimImageFile, setClaimImageFile] = useState(null);
  const [claimImagePreview, setClaimImagePreview] = useState(null);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    setImageError(false);
    getItemById(id)
      .then((res) => {
        setItem(res.data);
      })
      .catch(() => navigate('/items'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (user) {
      setClaimForm((prev) => ({
        ...prev,
        fullName: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      }));
    }
  }, [user]);

  const [isRecoveryOtpModalOpen, setIsRecoveryOtpModalOpen] = useState(false);

  const handleRecoverItem = () => {
    setIsRecoveryOtpModalOpen(true);
  };

  const handleRejectFinderClaim = async () => {
    try {
      setIsRejecting(true);
      const { data } = await rejectFinderClaim(id);
      setItem(data.item || data);
      setIsRejectModalOpen(false);
      toast.success('Finder report has been rejected. The item is now open for new finder reports.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject finder report');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleOpenClaimModal = () => {
    setClaimStep('form');
    setClaimErrors({});
    setOtp('');
    setOtpError('');
    if (user) {
      setClaimForm({
        fullName: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        finderMessage: '',
      });
    }
    setIsClaimModalOpen(true);
  };

  const handleCloseClaimModal = () => {
    setIsClaimModalOpen(false);
    setClaimStep('form');
    setClaimImageFile(null);
    setClaimImagePreview(null);
    setClaimErrors({});
    setOtp('');
    setOtpError('');
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

    const trimmedDetails = (claimForm.finderMessage || '').trim();
    if (!trimmedDetails) {
      errs.finderMessage = 'Additional details describing where/how you found the item are required';
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

  const handleProceedToOtp = async (e) => {
    e.preventDefault();
    const { isValid, cleanEmail, cleanName } = validateClaimForm();
    if (!isValid) {
      toast.error('Please fix the errors in the form before proceeding');
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await sendReportOtp({
        email: cleanEmail,
        name: cleanName,
        type: 'found',
      });
      setClaimStep('otp');
      setResendCooldown(60);
      setOtp('');
      setOtpError('');
      toast.success(res.data?.message || `We've sent a 6-digit OTP to ${cleanEmail}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification OTP. Please try again.';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    try {
      setIsSendingOtp(true);
      const cleanEmail = (claimForm.email || '').trim().toLowerCase();
      const cleanName = (claimForm.fullName || '').trim();
      const res = await sendReportOtp({
        email: cleanEmail,
        name: cleanName,
        type: 'found',
      });
      setResendCooldown(60);
      toast.success(res.data?.message || `We've sent a new 6-digit OTP to ${cleanEmail}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyAndSubmitClaim = async (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError('Please enter the 6-digit OTP');
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
      setIsVerifyingOtp(true);
      // Verify OTP with existing verification mechanism
      await verifyReportOtp({
        email: cleanEmail,
        otp: cleanOtp,
      });

      // Submit claim record
      const formData = new FormData();
      formData.append('itemId', id);
      formData.append('itemName', item.title);
      formData.append('fullName', cleanName);
      formData.append('email', cleanEmail);
      formData.append('phone', cleanPhone);
      formData.append('finderMessage', cleanDetails);
      formData.append('additionalDetails', cleanDetails);
      formData.append('otp', cleanOtp);
      if (claimImageFile) {
        formData.append('image', claimImageFile);
      }

      await createClaim(formData);

      const ownerName = item.reportedBy?.name || 'Owner';
      setClaimStep('success');
      toast.success(`Found Item Report Submitted Successfully! ${ownerName} has been notified by email.`, { duration: 6000 });

      // Refresh item state
      getItemById(id).then((res) => setItem(res.data)).catch(() => {});
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification or claim submission failed';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    setDeleting(true);
    try {
      await deleteItem(id);
      toast.success('Item deleted');
      navigate('/my-reports');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
      setDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusLoading(true);
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      const { data } = await updateItem(id, formData);
      setItem(data);
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner"></div></div>;
  if (!item) return null;

  const reportedById = item.reportedBy?._id || item.reportedBy;
  const isActualOwner = Boolean(user && reportedById && String(reportedById) === String(user._id));
  const isOwner = isActualOwner || user?.role === 'admin';
  const isLost = item.type === 'lost';
  const isResolved = (item.status || '').toLowerCase() === 'resolved';

  // Check active finder report / claim
  const activeClaim = item.claims?.find(
    (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
  );

  const hasActiveFinder = Boolean(item.foundBy || activeClaim);
  const finderName = activeClaim?.fullName || item.foundBy?.name || activeClaim?.finder?.name || 'A Student';
  const foundDate = activeClaim?.createdAt || item.updatedAt || item.createdAt;
  const formattedFoundDate = foundDate ? new Date(foundDate).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : 'Recently';
  const icon = categoryIcons[item.category] || '📦';

  return (
    <div className="page">
      <div className="container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <FiArrowLeft /> Back
        </button>

        <div className="detail-grid animate-fadeInUp">
          {/* Image */}
          <div className="detail-image-col">
            <div className="detail-image-wrap">
              {item.image && !imageError ? (
                <img
                  src={getImageUrl(item.image)}
                  alt={item.title}
                  className="detail-image"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="detail-image-placeholder">
                  <span>{icon}</span>
                </div>
              )}
              <span className={`detail-type-badge ${isLost ? 'lost' : 'found'}`}>
                {isLost ? '🔴 Lost Item' : '🟢 Found Item'}
              </span>
            </div>

            {/* Reporter Card */}
            {item.reportedBy && (
              <div className="reporter-card">
                <h3>Reported By</h3>
                <div className="reporter-info">
                  <div className="reporter-avatar">{item.reportedBy.name?.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="reporter-name">{item.reportedBy.name}</div>
                    <div className="reporter-dept">{item.reportedBy.department || item.reportedBy.email}</div>
                  </div>
                </div>
                {item.reportedBy.phone && (
                  <div className="contact-row">
                    <FiPhone /> {item.reportedBy.phone}
                  </div>
                )}
                {item.contactInfo && (
                  <div className="contact-row">
                    <FiPhone /> {item.contactInfo}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="detail-info-col">
            <div className="detail-badges">
              <span className={`badge badge-${item.type}`}>{item.type}</span>
              <span className={`badge badge-${item.status}`}>{item.status}</span>
              <span className="detail-category">{icon} {item.category}</span>
            </div>

            <h1 className="detail-title">{item.title}</h1>

            <div className="detail-meta">
              <div className="detail-meta-item">
                <FiMapPin />
                <div>
                  <div className="meta-label">Location</div>
                  <div className="meta-value">{item.location}</div>
                </div>
              </div>
              <div className="detail-meta-item">
                <FiCalendar />
                <div>
                  <div className="meta-label">Date</div>
                  <div className="meta-value">
                    {new Date(item.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="detail-meta-item">
                <FiCalendar />
                <div>
                  <div className="meta-label">Reported on</div>
                  <div className="meta-value">{new Date(item.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            <div className="detail-description">
              <h3>Description</h3>
              <p>{item.description}</p>
            </div>

            {/* Active Finder / Found By State (Visible before owner recovery) */}
            {hasActiveFinder && isLost && !isResolved && (
              <div
                className="ud-found-by-card"
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.5px' }}>
                    <FiCheckCircle style={{ fontSize: '1.3rem', strokeWidth: 2.5 }} /> FOUND BY
                  </div>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '9999px',
                    }}
                  >
                    Finder Reported
                  </span>
                </div>

                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                  {finderName}
                </div>
                <div style={{ fontSize: '0.88rem', color: '#475569', marginBottom: (isActualOwner || user?.role === 'admin') ? '12px' : '0' }}>
                  Found on: {formattedFoundDate}
                </div>

                {/* Finder Message & Contact Info - visible ONLY to the lost-item owner or admin */}
                {(isActualOwner || user?.role === 'admin') && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                    {(activeClaim?.finderMessage || activeClaim?.additionalDetails) && (
                      <div style={{ marginBottom: '8px', fontSize: '0.9rem', color: '#334155' }}>
                        <strong>Finder Message:</strong> "{activeClaim.finderMessage || activeClaim.additionalDetails}"
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.88rem', color: '#334155' }}>
                      {(activeClaim?.email || item.foundBy?.email) && (
                        <div>
                          <strong>Email:</strong>{' '}
                          <a href={`mailto:${activeClaim?.email || item.foundBy?.email}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {activeClaim?.email || item.foundBy?.email}
                          </a>
                        </div>
                      )}
                      {(activeClaim?.phone || item.foundBy?.phone) && (
                        <div>
                          <strong>Phone:</strong>{' '}
                          <a href={`tel:${activeClaim?.phone || item.foundBy?.phone}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>
                            {activeClaim?.phone || item.foundBy?.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Owner Self-Recovery Resolved Banner */}
            {isResolved && item.recoveryType === 'owner_found' && (
              <div
                className="ud-found-by-card"
                style={{
                  marginTop: '1.5rem',
                  padding: '1.25rem',
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 800, fontSize: '0.95rem' }}>
                    <FiCheckCircle style={{ fontSize: '1.3rem' }} /> RECOVERED BY OWNER
                  </div>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '9999px',
                    }}
                  >
                    Owner Found Item
                  </span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                  {item.recoveredBy?.name || item.reportedBy?.name || 'Owner'}
                </div>
                <div style={{ fontSize: '0.88rem', color: '#475569' }}>
                  Recovered and resolved on {new Date(item.resolvedAt || item.ownerConfirmedAt || item.updatedAt).toLocaleDateString()} with 6-digit OTP verification.
                </div>
              </div>
            )}

            {/* Owner Actions */}
            {isOwner && (
              <div className="detail-actions" style={{ marginTop: hasActiveFinder && isLost ? '1rem' : '1.5rem' }}>
                {isLost && !isResolved && (
                  <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      className="btn btn-primary"
                      style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleRecoverItem}
                      disabled={statusLoading || isRejecting}
                    >
                      <FiCheckCircle /> I Got My Item Back
                    </button>
                    {hasActiveFinder && (
                      <button
                        className="btn btn-danger"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={statusLoading || isRejecting}
                      >
                        <FiX /> This Is Not My Item
                      </button>
                    )}
                  </div>
                )}
                <div className="status-actions">
                  <span className="form-label">Update Status:</span>
                  <div className="status-btns">
                    {['active', 'resolved', 'claimed'].map((s) => (
                      <button
                        key={s}
                        className={`status-btn status-btn-${s} ${(item.status || '').toLowerCase() === s ? 'active' : ''}`}
                        onClick={() => handleStatusChange(s)}
                        disabled={statusLoading || (item.status || '').toLowerCase() === s}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="owner-btns">
                  <Link to={`/items/${id}/edit`} className="btn btn-secondary">
                    <FiEdit2 /> Edit
                  </Link>
                  <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                    <FiTrash2 /> {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            )}

            {/* Non-owner Finder / Claim Action: Only shown if NO active finder claim exists */}
            {user && !isActualOwner && !hasActiveFinder && !isResolved && item.status !== 'Claimed' && (
              <div className="detail-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleOpenClaimModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  I Found This Item
                </button>
              </div>
            )}

            {isResolved && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem 1.25rem',
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 800, fontSize: '1rem', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  <FiCheckCircle style={{ fontSize: '1.25rem' }} /> RESOLVED
                </div>
                <div style={{ fontSize: '0.92rem', color: '#166534', fontWeight: 600 }}>
                  This item has been recovered and resolved.
                </div>
                {(item.foundBy || item.claimedBy) && (
                  <div style={{ marginTop: '8px', fontSize: '0.95rem', color: '#0f172a', fontWeight: 700 }}>
                    Found By: <span style={{ color: '#059669' }}>{item.foundBy?.name || item.claimedBy?.name || 'Final Finder'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claim / Report Found Item Modal */}
      {isClaimModalOpen && (
        <div className="ud-modal-backdrop" onClick={handleCloseClaimModal}>
          <div className="ud-modal-card ud-claim-modal animate-scaleUp" onClick={(e) => e.stopPropagation()}>
            <div className="ud-modal-header">
              <div>
                <h3 className="ud-modal-title">
                  {claimStep === 'otp' ? 'Verify Your Email' : claimStep === 'success' ? 'Report Submitted' : 'Report Found Item'}
                </h3>
                <p className="ud-modal-subtitle">
                  {claimStep === 'otp' ? (
                    <>We've sent a 6-digit OTP to <strong>{claimForm.email}</strong></>
                  ) : (
                    <>Regarding: <strong>{item.title}</strong></>
                  )}
                </p>
              </div>
              <button className="ud-modal-close-btn" onClick={handleCloseClaimModal} title="Close">
                <FiX />
              </button>
            </div>

            {claimStep === 'form' && (
              <form onSubmit={handleProceedToOtp} className="ud-form">
                <div className="ud-form-grid">
                  <div className="ud-form-group">
                    <label className="ud-form-label">Full Name <span className="ud-required">*</span></label>
                    <input
                      type="text"
                      className="ud-form-input"
                      value={claimForm.fullName}
                      onChange={(e) => {
                        setClaimForm({ ...claimForm, fullName: e.target.value });
                        setClaimErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      placeholder="Your full name"
                    />
                    {claimErrors.fullName && (
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                        {claimErrors.fullName}
                      </span>
                    )}
                  </div>
                  <div className="ud-form-group">
                    <label className="ud-form-label">College Email Address <span className="ud-required">*</span></label>
                    <input
                      type="email"
                      className="ud-form-input"
                      value={claimForm.email}
                      onChange={(e) => {
                        setClaimForm({ ...claimForm, email: e.target.value });
                        setClaimErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      placeholder="e.g. 24107000@apsit.edu.in"
                    />
                    {claimErrors.email && (
                      <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                        {claimErrors.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="ud-form-group">
                  <label className="ud-form-label">Phone Number <span className="ud-required">*</span></label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile number (e.g. 9876543210)"
                    className="ud-form-input"
                    value={claimForm.phone}
                    onChange={(e) => {
                      setClaimForm({ ...claimForm, phone: e.target.value });
                      setClaimErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                  />
                  {claimErrors.phone && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                      {claimErrors.phone}
                    </span>
                  )}
                </div>

                {/* Proof Image Upload (Required) */}
                <div className="ud-form-group">
                  <label className="ud-form-label">
                    Found Item Image / Proof Photo <span className="ud-required">*</span>
                  </label>
                  <div className="ud-image-dropzone">
                    <input
                      type="file"
                      accept="image/*"
                      id="itemdetail-proof-image"
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
                      <label htmlFor="itemdetail-proof-image" className="ud-dropzone-label">
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
                  <label className="ud-form-label">Additional Details <span className="ud-required">*</span></label>
                  <textarea
                    rows={3}
                    placeholder="Describe where or how you found the item, and how the owner can collect it from you..."
                    className="ud-form-textarea"
                    value={claimForm.finderMessage}
                    onChange={(e) => {
                      setClaimForm({ ...claimForm, finderMessage: e.target.value });
                      setClaimErrors((prev) => ({ ...prev, finderMessage: '' }));
                    }}
                  />
                  {claimErrors.finderMessage && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '3px', display: 'block' }}>
                      {claimErrors.finderMessage}
                    </span>
                  )}
                </div>

                <div className="ud-modal-footer">
                  <button type="button" className="ud-btn-cancel" onClick={handleCloseClaimModal}>
                    Cancel
                  </button>
                  <button type="submit" className="ud-btn-submit-green" disabled={isSendingOtp}>
                    {isSendingOtp ? 'Sending OTP...' : 'Send Verification OTP'}
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
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setOtpError('');
                    }}
                    autoFocus
                  />
                  {otpError && (
                    <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                      {otpError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Didn't receive the OTP?
                  </span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isSendingOtp}
                    onClick={handleResendOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: resendCooldown > 0 ? '#94a3b8' : '#2563eb',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>

                <div className="ud-modal-footer">
                  <button
                    type="button"
                    className="ud-btn-cancel"
                    onClick={() => setClaimStep('form')}
                    disabled={isVerifyingOtp}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="ud-btn-submit-green"
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? 'Verifying & Submitting...' : 'Confirm & Submit'}
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
                  <strong>{item.reportedBy?.name || 'Ajinkya'}</strong> has been notified by email.
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
        isOpen={isRecoveryOtpModalOpen}
        onClose={() => setIsRecoveryOtpModalOpen(false)}
        itemId={id}
        itemTitle={item?.title}
        onSuccess={(data) => {
          if (data?.item) {
            setItem(data.item);
          } else {
            getItemById(id).then((res) => setItem(res.data)).catch(() => {});
          }
        }}
      />
    </div>
  );
}
