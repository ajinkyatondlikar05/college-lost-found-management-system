const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { sendOtpEmail } = require('../utils/email');

// @route   GET /api/items
// @desc    Get all items (with filters, date range, location, sorting)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { type, category, status, search, location, fromDate, toDate, sortBy = 'newest', page = 1, limit = 50 } = req.query;
    const filter = {};

    if (type && type !== 'all') filter.type = type;
    if (category && category !== 'All Categories' && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status = status;
    if (location) {
      filter.location = { $regex: location.trim(), $options: 'i' };
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) {
        const toD = new Date(toDate);
        toD.setHours(23, 59, 59, 999);
        filter.date.$lte = toD;
      }
    }

    if (search) {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
    }

    let sortObj = { createdAt: -1 };
    if (sortBy === 'oldest') sortObj = { createdAt: 1 };
    else if (sortBy === 'title_asc' || sortBy === 'az') sortObj = { title: 1 };
    else if (sortBy === 'title_desc' || sortBy === 'za') sortObj = { title: -1 };

    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .populate('reportedBy', 'name email department phone studentId')
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      items,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/items/:id
// @desc    Get item by ID with full reporter info for authorized details view
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate(
      'reportedBy',
      'name email phone department studentId'
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/items/send-report-otp
// @desc    Generate and email 6-digit verification OTP for lost or found item reporting
// @access  Private
router.post('/send-report-otp', protect, async (req, res) => {
  try {
    const email = (req.body.email || req.user.email || '').trim().toLowerCase();
    const name = req.body.name || req.user.name || 'Student';
    const type = (req.body.type || 'lost').toLowerCase();
    const purpose = type === 'found' ? 'report_found_item' : 'report_lost_item';

    if (!email) {
      return res.status(400).json({ message: 'Email address is required for OTP verification' });
    }

    console.log(`[OTP] Received ${type} item OTP verification request for recipient: ${email}`);

    // Generate 6 digit numeric code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes valid

    // Clean up existing OTPs for this email and purpose
    await Otp.deleteMany({ email, purpose: { $in: ['report_lost_item', 'report_found_item', 'report_item', purpose] } });

    // Store in DB
    await Otp.create({
      email,
      otp,
      purpose,
      expiresAt,
    });

    console.log(`[OTP] 6-digit verification OTP successfully generated and saved for recipient: ${email}`);

    // Send real email via configured Gmail SMTP
    const emailRes = await sendOtpEmail(email, name, otp, type);
    if (!emailRes.success) {
      console.error(`[OTP] Delivery failure for ${email}: ${emailRes.error}`);
      return res.status(500).json({
        message: 'Could not send verification OTP to your email. Please try again.',
        error: emailRes.error,
      });
    }

    console.log(`[OTP] Verification OTP successfully sent to: ${email}`);
    res.json({
      success: true,
      message: `We've sent a 6-digit OTP to ${email}`,
      email,
    });
  } catch (error) {
    console.error(`[OTP] Unexpected error during OTP generation: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/items
// @desc    Create a new item report (with optional or required OTP verification for lost/found items)
// @access  Private
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, category, description, location, date, type = 'lost', contactInfo, name, email, phone, otp } = req.body;

    if (!title || !category) {
      return res.status(400).json({ message: 'Item name and category are required' });
    }

    // If OTP is submitted or reporting as a student user, verify the OTP code
    if (otp || req.user.role !== 'admin') {
      const targetEmail = (email || req.user.email || '').trim().toLowerCase();
      if (!otp) {
        return res.status(400).json({ message: `6-digit OTP verification is required to report this ${type} item` });
      }

      const otpRecord = await Otp.findOne({
        email: targetEmail,
        otp: otp.trim(),
        purpose: { $in: ['report_lost_item', 'report_found_item', 'report_item'] },
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        return res.status(400).json({ message: 'Invalid or expired OTP code. Please request a new one.' });
      }

      // Delete verified OTP so it cannot be re-used
      await Otp.deleteOne({ _id: otpRecord._id });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image || null;

    const contactStr = contactInfo || (phone ? `Phone: ${phone}` : '') + (email ? ` | Email: ${email}` : '');

    if (phone) {
      await User.findByIdAndUpdate(req.user._id, { phone: phone.trim() });
    }

    const item = await Item.create({
      title,
      category,
      description: description || 'No description provided',
      location: location || 'Campus',
      date: date ? new Date(date) : new Date(),
      type,
      image,
      contactInfo: contactStr || req.user.email,
      reportedBy: req.user._id,
      status: 'Pending',
    });

    const populated = await item.populate('reportedBy', 'name email department phone studentId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/items/:id
// @desc    Update an item
// @access  Private
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Only owner or admin can update
    if (item.reportedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    const updates = { ...req.body };
    if (req.file) updates.image = `/uploads/${req.file.filename}`;

    const updated = await Item.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('reportedBy', 'name email department');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/items/:id
// @desc    Delete an item (restricted to owner or admin, cannot delete resolved/claimed history)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.reportedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    if (req.user.role !== 'admin' && (item.status === 'Resolved' || item.status === 'Claimed')) {
      return res.status(400).json({
        message: 'Resolved or claimed reports cannot be deleted and must remain in history.',
      });
    }

    await item.deleteOne();
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/items/user/my-reports
// @desc    Get authenticated student's reports with linked claims and resolution info
// @access  Private
router.get('/user/my-reports', protect, async (req, res) => {
  try {
    const Claim = require('../models/Claim');
    const items = await Item.find({ reportedBy: req.user._id })
      .populate('reportedBy', 'name email department phone studentId')
      .populate('claimedBy', 'name email studentId')
      .sort({ createdAt: -1 })
      .lean();

    const itemIds = items.map((i) => i._id);
    const claims = await Claim.find({ item: { $in: itemIds } })
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const enrichedItems = items.map((item) => {
      const itemClaims = claims.filter(
        (c) => c.item && c.item.toString() === item._id.toString()
      );
      const latestClaim = itemClaims[0] || null;
      return {
        ...item,
        claims: itemClaims,
        latestClaim,
        claimStatus: latestClaim ? latestClaim.status : null,
      };
    });

    res.json(enrichedItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
