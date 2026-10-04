const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Item = require('../models/Item');
const User = require('../models/User');
const Otp = require('../models/Otp');
const Claim = require('../models/Claim');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadImage } = require('../config/cloudinary');
const emailUtils = require('../utils/email');

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
      .populate([
        { path: 'reportedBy', select: 'name email department phone studentId' },
        { path: 'foundBy', select: 'name email department phone studentId' },
        { path: 'claimedBy', select: 'name email department phone studentId' },
        { path: 'recoveredBy', select: 'name email department phone studentId' },
        { path: 'ownerConfirmedBy', select: 'name email department phone studentId' },
      ])
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
    const item = await Item.findById(req.params.id)
      .populate([
        { path: 'reportedBy', select: 'name email phone department studentId' },
        { path: 'foundBy', select: 'name email phone department studentId' },
        { path: 'claimedBy', select: 'name email phone department studentId' },
        { path: 'recoveredBy', select: 'name email phone department studentId' },
        { path: 'ownerConfirmedBy', select: 'name email phone department studentId' },
      ]);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const claims = await Claim.find({ item: item._id })
      .populate('finder', 'name email phone studentId department')
      .populate('owner', 'name email phone studentId department')
      .sort({ createdAt: -1 });

    const itemObj = item.toObject ? item.toObject() : { ...item };
    itemObj.claims = claims;

    // Check requester credentials from optional Bearer token
    let requester = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          requester = await User.findById(decoded.id).select('name email role');
        }
      } catch (tokenErr) {
        // Unauthenticated or expired token
      }
    }

    const ownerId = item.reportedBy?._id ? item.reportedBy._id.toString() : (item.reportedBy ? item.reportedBy.toString() : '');
    const isOwner = requester && ownerId && (ownerId === requester._id.toString());
    const isAdmin = requester && requester.role === 'admin';

    // PRIVACY FILTER:
    // Finder phone/email must remain visible ONLY to the lost-item owner and authorized admin.
    if (!isOwner && !isAdmin) {
      if (itemObj.foundBy && typeof itemObj.foundBy === 'object') {
        itemObj.foundBy = {
          _id: itemObj.foundBy._id,
          name: itemObj.foundBy.name,
        };
      }
      if (itemObj.claims && Array.isArray(itemObj.claims)) {
        itemObj.claims = itemObj.claims.map((claim) => {
          const c = claim.toObject ? claim.toObject() : { ...claim };
          const isFinder = requester && c.finder && (
            (c.finder._id && c.finder._id.toString() === requester._id.toString()) ||
            c.finder.toString() === requester._id.toString()
          );
          if (!isFinder) {
            delete c.phone;
            delete c.email;
            delete c.finderMessage;
            delete c.additionalDetails;
            delete c.image;
            if (c.finder && typeof c.finder === 'object') {
              c.finder = {
                _id: c.finder._id,
                name: c.finder.name,
              };
            }
          }
          return c;
        });
      }
    }

    res.json(itemObj);
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
    const emailRes = await emailUtils.sendOtpEmail(email, name, otp, type);
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

