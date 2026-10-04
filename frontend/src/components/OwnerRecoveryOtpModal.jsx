import React, { useState, useEffect } from 'react';
import { FiX, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { sendRecoveryOtp, recoverItem } from '../api';

export default function OwnerRecoveryOtpModal({
  isOpen,
  onClose,
  itemId,
  itemTitle,
  onSuccess,
}) {
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [resolutionResult, setResolutionResult] = useState(null);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (isOpen && itemId) {
      setOtp('');
      setOtpError('');
      setIsSuccess(false);
      setResolutionResult(null);
      handleInitialSend();
    }
  }, [isOpen, itemId]);

  const handleInitialSend = async () => {
    setIsSending(true);
    setOtpError('');
    try {
      const res = await sendRecoveryOtp(itemId);
      setMaskedEmail(res.data?.maskedEmail || '');
      setResendCooldown(60);
      toast.success(res.data?.message || 'Verification OTP sent to your college email');
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not send verification OTP. Please try again.';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isSending) return;
    setIsSending(true);
    setOtpError('');
    try {
      const res = await sendRecoveryOtp(itemId);
      setMaskedEmail(res.data?.maskedEmail || '');
      setResendCooldown(60);
      toast.success(res.data?.message || 'New 6-digit OTP sent to your college email');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError('Please enter the 6-digit OTP');
      return;
    }

    setIsVerifying(true);
    setOtpError('');
    try {
      const res = await recoverItem(itemId, { otp: cleanOtp });
      setResolutionResult(res.data);
      setIsSuccess(true);
      toast.success(res.data?.message || 'Item marked as Resolved! A confirmation email has been sent to your college email.');
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'OTP verification failed. Please try again.';
      setOtpError(msg);
      toast.error(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  const isDirectResolved = resolutionResult?.recoveryType === 'owner_found' || resolutionResult?.status === 'Resolved' || resolutionResult?.item?.status === 'Resolved';

  return (
    <div className="ud-modal-backdrop" onClick={onClose}>
      <div
        className="ud-modal-card animate-scaleUp"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isSuccess ? (
          <>
            <div className="ud-modal-header">
              <div className="ud-modal-header-text">
                <h3 className="ud-modal-title">Verify Your Email</h3>
                <p className="ud-modal-subtitle" style={{ fontSize: '0.875rem', marginTop: '4px', color: '#64748b' }}>
                  Please enter the 6-digit OTP sent to your verified college email to confirm you got your item back.
                </p>
                {maskedEmail && (
                  <p style={{ fontSize: '0.85rem', marginTop: '6px', color: '#0f172a' }}>
                    We've sent a 6-digit OTP to <strong>{maskedEmail}</strong>
                  </p>
                )}
              </div>
              <button className="ud-modal-close-btn" onClick={onClose} title="Cancel">
                <FiX />
              </button>
            </div>

            <form onSubmit={handleVerify} className="ud-otp-form" style={{ marginTop: '16px' }}>
              <div className="ud-otp-input-wrap">
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  className="ud-otp-input"
                  style={{
                    letterSpacing: '6px',
                    fontSize: '1.4rem',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setOtpError('');
                  }}
                />
              </div>

              {otpError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px', textAlign: 'center' }}>
                  {otpError}
                </div>
              )}

              <div className="ud-otp-timer-row" style={{ textAlign: 'center', marginTop: '14px' }}>
                {resendCooldown > 0 ? (
                  <span className="ud-cooldown-text">Resend OTP in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    className="ud-resend-btn"
                    onClick={handleResend}
                    disabled={isSending}
                  >
                    {isSending ? 'Sending...' : 'Resend OTP'}
                  </button>
                )}
              </div>

              <div className="ud-modal-footer" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="ud-btn-cancel"
                  onClick={onClose}
                  disabled={isVerifying}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ud-btn-submit-green"
                  disabled={isVerifying || otp.length < 6}
                >
                  {isVerifying ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            </form>
          </>
        ) : (
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
              <FiCheckCircle />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Item Marked as Resolved
            </h3>
            <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '24px', lineHeight: 1.5 }}>
              Your lost item has been successfully resolved. A confirmation email has been sent to your verified college email address.
            </p>
            <button
              type="button"
              className="ud-btn-submit-green"
              style={{ width: '100%' }}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
