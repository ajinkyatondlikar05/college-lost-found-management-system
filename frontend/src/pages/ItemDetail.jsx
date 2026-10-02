import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getItemById, deleteItem, updateItem, getImageUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMapPin, FiCalendar, FiUser, FiPhone, FiEdit2, FiTrash2, FiArrowLeft } from 'react-icons/fi';
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

  useEffect(() => {
    getItemById(id)
      .then((res) => setItem(res.data))
      .catch(() => navigate('/items'))
      .finally(() => setLoading(false));
  }, [id]);

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
              {item.image ? (
                <img src={getImageUrl(item.image)} alt={item.title} className="detail-image" />
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
          </div>
        </div>
      </div>
    </div>
  );
}
