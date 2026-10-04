const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Claim = require('../models/Claim');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const PRIMARY_ADMIN_EMAIL = 'admin@apsit.edu.in';

// @route   GET /api/admin/analytics
// @desc    Get real analytics data for dashboard charts
// @access  Admin
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    // 1. Category aggregation
    const categoryAgg = await Item.aggregate([
      { $match: { category: { $exists: true, $ne: '' } } },
      { $group: { _id: '$category', item_count: { $sum: 1 } } },
      { $sort: { item_count: -1 } },
    ]);
    const category_data = categoryAgg.map((c) => ({
      category_name: c._id,
      item_count: c.item_count,
    }));

    // If no items yet, provide empty array
    // 2. Last 7 Days Activity
    const weekly_data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const itemCount = await Item.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });
      const claimCount = await Claim.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      weekly_data.push({
        date: startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        total_reports: itemCount + claimCount,
      });
    }

    // 3. Top 4 Locations Reported
    const locationAgg = await Item.aggregate([
      { $match: { location: { $exists: true, $ne: '' } } },
      { $group: { _id: '$location', report_count: { $sum: 1 } } },
      { $sort: { report_count: -1 } },
      { $limit: 4 },
    ]);
    const location_data = locationAgg.map((l) => ({
      location_lost: l._id,
      report_count: l.report_count,
    }));

    // 4. Status Distribution
    const statusAgg = await Item.aggregate([
      { $match: { status: { $exists: true, $ne: '' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const status_data = {};
    statusAgg.forEach((s) => {
      const key = s._id ? s._id.charAt(0).toUpperCase() + s._id.slice(1).toLowerCase() : 'Unknown';
      status_data[key] = (status_data[key] || 0) + s.count;
    });

    // 5. Summary metrics matching section workflow rules:
    // LOST ITEMS: active unresolved LOST reports without active finder
    const total_lost = await Item.countDocuments({
      type: 'lost',
      status: { $nin: ['Resolved', 'Claimed', 'resolved', 'claimed'] },
      foundBy: null,
    });

    // FOUND ITEMS: normal FOUND reports (unresolved) + LOST items with active finder (unresolved)
    const total_found = await Item.countDocuments({
      $or: [
        { type: 'found', status: { $nin: ['Resolved', 'Claimed', 'resolved', 'claimed'] } },
        { type: 'lost', status: { $nin: ['Resolved', 'Claimed', 'resolved', 'claimed'] }, foundBy: { $ne: null } },
      ],
    });

    // CLAIM REQUESTS: active/incomplete claims only
    const pending_claims = await Claim.countDocuments({
      status: { $in: ['pending', 'Contacted', 'Pending Owner Confirmation', 'Pending Admin Verification', 'approved'] },
    });

    // CLAIMED: final resolved/complete recoveries only
    const total_claimed = await Item.countDocuments({
      status: { $in: ['Resolved', 'Claimed', 'resolved', 'claimed'] },
    });

    const total_claims = await Claim.countDocuments();
    const pending_users = await User.countDocuments({ role: 'user', status: 'pending' });

    res.json({
      total_lost,
      total_found,
      total_claims,
      pending_claims,
      pending_users,
      total_claimed,
      category_data,
      weekly_data,
      location_data,
      status_data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/notifications
// @desc    Get recent live notifications for the bell dropdown
// @access  Admin
router.get('/notifications', protect, adminOnly, async (req, res) => {
  try {
    const notifications = [];

    // Recent claims
    const recentClaims = await Claim.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    recentClaims.forEach((c) => {
      notifications.push({
        id: `claim-${c._id}`,
        type: 'claim',
        title: c.fullName || 'Someone',
        details: `Claim on: ${c.itemName || 'Item'}`,
        created_at: c.createdAt,
        link: '/admin/claim-requests',
      });
    });

    // Recent lost items
    const recentLost = await Item.find({ type: 'lost' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    recentLost.forEach((item) => {
      notifications.push({
        id: `lost-${item._id}`,
        type: 'lost_item',
        title: item.title,
        details: `Location: ${item.location}`,
        created_at: item.createdAt,
        link: '/admin/lost-items',
      });
    });

    // Recent found items
    const recentFound = await Item.find({ type: 'found' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    recentFound.forEach((item) => {
      notifications.push({
        id: `found-${item._id}`,
        type: 'found_item',
        title: item.title,
        details: `Location: ${item.location}`,
        created_at: item.createdAt,
        link: '/admin/found-items',
      });
    });

    // Recent registered students
    const recentStudents = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    recentStudents.forEach((student) => {
      notifications.push({
        id: `student-${student._id}`,
        type: 'student_registration',
        title: student.name,
        details: `Status: ${student.status}`,
        created_at: student.createdAt,
        link: '/admin/users',
      });
    });

    // Sort by timestamp descending and take 10
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const recent = notifications.slice(0, 10);

    res.json(recent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/admins
// @desc    Get all admin users
// @access  Admin
router.get('/admins', protect, adminOnly, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/admin/admins
// @desc    Create new admin user
// @access  Admin
router.post('/admins', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const newAdmin = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      status: 'approved',
      approved: true,
      approvedAt: new Date(),
    });

    const sanitized = await User.findById(newAdmin._id).select('-password');
    res.status(201).json(sanitized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/admin/admins/:id
// @desc    Update admin user
// @access  Admin
router.put('/admins/:id', protect, adminOnly, async (req, res) => {
  try {
    const adminUser = await User.findById(req.params.id);
    if (!adminUser) return res.status(404).json({ message: 'Admin not found' });

    // Primary admin protections
    const isPrimary = adminUser.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();

    if (req.body.name) adminUser.name = req.body.name;
    if (req.body.email && !isPrimary) {
      adminUser.email = req.body.email.toLowerCase();
    }
    if (req.body.role && !isPrimary) {
      adminUser.role = req.body.role;
    }
    if (req.body.password && req.body.password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      adminUser.password = await bcrypt.hash(req.body.password, salt);
    }

    await adminUser.save();
    const sanitized = await User.findById(adminUser._id).select('-password');
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/admin/admins/:id
// @desc    Delete admin user (dedicated admin protected)
// @access  Admin
router.delete('/admins/:id', protect, adminOnly, async (req, res) => {
  try {
    const adminUser = await User.findById(req.params.id);
    if (!adminUser) return res.status(404).json({ message: 'Admin not found' });

    if (adminUser.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({
        message: 'The dedicated primary admin account (admin@apsit.edu.in) cannot be deleted.',
      });
    }

    await adminUser.deleteOne();
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
