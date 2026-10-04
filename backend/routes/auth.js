const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'apsit_jwt_fallback_secret_key', { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, password, phone, department } = req.body;

    if (!req.body.email) {
      return res.status(400).json({
        message: "Please use your official college email (example: 24107068@apsit.edu.in)."
      });
    }

    const email = req.body.email.trim().toLowerCase();
    const collegeEmailRegex = /^[0-9]+@apsit\.edu\.in$/i;

    // ============================================================================
    // PERMANENT PRODUCTION / DEMO LOGIN EXCEPTION (ajinkyatondlikar@gmail.com)
    // ============================================================================
    const demoEmail = (process.env.DEMO_LOGIN_EMAIL || process.env.TEMP_TEST_LOGIN_EMAIL || 'ajinkyatondlikar@gmail.com').trim().toLowerCase();
    const isDemoEmail = Boolean(demoEmail && email === demoEmail);
    // ============================================================================

    if (!collegeEmailRegex.test(email) && !isDemoEmail) {
      return res.status(400).json({
        message: "Please use your official college email (example: 24107068@apsit.edu.in)."
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (isDemoEmail) {
        existingUser.password = password;
        if (name) existingUser.name = name;
        if (phone) existingUser.phone = phone;
        if (department) existingUser.department = department;
        existingUser.status = 'approved';
        existingUser.approved = true;
        await existingUser.save();
        return res.status(201).json({
          message: 'Registration submitted successfully.',
          status: 'approved',
          approved: true,
          user: {
            _id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            studentId: existingUser.studentId,
            status: existingUser.status,
            approved: existingUser.approved,
          },
        });
      }
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Extract student ID from college email
    const studentId = isDemoEmail ? '99999999' : email.split('@')[0];

    // Create user with pending status
    const user = await User.create({
      name,
      email,
      studentId,
      password,
      phone,
      department,
      status: isDemoEmail ? 'approved' : 'pending',
      approved: isDemoEmail ? true : false,
      role: 'user',
    });

    res.status(201).json({
      message: isDemoEmail
        ? 'Registration submitted successfully.'
        : 'Registration submitted successfully. Your account is waiting for admin approval.',
      status: isDemoEmail ? 'approved' : 'pending',
      approved: isDemoEmail ? true : false,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        status: user.status,
        approved: user.approved,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Login user & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    if (!req.body.email) {
      return res.status(400).json({
        message: "Please use your official college email (example: 24107068@apsit.edu.in)."
      });
    }

    const email = req.body.email.trim().toLowerCase();
    const { password, isAdmin } = req.body;
    const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@apsit.edu.in').trim().toLowerCase();
    const isAdminLogin = Boolean(isAdmin);

    // ========================================================
    // DEDICATED ADMIN PORTAL LOGIN
    // ========================================================
    if (isAdminLogin) {
      // 1. If a student account attempts admin login, deny with 403
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access denied' });
      }

      // 2. Admin login must accept ONLY: admin@apsit.edu.in
      if (email !== ADMIN_EMAIL) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      const adminUser = existingUser || (await User.findOne({ email: ADMIN_EMAIL }));
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      if (!(await adminUser.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      return res.json({
        _id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status,
        approved: adminUser.approved,
        token: generateToken(adminUser._id),
      });
    }

    // ========================================================
    // USER PORTAL LOGIN
    // ========================================================

    // ============================================================================
    // PERMANENT PRODUCTION / DEMO LOGIN EXCEPTION (ajinkyatondlikar@gmail.com)
    // ============================================================================
    const demoEmail = (process.env.DEMO_LOGIN_EMAIL || process.env.TEMP_TEST_LOGIN_EMAIL || 'ajinkyatondlikar@gmail.com').trim().toLowerCase();
    const demoEnvPassword = process.env.DEMO_LOGIN_PASSWORD || process.env.TEMP_TEST_LOGIN_PASSWORD || '';

    if (demoEmail && email === demoEmail) {
      let testUser = await User.findOne({ email: demoEmail });
      let passwordValid = false;

      if (demoEnvPassword) {
        passwordValid = (password === demoEnvPassword);
      } else if (testUser) {
        if (typeof testUser.matchPassword === 'function') {
          passwordValid = await testUser.matchPassword(password);
        } else if (typeof testUser.comparePassword === 'function') {
          passwordValid = await testUser.comparePassword(password);
        }
      }

      if (!passwordValid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!testUser) {
        try {
          testUser = await User.create({
            name: 'Ajinkya Tondlikar',
            email: demoEmail,
            studentId: '99999999',
            password: demoEnvPassword || password,
            role: 'user',
            status: 'approved',
            approved: true,
          });
        } catch (dbErr) {
          testUser = {
            _id: '64a1f1000000000000000099',
            name: 'Ajinkya Tondlikar',
            email: demoEmail,
            studentId: '99999999',
            role: 'user',
            status: 'approved',
            approved: true,
          };
        }
      } else {
        let needsSave = false;
        if (testUser.role !== 'user') {
          testUser.role = 'user';
          needsSave = true;
        }
        if (testUser.status !== 'approved' || !testUser.approved) {
          testUser.status = 'approved';
          testUser.approved = true;
          needsSave = true;
        }
        if (needsSave && typeof testUser.save === 'function') {
          await testUser.save();
        }
      }

      const userId = testUser._id || '64a1f1000000000000000099';
      return res.json({
        _id: userId,
        name: testUser.name || 'Ajinkya Tondlikar',
        email: testUser.email || demoEmail,
        studentId: testUser.studentId || '99999999',
        phone: testUser.phone || '',
        department: testUser.department || 'Computer Engineering',
        role: testUser.role || 'user',
        status: testUser.status || 'approved',
        approved: testUser.approved !== undefined ? testUser.approved : true,
        token: generateToken(userId),
      });
    }
    // ============================================================================

    const collegeEmailRegex = /^[0-9]+@apsit\.edu\.in$/i;

    if (!collegeEmailRegex.test(email)) {
      return res.status(400).json({
        message: "Please use your official college email (example: 24107068@apsit.edu.in)."
      });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Enforce student approval status check
    if (user.role !== 'admin') {
      if (user.status === 'rejected') {
        return res.status(403).json({
          message: 'Your account has been rejected. Please contact the administrator.',
        });
      }

      if (user.status === 'pending' || !user.approved || user.status !== 'approved') {
        return res.status(403).json({
          message: 'Your account is waiting for administrator approval.',
        });
      }
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      studentId: user.studentId,
      phone: user.phone,
      department: user.department,
      role: user.role,
      status: user.status,
      approved: user.approved,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get logged-in user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
