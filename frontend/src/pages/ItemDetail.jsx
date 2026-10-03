import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getItemById, deleteItem, updateItem, recoverItem, createClaim, getImageUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiUser, FiPhone, FiEdit2, FiTrash2, FiArrowLeft, FiCheckCircle, FiUploadCloud, FiX } from 'react-icons/fi';
import './ItemDetail.css';

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
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimForm, setClaimForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    finderMessage: '',
  });
  const [claimImageFile, setClaimImageFile] = useState(null);
  const [claimImagePreview, setClaimImagePreview] = useState(null);

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

  const handleRecoverItem = async () => {
    if (!window.confirm('Confirm that you have recovered your lost item? This will mark it as resolved.')) return;
    setStatusLoading(true);
    try {
      const { data } = await recoverItem(id);
      setItem(data.item);
      toast.success('Great! Your item has been marked as recovered and resolved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update item status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSubmitClaim = async (e) => {
    e.preventDefault();
    if (!claimForm.fullName.trim()) return toast.error('Full Name is required');
    if (!claimForm.email.trim()) return toast.error('Email Address is required');
    if (!claimForm.phone.trim()) return toast.error('Phone Number is required');

    try {
      setIsSubmittingClaim(true);
      const formData = new FormData();
      formData.append('itemId', id);
      formData.append('itemName', item.title);
      formData.append('fullName', claimForm.fullName.trim());
      formData.append('email', claimForm.email.trim());
      formData.append('phone', claimForm.phone.trim());
      formData.append('finderMessage', claimForm.finderMessage.trim());
      formData.append('additionalDetails', claimForm.finderMessage.trim());
      if (claimImageFile) {
        formData.append('image', claimImageFile);
      }

      await createClaim(formData);
      if (isLost) {
        toast.success('Your message has been sent to the owner! They will contact you shortly.');
      } else {
        toast.success('Claim submitted successfully! The admin will review it.');
      }
      setIsClaimModalOpen(false);
      setClaimImageFile(null);
      setClaimImagePreview(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setIsSubmittingClaim(false);
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

  const isOwner = user && item.reportedBy && (item.reportedBy._id === user._id || user.role === 'admin');
  const isLost = item.type === 'lost';
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

            {/* Owner Actions */}
            {isOwner && (
              <div className="detail-actions">
                {isLost && item.status !== 'Resolved' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <button
                      className="btn btn-primary"
                      style={{ background: '#10b981', borderColor: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleRecoverItem}
                      disabled={statusLoading}
                    >
                      <FiCheckCircle /> I Got My Item Back
                    </button>
                  </div>
                )}
                <div className="status-actions">
                  <span className="form-label">Update Status:</span>
                  <div className="status-btns">
                    {['active', 'resolved', 'claimed'].map((s) => (
                      <button
                        key={s}
                        className={`status-btn status-btn-${s} ${item.status === s ? 'active' : ''}`}
                        onClick={() => handleStatusChange(s)}
                        disabled={statusLoading || item.status === s}
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

            {/* Non-owner Finder / Claim Action */}
            {user && !isOwner && item.status !== 'Resolved' && item.status !== 'Claimed' && (
              <div className="detail-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setIsClaimModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isLost ? 'I Found This Item' : 'Claim This Item'}
                </button>
              </div>
            )}

            {item.status === 'Resolved' && (
              <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiCheckCircle /> This item has been recovered and resolved.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claim / Report Found Item Modal */}
      {isClaimModalOpen && (
        <div className="ud-modal-backdrop" onClick={() => setIsClaimModalOpen(false)}>
          <div className="ud-modal-card ud-claim-modal animate-scaleUp" onClick={(e) => e.stopPropagation()}>
            <div className="ud-modal-header">
              <div>
                <h3 className="ud-modal-title">{isLost ? 'Report Found Item' : 'Claim Item'}</h3>
                <p className="ud-modal-subtitle">Regarding: <strong>{item.title}</strong></p>
              </div>
              <button className="ud-modal-close-btn" onClick={() => setIsClaimModalOpen(false)} title="Close">
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} className="ud-form">
              <div className="ud-form-grid">
                <div className="ud-form-group">
                  <label className="ud-form-label">Full Name <span className="ud-required">*</span></label>
                  <input
                    type="text"
                    required
                    className="ud-form-input"
                    value={claimForm.fullName}
                    onChange={(e) => setClaimForm({ ...claimForm, fullName: e.target.value })}
                  />
                </div>
                <div className="ud-form-group">
                  <label className="ud-form-label">Email Address <span className="ud-required">*</span></label>
                  <input
                    type="email"
                    required
                    className="ud-form-input"
                    value={claimForm.email}
                    onChange={(e) => setClaimForm({ ...claimForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="ud-form-group">
                <label className="ud-form-label">Phone Number <span className="ud-required">*</span></label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  className="ud-form-input"
                  value={claimForm.phone}
                  onChange={(e) => setClaimForm({ ...claimForm, phone: e.target.value })}
                />
              </div>

              <div className="ud-form-group">
                <label className="ud-form-label">{isLost ? 'Message to Owner' : 'Additional Details'}</label>
                <textarea
                  rows={3}
                  placeholder={isLost ? 'Describe where or how you found the item, and how the owner can collect it from you...' : 'Provide details proving ownership...'}
                  className="ud-form-textarea"
                  value={claimForm.finderMessage}
                  onChange={(e) => setClaimForm({ ...claimForm, finderMessage: e.target.value })}
                />
              </div>

              <div className="ud-modal-footer">
                <button type="button" className="ud-btn-cancel" onClick={() => setIsClaimModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="ud-btn-submit-green" disabled={isSubmittingClaim}>
                  {isSubmittingClaim ? 'Submitting...' : (isLost ? 'Send to Owner' : 'Submit Claim')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
