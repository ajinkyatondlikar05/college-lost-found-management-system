const express = require('express');
const router = express.Router();
const Claim = require('../models/Claim');
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadImage } = require('../config/cloudinary');

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
      ];
    }

    const total = await Claim.countDocuments(filter);
    const claims = await Claim.find(filter)
      .populate('item', 'title category location date image type status')
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
      .populate('item')
      .populate('processedBy', 'name email');
    if (!claim) return res.status(404).json({ message: 'Claim request not found' });
    res.json(claim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/claims
// @desc    Create a new claim request
// @access  Private
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { itemId, itemName, fullName, email, phone, additionalDetails } = req.body;
    let image = req.body.image || '';
    if (req.file) {
      try {
        image = await uploadImage(req.file, 'college-lost-found/claims');
      } catch (uploadErr) {
        return res.status(500).json({ message: uploadErr.message || 'Image upload failed' });
      }
    }

    let item = null;
    let resolvedItemName = itemName || '';
    if (itemId) {
      item = await Item.findById(itemId);
      if (item && !resolvedItemName) {
        resolvedItemName = item.title;
      }
    }

    const claim = await Claim.create({
      item: item ? item._id : null,
      itemName: resolvedItemName || 'Unspecified Item',
      fullName: fullName || req.user.name,
      email: email || req.user.email,
      phone: phone || req.user.phone || 'N/A',
      image,
      additionalDetails: additionalDetails || '',
      status: 'pending',
    });

    res.status(201).json(claim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/claims/:id/status
// @desc    Update claim status (approve/reject/pending)
// @access  Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: 'Claim not found' });

    claim.status = status;
    claim.processedBy = req.user._id;
    await claim.save();

    // If approved and associated with an item, update item status to Claimed/Resolved
    if (status === 'approved' && claim.item) {
      await Item.findByIdAndUpdate(claim.item, { status: 'Resolved' });
    }

    // Send email notification to claimant
    const { sendClaimStatusEmail } = require('../utils/email');
    await sendClaimStatusEmail(claim);

    const updated = await Claim.findById(claim._id)
      .populate('item')
      .populate('processedBy', 'name email');

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
