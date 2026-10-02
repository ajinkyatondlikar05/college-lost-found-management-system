import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createItem } from '../api';
import toast from 'react-hot-toast';
import { FiUpload, FiX } from 'react-icons/fi';
import './ReportForm.css';

const CATEGORIES = [
  'Electronics', 'Books & Notes', 'Clothing', 'Accessories',
  'ID & Cards', 'Keys', 'Bags', 'Sports Equipment', 'Stationery', 'Other',
];

export default function ReportItem({ type }) {
  const navigate = useNavigate();
  const isLost = type === 'lost';

  const [form, setForm] = useState({
    title: '', category: '', description: '', location: '', date: '', contactInfo: '',
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('type', type);
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    if (image) formData.append('image', image);

    try {
      const { data } = await createItem(formData);
      toast.success(`${isLost ? 'Lost' : 'Found'} item reported successfully!`);
      navigate(`/items/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="report-form-wrap animate-fadeInUp">
          {/* Header */}
          <div className={`report-header ${isLost ? 'lost' : 'found'}`}>
            <div className="report-header-glow"></div>
            <div className="report-header-content">
              <span className="report-type-emoji">{isLost ? '🔴' : '🟢'}</span>
              <div>
                <h1>Report {isLost ? 'Lost' : 'Found'} Item</h1>
                <p>{isLost ? 'Tell us what you lost so the community can help.' : 'Someone is looking for what you found!'}</p>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="report-form">
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Item Name *</label>
                <input
                  type="text"
                  name="title"
                  className="form-input"
                  placeholder={`e.g. ${isLost ? 'Black iPhone 14' : 'Found blue umbrella'}`}
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select name="category" className="form-select" value={form.category} onChange={handleChange} required>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                name="description"
                className="form-textarea"
                placeholder="Describe the item in detail — color, brand, size, identifying marks..."
                value={form.description}
                onChange={handleChange}
                required
                rows={4}
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Location *</label>
                <input
                  type="text"
                  name="location"
                  className="form-input"
                  placeholder={`Where was it ${isLost ? 'lost' : 'found'}?`}
                  value={form.location}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  name="date"
                  className="form-input"
                  value={form.date}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contact Information (optional)</label>
              <input
                type="text"
                name="contactInfo"
                className="form-input"
                placeholder="Phone number or alternate contact info"
                value={form.contactInfo}
                onChange={handleChange}
              />
            </div>

            {/* Image Upload */}
            <div className="form-group">
              <label className="form-label">Item Photo (optional)</label>
              {imagePreview ? (
                <div className="image-preview-wrap">
                  <img src={imagePreview} alt="preview" className="image-preview" />
                  <button type="button" className="remove-image-btn" onClick={removeImage}>
                    <FiX />
                  </button>
                </div>
              ) : (
                <label className="image-upload-area">
                  <FiUpload className="upload-icon" />
                  <span>Click to upload photo</span>
                  <small>JPG, PNG, WEBP up to 5MB</small>
                  <input type="file" accept="image/*" onChange={handleImage} hidden />
                </label>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="submit" className={`btn ${isLost ? 'btn-danger' : 'btn-success'} btn-lg`} disabled={loading}>
                {loading ? <><span className="spinner spinner-sm"></span> Submitting...</> : `Submit ${isLost ? 'Lost' : 'Found'} Report`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
