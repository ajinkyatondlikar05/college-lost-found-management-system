const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
    },
    itemName: {
      type: String,
      default: '',
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    additionalDetails: {
      type: String,
      default: '',
      trim: true,
    },
    finderMessage: {
      type: String,
      default: '',
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    finder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'Contacted', 'Pending Owner Confirmation', 'Pending Admin Verification', 'Admin Rejected', 'approved', 'rejected', 'resolved'],
      default: 'pending',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ownerConfirmedAt: {
      type: Date,
      default: null,
    },
    ownerConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminVerifier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminVerifiedAt: {
      type: Date,
      default: null,
    },
    adminRejectedAt: {
      type: Date,
      default: null,
    },
    adminRejectionDate: {
      type: Date,
      default: null,
    },
    adminRejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    ownerResolutionEmailSentAt: {
      type: Date,
      default: null,
    },
    finderResolutionEmailSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Claim', claimSchema);
