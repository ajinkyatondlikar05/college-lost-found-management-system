const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/email');

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/users/stats
// @desc    Get dashboard stats (admin)
// @access  Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingStudents = await User.countDocuments({ role: 'user', status: 'pending' });
    const approvedStudents = await User.countDocuments({ role: 'user', status: 'approved' });
    const rejectedStudents = await User.countDocuments({ role: 'user', status: 'rejected' });

    const totalItems = await Item.countDocuments();
    const lostItems = await Item.countDocuments({ type: 'lost' });
    const foundItems = await Item.countDocuments({ type: 'found' });
    const resolvedItems = await Item.countDocuments({ status: 'resolved' });
    const activeItems = await Item.countDocuments({ status: 'active' });

    // Recent items
    const recentItems = await Item.find()
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalUsers,
      pendingStudents,
      approvedStudents,
      rejectedStudents,
      totalItems,
      lostItems,
      foundItems,
      resolvedItems,
      activeItems,
      recentItems,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/users/:id/approve
// @desc    Approve a student account (admin only)
// @access  Admin
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    // 1. Find the student in MongoDB
    const user = await User.findById(req.params.id);

    // 2. Verify the student exists
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // 3. Update fields
    user.status = 'approved';
    user.approved = true;
    user.approvedAt = new Date();
    user.approvedBy = req.user._id;
    user.rejectedAt = null;
    user.rejectedBy = null;

    // 4. SAVE the database change
    await user.save();

    // 5 & 6. ONLY AFTER database update succeeds, send approval email and wait for confirmation
    const emailResult = await sendApprovalEmail(user);

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('approvedBy', 'name email');

    // 7. Return response based on real email delivery outcome
    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Student account approved! Approval email sent.',
        student: updatedUser,
        user: updatedUser,
        emailSent: true,
        messageId: emailResult.messageId,
      });
    } else {
      return res.json({
        success: true,
        message: 'Student approved, but email notification failed.',
        student: updatedUser,
        user: updatedUser,
        emailSent: false,
        error: emailResult.error,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/:id/reject
// @desc    Reject a student account (admin only)
// @access  Admin
router.put('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    // 1. Find student
    const user = await User.findById(req.params.id);

    // 2. Verify student exists
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // 3. Update fields
    user.status = 'rejected';
    user.approved = false;
    user.rejectedAt = new Date();
    user.rejectedBy = req.user._id;

    // 4. Save MongoDB
    await user.save();

    // 5 & 6. ONLY AFTER successful DB update, send rejection email and wait for confirmation
    const emailResult = await sendRejectionEmail(user);

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('rejectedBy', 'name email');

    // 7. Return response based on real email delivery outcome
    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Student account rejected. Notification email sent.',
        student: updatedUser,
        user: updatedUser,
        emailSent: true,
        messageId: emailResult.messageId,
      });
    } else {
      return res.json({
        success: true,
        message: 'Student rejected, but email notification failed.',
        student: updatedUser,
        user: updatedUser,
        emailSent: false,
        error: emailResult.error,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role (admin only)
// @access  Admin
router.put('/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user (admin only)
// @access  Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Also delete their items
    await Item.deleteMany({ reportedBy: req.params.id });
    res.json({ message: 'User and their items deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
