const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadImage } = require('../config/cloudinary');

const emailUtils = require('../utils/email');


// @route   GET /api/claims
// @desc    Get all claim requests (with search, filter, pagination)
// @access  Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { itemName: { $regex: search, $options: 'i' } },
        { additionalDetails: { $regex: search, $options: 'i' } },
        { finderMessage: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Claim.countDocuments(filter);
    const claims = await Claim.find(filter)
      .populate({
        path: 'item',
        select: 'title category location date image type status reportedBy foundBy claimedBy resolvedAt',
        populate: [
          { path: 'reportedBy', select: 'name email phone studentId department' },
          { path: 'foundBy', select: 'name email phone studentId department' },
        ],
      })
      .populate('owner', 'name email phone studentId department')
      .populate('finder', 'name email phone studentId department')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      claims,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/claims/:id
// @desc    Get single claim details
// @access  Admin
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate({
        path: 'item',
        populate: [
          { path: 'reportedBy', select: 'name email phone studentId department' },
          { path: 'foundBy', select: 'name email phone studentId department' },
        ],
      })
      .populate('owner', 'name email phone studentId department')
      .populate('finder', 'name email phone studentId department')
      .populate('processedBy', 'name email');
    if (!claim) return res.status(404).json({ message: 'Claim request not found' });
    res.json(claim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/claims
// @desc    Create a new claim / found-item report
// @access  Private
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { itemId, itemName, fullName, email, phone, additionalDetails, finderMessage, otp } = req.body;

    // Validate Full Name (Mandatory, trimmed, min 2 chars)
    const trimmedName = (fullName || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ message: 'Full name is required' });
    }
    if (trimmedName.length < 2) {
      return res.status(400).json({ message: 'Full name must be at least 2 characters long' });
    }

    // Validate College Email Address (Mandatory, must end with @apsit.edu.in or temporary test email)
    const submittedEmail = (email || '').trim().toLowerCase();
    if (!submittedEmail) {
      return res.status(400).json({ message: 'College email address is required' });
    }

    // ============================================================================
    // PERMANENT PRODUCTION / DEMO FINDER EXCEPTION (ajinkyatondlikar@gmail.com)
    // ============================================================================
    const DEMO_FINDER_EMAIL = (process.env.DEMO_LOGIN_EMAIL || process.env.TEMP_TEST_LOGIN_EMAIL || 'ajinkyatondlikar@gmail.com').trim().toLowerCase();
    const isAllowedFinderEmail = (e) => {
      if (!e) return false;
      const normalized = e.trim().toLowerCase();
      return normalized.endsWith('@apsit.edu.in') || normalized === DEMO_FINDER_EMAIL;
    };
    // ============================================================================

    if (!isAllowedFinderEmail(submittedEmail)) {
      return res.status(400).json({ message: 'A valid college email ending with @apsit.edu.in is required' });
    }

    // Validate Phone Number (Mandatory, valid Indian mobile format: 10 digits starting with 6-9)
    const submittedPhone = (phone || '').toString().trim();
    if (!submittedPhone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const cleanPhone = submittedPhone.replace(/[\s\-\(\)]/g, '').replace(/^(\+91|0)/, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9)' });
    }

    // Validate Proof Photo (Required: from upload or pre-existing Cloudinary URL)
    let image = (req.body.image || '').trim();
    if (req.file) {
      try {
        image = await uploadImage(req.file, 'college-lost-found/claims');
      } catch (uploadErr) {
        return res.status(500).json({ message: uploadErr.message || 'Image upload failed' });
      }
    }
    if (!image) {
      return res.status(400).json({ message: 'Found item image / proof photo is required' });
    }

    // Validate Additional Details / Finder Message (Required, not blank)
    const messageContent = (finderMessage || additionalDetails || '').trim();
    if (!messageContent) {
      return res.status(400).json({ message: 'Additional details describing where/how you found the item are required' });
    }

    let item = null;
    let resolvedItemName = itemName || '';
    if (itemId) {
      item = await Item.findById(itemId).populate('reportedBy', 'name email phone studentId department');
      if (!item) {
        return res.status(404).json({ message: 'Target item not found' });
      }
      resolvedItemName = item.title;

      // Validate item status: cannot claim already resolved/claimed items
      if (item.status?.toLowerCase() === 'resolved' || item.status?.toLowerCase() === 'claimed') {
        return res.status(400).json({ message: 'This item has already been resolved or claimed.' });
      }

      // Prevent self-claim: owner cannot claim their own reported item
      const ownerId = item.reportedBy?._id ? item.reportedBy._id.toString() : (item.reportedBy ? item.reportedBy.toString() : '');
      if (ownerId && ownerId === req.user._id.toString()) {
        return res.status(400).json({ message: 'You cannot claim or report finding your own reported item.' });
      }

      // Prevent duplicate active claims by any user for the same item
      const existingClaim = await Claim.findOne({
        item: item._id,
        status: { $in: ['pending', 'Contacted', 'Pending Owner Confirmation', 'Pending Admin Verification', 'approved'] },
      });
      if (existingClaim) {
        const isSelf = existingClaim.finder && existingClaim.finder.toString() === req.user._id.toString();
        return res.status(400).json({
          message: isSelf
            ? 'You have already submitted an active claim or finder report for this item.'
            : 'An active finder claim has already been submitted for this item.',
        });
      }
    }

    // Validate 6-digit OTP verification code for students
    if (req.user.role !== 'admin') {
      const cleanOtp = (otp || '').toString().trim();
      if (!cleanOtp || cleanOtp.length !== 6) {
        return res.status(400).json({ message: '6-digit verification OTP code is required' });
      }

      const otpRecord = await Otp.findOne({
        email: submittedEmail,
        otp: cleanOtp,
        expiresAt: { $gt: new Date() },
      });

      if (!otpRecord) {
        const expiredOtp = await Otp.findOne({ email: submittedEmail, otp: cleanOtp });
        if (expiredOtp) {
          return res.status(400).json({ message: 'OTP has expired. Please request a new OTP code.' });
        }
        return res.status(400).json({ message: 'Invalid OTP code. Please check and try again.' });
      }

      // Delete the verified OTP code to prevent reuse
      await Otp.deleteMany({ email: submittedEmail, otp: cleanOtp });
    }

    const isLostItemFound = item && item.type === 'lost';
    const initialStatus = isLostItemFound ? 'Contacted' : 'pending';

    const claim = await Claim.create({
      item: item ? item._id : null,
      itemName: resolvedItemName || 'Unspecified Item',
      fullName: trimmedName,
      email: submittedEmail,
      phone: cleanPhone,
      image,
      additionalDetails: messageContent,
      finderMessage: messageContent,
      status: initialStatus,
      owner: item && item.reportedBy ? (item.reportedBy._id || item.reportedBy) : null,
      finder: req.user._id,
    });

    // Link finder to item without changing item status to Resolved
    if (isLostItemFound && item) {
      await Item.findByIdAndUpdate(item._id, { foundBy: req.user._id });
    }

    // If another student found a lost item, notify the owner immediately via email
    if (isLostItemFound && item.reportedBy && item.reportedBy.email) {
      const emailResult = await emailUtils.sendItemFoundNotificationEmail({
        ownerEmail: item.reportedBy.email,
        ownerName: item.reportedBy.name,
        itemName: item.title,
        finderName: trimmedName,
        finderEmail: submittedEmail,
        finderPhone: cleanPhone,
        finderMessage: messageContent,
        proofImage: image,
      });

      if (!emailResult.success) {
        // Rollback claim record and reset foundBy so no broken/orphaned record is left
        await Claim.findByIdAndDelete(claim._id);
        if (isLostItemFound && item) {
          await Item.findByIdAndUpdate(item._id, { foundBy: null });
        }
        return res.status(500).json({
          message: 'Failed to notify the item owner via email. Please check network and try again.',
        });
      }
    }

    const populatedClaim = await Claim.findById(claim._id)
      .populate('item')
      .populate('owner', 'name email phone studentId department')
      .populate('finder', 'name email phone studentId department');

    res.status(201).json(populatedClaim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/claims/:id/status
// @desc    Update claim status (approve/reject/pending/resolved)
// @access  Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, reason, adminRejectionReason } = req.body;
    const allowedStatuses = [
      'pending',
      'Contacted',
      'Pending Owner Confirmation',
      'Pending Admin Verification',
      'Admin Rejected',
      'approved',
      'rejected',
      'resolved',
    ];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const isApprovalOrResolution = status === 'approved' || status === 'resolved';
    const isAdminRejected = status === 'Admin Rejected' || (status === 'rejected' && claim.status === 'Pending Admin Verification');

    const now = new Date();

    if (isApprovalOrResolution) {
      claim.status = 'resolved';
      claim.resolvedAt = claim.resolvedAt || now;
      claim.adminVerifier = req.user._id;
      claim.adminVerifiedAt = now;
      claim.processedBy = req.user._id;
    } else if (isAdminRejected) {
      claim.status = 'Admin Rejected';
      claim.adminRejectedAt = now;
      claim.adminRejectionDate = now;
      claim.adminRejectionReason = (reason || adminRejectionReason || 'Admin rejected verification').trim();
      claim.rejectedAt = now;
      claim.rejectedBy = req.user._id;
      claim.processedBy = req.user._id;
    } else {
      claim.status = status;
      claim.processedBy = req.user._id;
      if (status === 'rejected') {
        claim.rejectedAt = now;
        claim.rejectedBy = req.user._id;
        claim.adminRejectionReason = (reason || adminRejectionReason || '').trim();
      }
    }
    await claim.save();

    // If approved or resolved and associated with an item, update item status to Resolved
    if (isApprovalOrResolution && claim.item) {
      const curItem = await Item.findById(claim.item);
      if (curItem) {
        curItem.status = 'Resolved';
        curItem.resolvedAt = claim.resolvedAt || now;
        if (!curItem.recoveryType) {
          curItem.recoveryType = curItem.type === 'found' ? 'normal_found' : 'finder_found';
        }
        if (curItem.type === 'found') {
          curItem.claimedBy = claim.owner || claim.finder || curItem.claimedBy;
        } else {
          curItem.foundBy = claim.finder || curItem.foundBy;
          curItem.claimedBy = claim.finder || curItem.claimedBy;
        }
        await curItem.save();
      }
    }

    // If rejected (not Admin Rejected) and associated with an item, reset foundBy if it was set to this finder
    // If Admin Rejected: item MUST NOT become Resolved, preserve claim/finder history, keep audit history
    if (status === 'rejected' && !isAdminRejected && claim.item) {
      const targetItem = await Item.findById(claim.item);
      if (targetItem && targetItem.foundBy && String(targetItem.foundBy) === String(claim.finder)) {
        targetItem.foundBy = null;
        await targetItem.save();
      }
    }

    // Send email notification to claimant if rejected
    if (status === 'rejected' || isAdminRejected) {
      try {
        await emailUtils.sendClaimStatusEmail(claim);
      } catch (err) {
        console.error(`[SMTP] Claim rejection email delivery failed: ${err.message}`);
      }
    }

    // If approved or resolved by admin, send resolution emails to owner and finder
    if (isApprovalOrResolution) {
      try {
        let targetItem = null;
        if (claim.item) {
          targetItem = await Item.findById(claim.item);
        }

        let ownerDoc = null;
        if (claim.owner) {
          ownerDoc = (claim.owner && claim.owner.email) ? claim.owner : await User.findById(claim.owner);
        }
        if (!ownerDoc && targetItem && targetItem.reportedBy) {
          ownerDoc = (targetItem.reportedBy && targetItem.reportedBy.email) ? targetItem.reportedBy : await User.findById(targetItem.reportedBy);
        }

        let finderDoc = null;
        if (claim.finder) {
          finderDoc = (claim.finder && claim.finder.email) ? claim.finder : await User.findById(claim.finder);
        }
        if (!finderDoc && targetItem && targetItem.foundBy) {
          finderDoc = (targetItem.foundBy && targetItem.foundBy.email) ? targetItem.foundBy : await User.findById(targetItem.foundBy);
        }

        const isFoundItem = targetItem && targetItem.type === 'found';

        const itemName = (targetItem && targetItem.title) || claim.itemName || 'Item';
        const resolutionDate = claim.resolvedAt || new Date();

        const ownerName = isFoundItem
          ? (claim.fullName || (finderDoc ? finderDoc.name : 'Student'))
          : (ownerDoc ? ownerDoc.name : (targetItem?.reportedBy?.name || 'Student'));
        const ownerEmail = isFoundItem
          ? (claim.email || (finderDoc ? finderDoc.email : null))
          : (ownerDoc ? ownerDoc.email : (targetItem?.reportedBy?.email || null));

        const finalFinderName = isFoundItem
          ? (targetItem?.reportedBy?.name || 'Student')
          : (claim.fullName || (finderDoc ? finderDoc.name : (targetItem?.foundBy?.name || 'Student')));
        const finderEmail = isFoundItem
          ? (targetItem?.reportedBy?.email || null)
          : (claim.email || (finderDoc ? finderDoc.email : (targetItem?.foundBy?.email || null)));

        // Send owner resolution email (idempotent: only if not already sent)
        if (ownerEmail && !claim.ownerResolutionEmailSentAt) {
          try {
            const ownerResult = await emailUtils.sendOwnerResolutionEmail({
              ownerEmail,
              ownerName,
              itemName,
              finderName: finalFinderName,
              resolutionDate,
            });
            if (ownerResult && ownerResult.success) {
              claim.ownerResolutionEmailSentAt = new Date();
              await claim.save();
            }
          } catch (ownerErr) {
            console.error(`[SMTP] Owner resolution email delivery failed: ${ownerErr.message}`);
          }
        }

        // Send finder resolution email (idempotent: only if not already sent)
        if (finderEmail && !claim.finderResolutionEmailSentAt) {
          try {
            const finderResult = await emailUtils.sendFinderResolutionEmail({
              finderEmail,
              finderName: finalFinderName,
              itemName,
              resolutionDate,
            });
            if (finderResult && finderResult.success) {
              claim.finderResolutionEmailSentAt = new Date();
              await claim.save();
            }
          } catch (finderErr) {
            console.error(`[SMTP] Finder resolution email delivery failed: ${finderErr.message}`);
          }
        }
      } catch (notifErr) {
        console.error(`[SMTP] Admin resolution notification handling error: ${notifErr.message}`);
      }
    }

    const updated = await Claim.findById(claim._id)
      .populate('item')
      .populate('owner', 'name email phone studentId department')
      .populate('finder', 'name email phone studentId department')
      .populate('processedBy', 'name email')
      .populate('adminVerifier', 'name email');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/claims/:id
// @desc    Update claim details
// @access  Admin
router.put('/:id', protect, adminOnly, upload.single('image'), async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    const updates = { ...req.body };
    if (req.file) {
      try {
        updates.image = await uploadImage(req.file, 'college-lost-found/claims');
      } catch (uploadErr) {
        return res.status(500).json({ message: uploadErr.message || 'Image upload failed' });
      }
    }

    const updated = await Claim.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate('item');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/claims/:id
// @desc    Delete a claim request
// @access  Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    await claim.deleteOne();
    res.json({ message: 'Claim request deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
