const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: [true, 'OTP code is required'],
      trim: true,
    },
    purpose: {
      type: String,
      default: 'report_lost_item',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Otp', otpSchema);
