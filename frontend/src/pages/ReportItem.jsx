import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createItem, sendReportOtp, verifyReportOtp } from '../api';
import toast from 'react-hot-toast';
import { FiUpload, FiX, FiCheckCircle } from 'react-icons/fi';
import './ReportForm.css';

const CATEGORIES = [
  'Electronics', 'Books & Notes', 'Clothing', 'Accessories',
  'ID & Cards', 'Keys', 'Bags', 'Sports Equipment', 'Stationery', 'Other',
];

export default function ReportItem({ type }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLost = type === 'lost';

  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    location: '',
    date: '',
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP Verification States
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [verifiedOtp, setVerifiedOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');

  // Populate user data if user loaded asynchronously
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user]);

  // Resend OTP cooldown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, email: val }));
    // Reset OTP verification if email is edited
    if (isOtpVerified || isOtpSent) {
      setIsOtpVerified(false);
      setIsOtpSent(false);
      setVerifiedOtp('');
      setOtp('');
      setOtpError('');
    }
  };

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

  // Step 1: Send OTP to email
  const handleSendOtp = async () => {
    setError('');
    setOtpError('');

    if (!form.name.trim()) {
      setOtpError('Please enter your name first');
      toast.error('Please enter your name first');
      return;
    }

    if (!form.email.trim()) {
      setOtpError('Please enter your email first');
      toast.error('Please enter your email first');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setOtpError('Please enter a valid email address');
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await sendReportOtp({
        email: form.email.trim(),
        name: form.name.trim(),
        type,
      });
      toast.success(res.data?.message || `6-digit OTP sent to ${form.email.trim()}`);
      setIsOtpSent(true);
      setResendCooldown(60);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send verification OTP. Please try again.';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async () => {
    setError('');
    setOtpError('');
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length < 6) {
      setOtpError('Please enter the 6-digit OTP');
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const res = await verifyReportOtp({
        email: form.email.trim(),
        otp: cleanOtp,
      });
      setIsOtpVerified(true);
      setVerifiedOtp(cleanOtp);
      toast.success(res.data?.message || 'Email verified successfully!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired OTP code. Please try again.';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Step 3: Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOtpError('');

    if (!form.title.trim()) {
      setError('Item Name is required');
      toast.error('Item Name is required');
      return;
    }
    if (!form.category) {
      setError('Category is required');
      toast.error('Category is required');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required');
      toast.error('Description is required');
      return;
    }
    if (!form.location.trim()) {
      setError(`${isLost ? 'Location Lost' : 'Location Found'} is required`);
      toast.error(`${isLost ? 'Location Lost' : 'Location Found'} is required`);
      return;
    }
    if (!form.date) {
      setError(`${isLost ? 'Date Lost' : 'Date Found'} is required`);
      toast.error(`${isLost ? 'Date Lost' : 'Date Found'} is required`);
      return;
    }
    if (!form.name.trim()) {
      setError('Your Name is required');
      toast.error('Your Name is required');
      return;
    }
    if (!form.email.trim()) {
      setError('Email is required');
      toast.error('Email is required');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone Number is required');
      toast.error('Phone Number is required');
      return;
    }
    if (!isOtpVerified || !verifiedOtp) {
      const otpMsg = 'Please verify your email with OTP before submitting the report.';
      setError(otpMsg);
      toast.error(otpMsg);
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('type', type);
    formData.append('title', form.title.trim());
    formData.append('category', form.category);
    formData.append('description', form.description.trim());
    formData.append('location', form.location.trim());
    formData.append('date', form.date);
    formData.append('name', form.name.trim());
    formData.append('email', form.email.trim());
    formData.append('phone', form.phone.trim());
    formData.append('contactInfo', `Phone: ${form.phone.trim()} | Email: ${form.email.trim()}`);
    formData.append('otp', verifiedOtp);
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
          <div className="report-header">
            <div>
              <h1 className="report-title">Report {isLost ? 'Lost' : 'Found'} Item</h1>
              <p className="report-subtitle">
                {isLost
                  ? 'Fill in the details about the item you lost on campus.'
                  : 'Fill in the details about the item you found on campus.'}
              </p>
            </div>
            <button
              type="button"
              className="report-close-btn"
              onClick={() => navigate(-1)}
              title="Close"
            >
              <FiX />
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="report-form">
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">
                  Item Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  className="form-input"
                  placeholder={isLost ? 'e.g. Laptop Bag, Casio Watch, Scientific Calculator' : 'e.g. Found blue umbrella, Casio Watch'}
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Category <span className="required-star">*</span>
                </label>
                <select name="category" className="form-select" value={form.category} onChange={handleChange} required>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Description <span className="required-star">*</span>
              </label>
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
                <label className="form-label">
                  {isLost ? 'Location Lost' : 'Location Found'} <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  name="location"
                  className="form-input"
                  placeholder={`Where was it ${isLost ? 'lost' : 'found'}? (e.g. Library, Canteen, Room 304)`}
                  value={form.location}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  {isLost ? 'Date Lost' : 'Date Found'} <span className="required-star">*</span>
                </label>
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

            <div className="form-section-header">
              <h3 className="section-subtitle">Contact Information</h3>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">
                  Your Name <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Phone Number <span className="required-star">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="+91 9876543210"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Email <span className="required-star">*</span>
              </label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="e.g. 24107068@apsit.edu.in"
                value={form.email}
                onChange={handleEmailChange}
                required
              />
            </div>

            {/* OTP Verification Subsection */}
            <div className="otp-verification-box">
              <div className="otp-header-row">
                <div>
                  <h4 className="otp-box-title">OTP Verification</h4>
                  <p className="otp-box-subtitle">Verify your email before submitting the report.</p>
                </div>
                {isOtpVerified && (
                  <div className="otp-verified-badge">
                    <FiCheckCircle className="otp-verified-icon" />
                    <span>✓ Email verified</span>
                  </div>
                )}
              </div>

              {otpError && <div className="otp-alert-error">{otpError}</div>}

              {!isOtpVerified && (
                <div className="otp-controls-area">
                  {!isOtpSent ? (
                    <button
                      type="button"
                      className="btn btn-secondary otp-btn"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                    >
                      {isSendingOtp ? 'Sending OTP...' : 'Send OTP'}
                    </button>
                  ) : (
                    <div className="otp-input-group">
                      <div className="form-group otp-input-field">
                        <label className="form-label">
                          Enter OTP <span className="required-star">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input otp-digit-input"
                          placeholder="6-digit OTP"
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div className="otp-action-buttons">
                        <button
                          type="button"
                          className="btn btn-primary otp-btn"
                          onClick={handleVerifyOtp}
                          disabled={isVerifyingOtp || otp.length < 6}
                        >
                          {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-text otp-resend-btn"
                          onClick={handleSendOtp}
                          disabled={resendCooldown > 0 || isSendingOtp}
                        >
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div className="form-group" style={{ marginTop: '16px' }}>
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
                  <span className="upload-title">Click to upload photo</span>
                  <small className="upload-subtext">JPG, PNG, WEBP up to 5MB</small>
                  <input type="file" accept="image/*" onChange={handleImage} hidden />
                </label>
              )}
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><span className="spinner spinner-sm"></span> Submitting...</> : (isLost ? 'Submit Lost Report' : 'Submit Found Report')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
