import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi, register as registerApi } from '../api';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import { isAllowedUserEmail } from '../utils/authValidation';
import '../pages/LampAuth.css';

// Themes configuration matching the original lamp design
const THEMES = [
  { id: 'warm', name: 'Warm Amber Gold', class: 'lamp-theme-warm' },
  { id: 'cyber', name: 'Cyberpunk Cyan', class: 'lamp-theme-cyber' },
  { id: 'violet', name: 'Electric Violet', class: 'lamp-theme-violet' },
  { id: 'off', name: 'Lamp OFF', class: 'lamp-theme-off' },
];

export default function LampAuth({ isAdmin = false }) {
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  // Current theme index (0: Warm, 1: Cyber, 2: Violet, 3: Off)
  // Default to 3 (Lamp OFF) so page starts in OFF state matching Reference 1
  const [themeIdx, setThemeIdx] = useState(3);

  // Tab mode for user authentication ('signin' or 'signup')
  const [activeTab, setActiveTab] = useState('signin');

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [shakeCard, setShakeCard] = useState(false);

  // Physics & dragging state for pull cord
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const physicsAnimRef = useRef(null);

  // Mouse Parallax
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  // Canvas ref for atmospheric fireflies
  const canvasRef = useRef(null);

  const currentTheme = THEMES[themeIdx];

  // ========================================================
  // WEB AUDIO API SOUND SYNTHESIS
  // ========================================================
  const playClickSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Sharp metallic click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);

      // Subtle mechanical thud
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(180, ctx.currentTime);
      thudOsc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);

      thudGain.gain.setValueAtTime(0.25, ctx.currentTime);
      thudGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start();
      thudOsc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // AudioContext muted or not permitted
    }
  };

  // Cycle lamp to next theme
  const cycleLamp = () => {
    playClickSound();
    if (navigator.vibrate) navigator.vibrate(20);
    setThemeIdx((prev) => (prev + 1) % THEMES.length);
  };

  // ========================================================
  // DAMPED HARMONIC SPRING PHYSICS FOR PULL CORD
  // ========================================================
  const runSpringAnimation = (initialY) => {
    if (physicsAnimRef.current) cancelAnimationFrame(physicsAnimRef.current);

    let pos = initialY;
    let velocity = 0;
    const stiffness = 0.22;
    const damping = 0.72;

    const tick = () => {
      const force = -stiffness * pos;
      velocity = velocity * damping + force;
      pos += velocity;

      setDragY(pos);

      if (Math.abs(pos) > 0.4 || Math.abs(velocity) > 0.4) {
        physicsAnimRef.current = requestAnimationFrame(tick);
      } else {
        setDragY(0);
      }
    };

    physicsAnimRef.current = requestAnimationFrame(tick);
  };

  const handlePointerDown = (e) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) {
      // Damped pull distance
      const clamped = Math.min(delta * 0.8, 65);
      setDragY(clamped);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragY > 30) {
      cycleLamp();
    }

    runSpringAnimation(dragY);
  };

  const handleKeyDownCord = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      cycleLamp();
      runSpringAnimation(35);
    }
  };

  // ========================================================
  // ATMOSPHERIC PARTICLES / FIREFLIES ENGINE
  // ========================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 24 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isOff = themeIdx === 3;

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.phase += 0.02;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        if (isOff) return;

        const pulse = (Math.sin(p.phase) + 1) / 2;
        const opacity = pulse * 0.75 + 0.2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (themeIdx === 0) ctx.fillStyle = `rgba(251, 191, 36, ${opacity})`;
        else if (themeIdx === 1) ctx.fillStyle = `rgba(34, 211, 238, ${opacity})`;
        else ctx.fillStyle = `rgba(192, 132, 252, ${opacity})`;

        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [themeIdx]);

  // Mouse Parallax handler
  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMouseOffset({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ========================================================
  // PASSWORD STRENGTH ANALYZER
  // ========================================================
  const computePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score, label: labels[score] };
  };

  const strength = computePasswordStrength(signUpForm.password);

  // Trigger form validation error shake
  const triggerError = (msg) => {
    setError(msg);
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 500);
  };

  // ========================================================
  // AUTHENTICATION HANDLERS
  // ========================================================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const normalizedEmail = (loginForm.email || '').trim().toLowerCase();

    // College email validation for User Login (explicitly allows permanent demo: ajinkyatondlikar@gmail.com)
    if (!isAdmin) {
      if (!isAllowedUserEmail(normalizedEmail)) {
        triggerError('Please use your official college email (example: 24107068@apsit.edu.in).');
        return;
      }
    }

    setLoading(true);

    try {
      const { data } = await loginApi({
        email: normalizedEmail,
        password: loginForm.password,
        isAdmin,
      });

      if (isAdmin && data.role !== 'admin') {
        triggerError('Admin access denied');
        setLoading(false);
        return;
      }

      loginUser(data, data.token);
      toast.success(isAdmin ? `Welcome to Admin Panel, ${data.name}!` : `Welcome back, ${data.name}!`);
      navigate(isAdmin ? '/admin' : data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      triggerError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const normalizedEmail = (signUpForm.email || '').trim().toLowerCase();

    // College email validation for User Sign Up (explicitly allows permanent demo: ajinkyatondlikar@gmail.com)
    if (!isAllowedUserEmail(normalizedEmail)) {
      triggerError('Please use your official college email (example: 24107068@apsit.edu.in).');
      return;
    }

    if (signUpForm.password.length < 6) {
      triggerError('Password must be at least 6 characters');
      return;
    }

    if (signUpForm.password !== signUpForm.confirmPassword) {
      triggerError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const fullName = `${signUpForm.firstName.trim()} ${signUpForm.lastName.trim()}`.trim();
      const payload = {
        name: fullName,
        email: normalizedEmail,
        password: signUpForm.password,
      };

      const { data } = await registerApi(payload);
      const msg = data.message || 'Registration submitted successfully. Your account is waiting for admin approval.';
      setInfoMsg(msg);
      toast.success(msg, { duration: 7000 });
      setSignUpForm({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
      setLoginForm((prev) => ({ ...prev, email: normalizedEmail }));
      setActiveTab('signin');
    } catch (err) {
      triggerError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`lamp-page-container ${currentTheme.class}`}>
      {/* Background Room Atmosphere */}
      <div className="lamp-room-bg"></div>
      <div className="lamp-desk-lighting"></div>

      {/* Atmospheric Fireflies Canvas */}
      <canvas ref={canvasRef} className="lamp-fireflies-canvas"></canvas>

      {/* Night Sky Stars */}
      <div className="lamp-stars-wrap">
        {[
          { top: '15%', left: '8%', size: '2px', duration: '2.5s' },
          { top: '25%', left: '22%', size: '3px', duration: '3.8s' },
          { top: '12%', left: '42%', size: '2px', duration: '3.1s' },
          { top: '18%', left: '78%', size: '2.5px', duration: '2.9s' },
          { top: '32%', left: '92%', size: '2px', duration: '4.2s' },
          { top: '8%', left: '65%', size: '3px', duration: '3.5s' },
        ].map((s, i) => (
          <div
            key={i}
            className="lamp-star"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              '--duration': s.duration,
            }}
          />
        ))}
      </div>

      {/* Top Floating Navigation Bar */}
      <header className="lamp-topbar">
        <button
          type="button"
          id={isAdmin ? 'admin-back-to-portal-btn' : 'user-back-to-portal-btn'}
          className="lamp-back-btn"
          onClick={() => navigate('/')}
          aria-label="Back to Portal"
        >
          <FiArrowLeft /> Back to Portal
        </button>

        <div className="lamp-theme-tag" title="Click pull cord to cycle theme">
          <span className="lamp-theme-dot"></span>
          <span>{currentTheme.name}</span>
        </div>
      </header>

      {/* Main Content Stage: Two Columns (Left: Animated Lamp, Right: Glass Card) */}
      <main className="lamp-content-stage">
        {/* LEFT COLUMN: Standing Dome Floor/Desk Lamp */}
        <section className="lamp-stage-left">
          {/* Subtle 4-Pane Architectural Window Silhouette */}
          <div className="lamp-window-silhouette" aria-hidden="true">
            <div className="lamp-window-pane" />
            <div className="lamp-window-pane" />
            <div className="lamp-window-pane" />
            <div className="lamp-window-pane" />
          </div>

          <div
            className="lamp-apparatus"
            style={{
              transform: `rotate(${mouseOffset.x * 2}deg)`,
            }}
          >
            {/* Volumetric Light Beam */}
            <div className="lamp-volumetric-beam"></div>

            {/* Floor Light Pool */}
            <div className="lamp-floor-pool"></div>

            {/* Realistic Standing Dome Lamp matching Reference 1 & 2 */}
            <svg
              className="lamp-svg"
              viewBox="0 0 300 490"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="shadeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="35%" stopColor="#1e2430" />
                  <stop offset="100%" stopColor="#0f141d" />
                </linearGradient>
                <linearGradient id="brassGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#b45309" />
                  <stop offset="35%" stopColor="#fbbf24" />
                  <stop offset="70%" stopColor="#fef08a" />
                  <stop offset="100%" stopColor="#92400e" />
                </linearGradient>
                <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="40%" stopColor="var(--lamp-bulb)" />
                  <stop offset="75%" stopColor="var(--lamp-filament)" />
                  <stop offset="100%" stopColor="var(--lamp-primary)" />
                </radialGradient>
              </defs>

              {/* Base Floor Shadow */}
              <ellipse cx="150" cy="465" rx="90" ry="12" fill="rgba(0, 0, 0, 0.75)" filter="blur(6px)" />

              {/* Heavy Base Pedestal */}
              <rect x="75" y="442" width="150" height="20" rx="10" fill="#161b24" stroke="#252d3d" strokeWidth="2" />
              {/* Pedestal Top Brass Accent Ring */}
              <ellipse cx="150" cy="442" rx="60" ry="6" fill="url(#brassGrad)" opacity="0.9" />

              {/* Bottom Brass Collar */}
              <rect x="143" y="432" width="14" height="12" rx="2" fill="url(#brassGrad)" />

              {/* Straight Vertical Stem / Rod */}
              <rect x="146.5" y="154" width="7" height="280" rx="3.5" fill="#161b24" />
              <rect x="148" y="154" width="2" height="280" rx="1" fill="#334155" opacity="0.6" />

              {/* Top Brass Collar */}
              <rect x="144" y="144" width="12" height="12" rx="2" fill="url(#brassGrad)" />

              {/* Underside Diffuser / Bulb */}
              <ellipse
                cx="150"
                cy="136"
                rx="48"
                ry="11"
                fill={themeIdx === 3 ? '#161c26' : 'url(#bulbGlow)'}
                style={{
                  filter: themeIdx === 3 ? 'none' : 'drop-shadow(0 0 16px var(--lamp-primary)) drop-shadow(0 0 32px var(--lamp-secondary))',
                  transition: 'filter 0.5s ease, fill 0.5s ease',
                }}
              />

              {/* Recessed Inner Rim */}
              <ellipse cx="150" cy="136" rx="84" ry="9" fill="#0d1117" />

              {/* Dome Lampshade */}
              <path
                d="M 50 136 C 50 52, 250 52, 250 136 Z"
                fill="url(#shadeGrad)"
                stroke="#252d3d"
                strokeWidth="2"
              />

              {/* Top Crest Specular Highlight */}
              <path
                d="M 54 134 C 54 56, 246 56, 246 134"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2"
                fill="none"
              />

              {/* Bottom Horizontal Rim of Shade */}
              <ellipse cx="150" cy="136" rx="100" ry="12" fill="#141923" stroke="#252d3d" strokeWidth="2" />

              {/* Top Apex Gold Finial */}
              <circle cx="150" cy="46" r="6" fill="url(#brassGrad)" />
              <rect x="146" y="50" width="8" height="4" rx="1" fill="url(#brassGrad)" />
            </svg>

            {/* Interactive Spring Pull Cord */}
            <div
              className={`lamp-pull-assembly ${isDragging ? 'dragging' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              title="Pull cord to cycle theme or toggle lamp"
            >
              {/* Elastic Cord String */}
              <div
                className="lamp-pull-string"
                style={{
                  height: `${70 + dragY}px`,
                }}
              />

              {/* Pull Cord Handle / Brass Capsule */}
              <button
                type="button"
                className="lamp-pull-handle"
                onKeyDown={handleKeyDownCord}
                aria-label="Pull cord switch"
                tabIndex={0}
              />

              <span className="lamp-pull-hint">Pull Cord</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Glassmorphism Authentication Card */}
        <section className="lamp-stage-right">
          <div
            className={`lamp-glass-card ${shakeCard ? 'shake' : ''}`}
            style={{
              transform: `perspective(1000px) rotateY(${mouseOffset.x * 2}deg) rotateX(${-mouseOffset.y * 2}deg)`,
            }}
          >
          {/* Specular Highlight Line */}
          <div className="lamp-card-reflection"></div>

          {/* Card Header with EXACT Original Portal Icon */}
          <div className="lamp-card-header">
            <div className="lamp-icon-badge" title={isAdmin ? 'Admin Portal' : 'User Portal'}>
              {isAdmin ? (
                /* EXACT Admin Portal Icon (Person silhouette + Shield in deep blue #1a237e) */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 64 64"
                  width="48"
                  height="48"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="28" cy="20" r="10" fill="#1a237e" />
                  <path
                    d="M8 54c0-11.046 8.954-18 20-18h4c4.2 0 8.1 1.2 11.3 3.3"
                    stroke="#1a237e"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M46 34l8 3.5v7.5c0 4.5-3.5 8.5-8 10-4.5-1.5-8-5.5-8-10v-7.5L46 34z"
                    fill="#1a237e"
                  />
                  <path
                    d="M43 44.5l2.5 2.5 5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              ) : (
                /* EXACT User Portal Icon (Person silhouette in deep blue #1a237e, no shield) */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 64 64"
                  width="48"
                  height="48"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="32" cy="20" r="12" fill="#1a237e" />
                  <path
                    d="M8 56c0-13.255 10.745-20 24-20s24 6.745 24 20"
                    stroke="#1a237e"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              )}
            </div>

            <h1 className="lamp-card-title">
              {!isAdmin && activeTab === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="lamp-card-subtitle">
              {isAdmin
                ? 'Sign in to your Admin Panel'
                : activeTab === 'signup'
                ? 'Sign up to use the College Lost & Found System'
                : 'Sign in to your User Panel'}
            </p>
          </div>

          {/* User Mode: Animated Tab Slider */}
          {!isAdmin && (
            <div className="lamp-tabs-wrap">
              <div
                className={`lamp-tab-slider ${activeTab === 'signup' ? 'slide-right' : ''}`}
              />
              <button
                type="button"
                id="tab-signin-btn"
                className={`lamp-tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('signin');
                  setError('');
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-signup-btn"
                className={`lamp-tab-btn ${activeTab === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('signup');
                  setError('');
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="lamp-alert-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          {/* Registration Pending Info Alert */}
          {infoMsg && (
            <div
              className="lamp-alert-info"
              role="status"
              style={{
                background: 'rgba(67, 233, 123, 0.15)',
                border: '1px solid rgba(67, 233, 123, 0.4)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#43E97B',
                fontSize: '0.85rem',
                marginBottom: '1rem',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Sign In Form */}
          {isAdmin || activeTab === 'signin' ? (
            <form onSubmit={handleLoginSubmit} className="lamp-form" id="lamp-signin-form">
              <div className="lamp-input-group">
                <label className="lamp-input-label" htmlFor="lamp-email">
                  Email
                </label>
                <div className="lamp-input-wrap">
                  <FiMail className="lamp-input-icon" aria-hidden="true" />
                  <input
                    id="lamp-email"
                    type="email"
                    name="email"
                    className="lamp-input-field"
                    placeholder={isAdmin ? 'admin@apsit.edu.in' : 'Student ID@apsit.edu.in'}
                    value={loginForm.email}
                    onChange={(e) => {
                      setLoginForm({ ...loginForm, email: e.target.value });
                      if (error) setError('');
                    }}
                    required
                    autoComplete="email"
                  />
                </div>
                {!isAdmin && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'rgba(255, 255, 255, 0.45)',
                      marginTop: '0.35rem',
                      display: 'block',
                    }}
                  >
                    Use your official APSIT email (e.g. 24107068@apsit.edu.in)
                  </span>
                )}
              </div>

              <div className="lamp-input-group">
                <label className="lamp-input-label" htmlFor="lamp-password">
                  Password
                </label>
                <div className="lamp-input-wrap">
                  <FiLock className="lamp-input-icon" aria-hidden="true" />
                  <input
                    id="lamp-password"
                    type={showPwd ? 'text' : 'password'}
                    name="password"
                    className="lamp-input-field has-toggle"
                    placeholder="Enter password"
                    value={loginForm.password}
                    onChange={(e) => {
                      setLoginForm({ ...loginForm, password: e.target.value });
                      if (error) setError('');
                    }}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lamp-eye-toggle"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id={isAdmin ? 'admin-submit-btn' : 'user-login-submit-btn'}
                className="lamp-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="lamp-spinner"></span>
                    <span>Signing In...</span>
                  </>
                ) : (
                  'Sign In'
                )}
              </button>

              {/* User Switcher to Sign Up */}
              {!isAdmin && (
                <div className="lamp-card-footer">
                  Don't have an account?
                  <button
                    type="button"
                    id="switch-to-signup-btn"
                    className="lamp-toggle-btn"
                    onClick={() => {
                      setActiveTab('signup');
                      setError('');
                    }}
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* Sign Up / Create Account Form */
            <form onSubmit={handleSignUpSubmit} className="lamp-form" id="lamp-signup-form">
              <div className="lamp-grid-2">
                <div className="lamp-input-group">
                  <label className="lamp-input-label" htmlFor="lamp-first-name">
                    First Name
                  </label>
                  <div className="lamp-input-wrap">
                    <FiUser className="lamp-input-icon" aria-hidden="true" />
                    <input
                      id="lamp-first-name"
                      type="text"
                      className="lamp-input-field"
                      placeholder="Alex"
                      value={signUpForm.firstName}
                      onChange={(e) => {
                        setSignUpForm({ ...signUpForm, firstName: e.target.value });
                        if (error) setError('');
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="lamp-input-group">
                  <label className="lamp-input-label" htmlFor="lamp-last-name">
                    Last Name
                  </label>
                  <div className="lamp-input-wrap">
                    <FiUser className="lamp-input-icon" aria-hidden="true" />
                    <input
                      id="lamp-last-name"
                      type="text"
                      className="lamp-input-field"
                      placeholder="Rivera"
                      value={signUpForm.lastName}
                      onChange={(e) => {
                        setSignUpForm({ ...signUpForm, lastName: e.target.value });
                        if (error) setError('');
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="lamp-input-group">
                <label className="lamp-input-label" htmlFor="lamp-signup-email">
                  Email
                </label>
                <div className="lamp-input-wrap">
                  <FiMail className="lamp-input-icon" aria-hidden="true" />
                  <input
                    id="lamp-signup-email"
                    type="email"
                    className="lamp-input-field"
                    placeholder="Student ID@apsit.edu.in"
                    value={signUpForm.email}
                    onChange={(e) => {
                      setSignUpForm({ ...signUpForm, email: e.target.value });
                      if (error) setError('');
                    }}
                    required
                    autoComplete="email"
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'rgba(255, 255, 255, 0.45)',
                    marginTop: '0.35rem',
                    display: 'block',
                  }}
                >
                  Use your official APSIT email (e.g. 24107068@apsit.edu.in)
                </span>
              </div>

              <div className="lamp-grid-2">
                <div className="lamp-input-group">
                  <label className="lamp-input-label" htmlFor="lamp-signup-password">
                    Password
                  </label>
                  <div className="lamp-input-wrap">
                    <FiLock className="lamp-input-icon" aria-hidden="true" />
                    <input
                      id="lamp-signup-password"
                      type={showPwd ? 'text' : 'password'}
                      className="lamp-input-field has-toggle"
                      placeholder="Min 6 chars"
                      value={signUpForm.password}
                      onChange={(e) => {
                        setSignUpForm({ ...signUpForm, password: e.target.value });
                        if (error) setError('');
                      }}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="lamp-eye-toggle"
                      onClick={() => setShowPwd(!showPwd)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>

                <div className="lamp-input-group">
                  <label className="lamp-input-label" htmlFor="lamp-signup-confirm-password">
                    Confirm Password
                  </label>
                  <div className="lamp-input-wrap">
                    <FiLock className="lamp-input-icon" aria-hidden="true" />
                    <input
                      id="lamp-signup-confirm-password"
                      type={showConfirmPwd ? 'text' : 'password'}
                      className="lamp-input-field has-toggle"
                      placeholder="Confirm"
                      value={signUpForm.confirmPassword}
                      onChange={(e) => {
                        setSignUpForm({ ...signUpForm, confirmPassword: e.target.value });
                        if (error) setError('');
                      }}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="lamp-eye-toggle"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPwd ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Strength Meter */}
              {signUpForm.password && (
                <div className="lamp-strength-wrap">
                  <div className="lamp-strength-bars">
                    <div className={`lamp-strength-bar ${strength.score >= 1 ? 'active-weak' : ''}`} />
                    <div className={`lamp-strength-bar ${strength.score >= 2 ? 'active-fair' : ''}`} />
                    <div className={`lamp-strength-bar ${strength.score >= 3 ? 'active-good' : ''}`} />
                    <div className={`lamp-strength-bar ${strength.score >= 4 ? 'active-strong' : ''}`} />
                  </div>
                  <span className="lamp-strength-text">Password: {strength.label}</span>
                </div>
              )}

              <button
                type="submit"
                id="user-signup-submit-btn"
                className="lamp-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="lamp-spinner"></span>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  'Sign Up'
                )}
              </button>

              <div className="lamp-card-footer">
                Already have an account?
                <button
                  type="button"
                  id="switch-to-signin-btn"
                  className="lamp-toggle-btn"
                  onClick={() => {
                    setActiveTab('signin');
                    setError('');
                  }}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}
        </div>
        </section>
      </main>
    </div>
  );
}