// @route   POST /api/items/verify-report-otp
// @desc    Verify 6-digit OTP for lost or found item reporting
// @access  Private
router.post('/verify-report-otp', protect, async (req, res) => {
  try {
    const email = (req.body.email || req.user.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();

    if (!email) {
      return res.status(400).json({ message: 'Email address is required for OTP verification' });
    }

    if (!otp) {
      return res.status(400).json({ message: 'Please enter the 6-digit OTP' });
    }

    const otpRecord = await Otp.findOne({
      email,
      otp,
      purpose: { $in: ['report_lost_item', 'report_found_item', 'report_item'] },
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP code. Please request a new one.' });
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
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

    if (req.user.role !== 'admin' && (!phone || !phone.trim())) {
      return res.status(400).json({ message: 'Phone number is required' });
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

    let image = req.body.image || null;
    if (req.file) {
      try {
        image = await uploadImage(req.file, 'college-lost-found/items');
      } catch (uploadErr) {
        return res.status(500).json({ message: uploadErr.message || 'Image upload failed' });
      }
    }

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
    if (req.file) {
      try {
        updates.image = await uploadImage(req.file, 'college-lost-found/items');
      } catch (uploadErr) {
        return res.status(500).json({ message: uploadErr.message || 'Image upload failed' });
      }
    }

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
      .populate('foundBy', 'name email department phone studentId')
      .populate('claimedBy', 'name email studentId')
      .populate('recoveredBy', 'name email department phone studentId')
      .populate('ownerConfirmedBy', 'name email department phone studentId')
      .sort({ createdAt: -1 })
      .lean();

    const itemIds = items.map((i) => i._id);
    const claims = await Claim.find({ item: { $in: itemIds } })
      .populate('finder', 'name email phone studentId department')
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

// @route   POST /api/items/:id/recovery-otp
// @desc    Send 6-digit OTP to authenticated owner's college email for "I Got My Item Back" verification
// @access  Private (Owner only)
router.post(['/:id/recovery-otp', '/:id/send-recovery-otp'], protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.status === 'Resolved') {
      return res.status(400).json({ message: 'This item has already been marked as resolved.' });
    }

    // Only owner (or admin) can request recovery OTP
    const ownerId = item.reportedBy?._id ? item.reportedBy._id.toString() : (item.reportedBy ? item.reportedBy.toString() : '');
    if (ownerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the item owner can initiate recovery OTP verification.' });
    }

    // Retrieve owner's verified college email from database (never trust arbitrary email from frontend)
    const ownerUser = await User.findById(req.user._id);
    if (!ownerUser || !ownerUser.email) {
      return res.status(404).json({ message: 'Authenticated user email not found.' });
    }

    const email = ownerUser.email.toLowerCase().trim();
    const name = ownerUser.name || 'Student';

    console.log(`[OTP] Received recovery OTP verification request for recipient: ${email}`);

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing recovery OTPs for this email
    await Otp.deleteMany({ email, purpose: { $in: ['item_recovery', 'owner_recovery'] } });

    // Save new OTP
    await Otp.create({
      email,
      otp,
      purpose: 'item_recovery',
      expiresAt,
    });

    console.log(`[OTP] 6-digit recovery verification OTP successfully generated and saved for recipient: ${email}`);

    // Send OTP email
    const emailRes = await emailUtils.sendOtpEmail(email, name, otp, 'recovery');
    if (!emailRes.success) {
      console.error(`[OTP] Recovery delivery failure for ${email}: ${emailRes.error}`);
      return res.status(500).json({
        message: 'Could not send verification OTP to your college email. Please try again.',
        error: emailRes.error,
      });
    }

    console.log(`[OTP] Recovery verification OTP successfully sent to: ${email}`);

    // Masked college email
    const [local, domain] = email.split('@');
    const maskedLocal = local && local.length > 4 ? `${local.slice(0, 3)}***${local.slice(-2)}` : `${(local || '')[0] || '*'}***`;
    const maskedEmail = `${maskedLocal}@${domain || 'apsit.edu.in'}`;

    res.json({
      success: true,
      message: `We've sent a 6-digit OTP to ${maskedEmail}`,
      maskedEmail,
    });
  } catch (error) {
    console.error(`[OTP] Unexpected error during recovery OTP generation: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/items/:id/recover
// @desc    Lost item owner submits recovery request after OTP verification (directly resolves item and claim without admin approval)
// @access  Private (Owner or Admin)
router.put('/:id/recover', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Only owner or admin can confirm recovery
    const ownerId = item.reportedBy?._id ? item.reportedBy._id.toString() : (item.reportedBy ? item.reportedBy.toString() : '');
    if (ownerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the item owner or an admin can confirm recovery of this item.' });
    }

    if (item.status === 'Resolved') {
      return res.status(400).json({ message: 'This item has already been marked as resolved.' });
    }

    const now = new Date();

    // Admin behavior remains unchanged (can directly resolve without OTP if desired)
    if (req.user.role === 'admin' && !req.body.otp) {
      const claim = await Claim.findOne({
        item: item._id,
        status: { $in: ['Contacted', 'Pending Owner Confirmation', 'Pending Admin Verification', 'pending', 'approved'] },
      }).sort({ createdAt: -1 });

      if (claim) {
        claim.status = 'resolved';
        claim.resolvedAt = now;
        await claim.save();

        if (claim.finder) {
          item.foundBy = claim.finder;
          item.claimedBy = claim.finder;
        }
      }

      item.status = 'Resolved';
      if (!item.recoveryType) {
        item.recoveryType = item.type === 'found' ? 'normal_found' : 'finder_found';
      }
      item.resolvedAt = now;
      await item.save();

      const populated = await Item.findById(item._id).populate([
        { path: 'reportedBy', select: 'name email department phone studentId' },
        { path: 'foundBy', select: 'name email department phone studentId' },
        { path: 'claimedBy', select: 'name email department phone studentId' },
      ]);

      const result = populated && populated.toObject ? populated.toObject() : { ...populated };
      result.success = true;
      result.message = 'Item marked as recovered and resolved successfully!';
      result.item = populated;
      return res.json(result);
    }

    // For owner: OTP verification is mandatory
    const submittedOtp = (req.body.otp || '').toString().trim();
    if (!submittedOtp) {
      return res.status(400).json({ message: 'Verification OTP is required to submit recovery for admin verification.' });
    }

    // Retrieve owner's verified college email from database (never trust frontend email/ID)
    const ownerUser = await User.findById(req.user._id);
    if (!ownerUser || !ownerUser.email) {
      return res.status(404).json({ message: 'Authenticated user record not found.' });
    }
    const email = ownerUser.email.toLowerCase().trim();

    // Check if OTP is expired
    const expiredRecord = await Otp.findOne({
      email,
      otp: submittedOtp,
      purpose: { $in: ['item_recovery', 'owner_recovery', 'report_lost_item', 'report_found_item', 'report_item'] },
      expiresAt: { $lte: now },
    });
    if (expiredRecord) {
      return res.status(400).json({ message: 'Verification OTP has expired. Please request a new OTP.' });
    }

    // Check valid non-expired OTP
    const validOtpRecord = await Otp.findOne({
      email,
      otp: submittedOtp,
      purpose: { $in: ['item_recovery', 'owner_recovery', 'report_lost_item', 'report_found_item', 'report_item'] },
      expiresAt: { $gt: now },
    });

    if (!validOtpRecord) {
      return res.status(400).json({ message: 'Invalid OTP code. Please check and try again.' });
    }

    // Invalidate/delete the OTP so it cannot be reused
    await Otp.deleteMany({
      email,
      purpose: { $in: ['item_recovery', 'owner_recovery', 'report_lost_item', 'report_found_item', 'report_item'] },
    });

    // Find the latest active claim for this item
    const claim = await Claim.findOne({
      item: item._id,
      status: { $in: ['Contacted', 'Pending Owner Confirmation', 'pending', 'approved'] },
    }).sort({ createdAt: -1 });

    if (claim && req.body.recoveryType !== 'owner_found') {
      // CASE 1 — ANOTHER STUDENT FINDS THE ITEM
      // After successful owner OTP:
      // - item.status = "Resolved"
      // - claim.status = "resolved"
      // - item.resolvedAt = current time
      // - claim.resolvedAt = current time
      // - item.foundBy = final finder
      // - record ownerConfirmedAt
      // - record ownerConfirmedBy
      // - no admin approval required
      // Then:
      // - send resolution email to owner
      // - send resolution email to finder
      claim.status = 'resolved';
      claim.resolvedAt = now;
      claim.ownerConfirmedAt = now;
      claim.ownerConfirmedBy = req.user._id;

      if (claim.finder) {
        item.foundBy = claim.finder;
        item.claimedBy = claim.finder;
      }

      item.status = 'Resolved';
      item.recoveryType = 'finder_found';
      item.resolvedAt = now;
      item.ownerConfirmedAt = now;
      item.ownerConfirmedBy = req.user._id;

      await claim.save();
      await item.save();

      // Retrieve finder information for email dispatch
      const finderUser = claim.finder ? await User.findById(claim.finder) : null;
      const finalFinderName = claim.fullName || (finderUser ? finderUser.name : 'Student');
      const finalFinderEmail = claim.email || (finderUser ? finderUser.email : null);

      // Send resolution email to owner
      try {
        await emailUtils.sendOwnerResolutionEmail({
          ownerEmail: ownerUser.email,
          ownerName: ownerUser.name,
          itemName: item.title,
          finderName: finalFinderName,
          resolutionDate: now,
        });
        claim.ownerResolutionEmailSentAt = now;
      } catch (ownerEmailErr) {
        console.error(`[SMTP] Error sending owner resolution email: ${ownerEmailErr.message}`);
      }

      // Send resolution email to finder
      if (finalFinderEmail) {
        try {
          await emailUtils.sendFinderResolutionEmail({
            finderEmail: finalFinderEmail,
            finderName: finalFinderName,
            itemName: item.title,
            resolutionDate: now,
          });
          claim.finderResolutionEmailSentAt = now;
        } catch (finderEmailErr) {
          console.error(`[SMTP] Error sending finder resolution email: ${finderEmailErr.message}`);
        }
      }

      await claim.save();

      const populated = await Item.findById(item._id).populate([
        { path: 'reportedBy', select: 'name email department phone studentId' },
        { path: 'foundBy', select: 'name email department phone studentId' },
        { path: 'claimedBy', select: 'name email department phone studentId' },
        { path: 'recoveredBy', select: 'name email department phone studentId' },
        { path: 'ownerConfirmedBy', select: 'name email department phone studentId' },
      ]);

      const result = populated && populated.toObject ? populated.toObject() : { ...populated };
      result.success = true;
      result.status = 'Resolved';
      result.message = 'Item marked as Resolved! Resolution emails have been sent to you and the finder.';
      result.item = populated;
      result.claim = claim;

      return res.json(result);
    }

    // OWNER SELF-RECOVERY: DIRECT RESOLUTION + EMAIL
    // 1. Directly resolve the item.
    // 2. Do NOT require admin approval.
    // 3. Do NOT create a finder claim.
    // 4. Set:
    //    - item.status = "Resolved"
    //    - item.recoveryType = "owner_found"
    //    - item.recoveredBy = authenticated owner
    //    - item.ownerConfirmedAt = current time
    //    - item.ownerConfirmedBy = authenticated owner
    //    - item.resolvedAt = current time
    item.status = 'Resolved';
    item.recoveryType = 'owner_found';
    item.recoveredBy = req.user._id;
    item.ownerConfirmedAt = now;
    item.ownerConfirmedBy = req.user._id;
    item.resolvedAt = now;
    await item.save();

    // 5. Immediately send an email to the authenticated owner's verified @apsit.edu.in email.
    try {
      await emailUtils.sendOwnerSelfRecoveryEmail({
        ownerEmail: ownerUser.email,
        ownerName: ownerUser.name,
        itemName: item.title,
        recoveryDate: now,
      });
    } catch (emailErr) {
      console.error(`[SMTP] Error sending owner self-recovery email: ${emailErr.message}`);
    }

    const populated = await Item.findById(item._id).populate([
      { path: 'reportedBy', select: 'name email department phone studentId' },
      { path: 'foundBy', select: 'name email department phone studentId' },
      { path: 'claimedBy', select: 'name email department phone studentId' },
      { path: 'recoveredBy', select: 'name email department phone studentId' },
      { path: 'ownerConfirmedBy', select: 'name email department phone studentId' },
    ]);

    const result = populated && populated.toObject ? populated.toObject() : { ...populated };
    result.success = true;
    result.status = 'Resolved';
    result.recoveryType = 'owner_found';
    result.message = 'Item marked as Resolved! A confirmation email has been sent to your college email.';
    result.item = populated;

    return res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/items/:id/reject-finder
// @desc    Lost item owner marks finder report as rejected ("This Is Not My Item")
// @access  Private (Owner or Admin)
router.put('/:id/reject-finder', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Only owner or admin can reject finder report
    const ownerId = item.reportedBy?._id ? item.reportedBy._id.toString() : (item.reportedBy ? item.reportedBy.toString() : '');
    if (ownerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the item owner or an admin can reject this finder report.' });
    }

    if (item.status === 'Resolved' || item.status === 'Claimed') {
      return res.status(400).json({ message: 'Cannot reject a report on an item that is already resolved or claimed.' });
    }

    // Find the latest active claim for this item
    const claim = await Claim.findOne({
      item: item._id,
      status: { $in: ['Contacted', 'Pending Owner Confirmation', 'pending', 'approved'] },
    }).sort({ createdAt: -1 });

    if (!claim) {
      return res.status(400).json({ message: 'No active finder report found to reject.' });
    }

    const now = new Date();
    claim.status = 'rejected';
    claim.rejectedAt = now;
    claim.rejectedBy = req.user._id;
    await claim.save();

    // Clear foundBy, preserve active item status (Active/Pending lost state)
    item.foundBy = null;
    await item.save();

    // Optionally notify finder via email
    if (claim.email) {
      try {
        await emailUtils.sendFinderRejectionNotificationEmail({
          finderEmail: claim.email,
          finderName: claim.fullName || (claim.finder ? claim.finder.name : 'Student'),
          itemName: item.title,
        });
      } catch (emailErr) {
        console.error('Finder rejection notification failed:', emailErr.message);
      }
    }

    const populated = await Item.findById(item._id)
      .populate([
        { path: 'reportedBy', select: 'name email department phone studentId' },
        { path: 'foundBy', select: 'name email department phone studentId' },
        { path: 'claimedBy', select: 'name email department phone studentId' },
      ]);

    const claims = await Claim.find({ item: item._id })
      .populate('finder', 'name email phone studentId department')
      .populate('owner', 'name email phone studentId department')
      .sort({ createdAt: -1 });

    const result = populated && populated.toObject ? populated.toObject() : (populated ? { ...populated } : { ...item });
    result.claims = claims;
    result.success = true;
    result.message = 'Finder report has been rejected. The item is now open for new finder reports.';
    result.item = populated;

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
