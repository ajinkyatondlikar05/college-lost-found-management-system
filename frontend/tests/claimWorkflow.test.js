import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Claim & Report Found Item Workflow UI Rules', () => {
  // Validator mirrored from ItemDetail.jsx and Dashboard.jsx
  const validateClaimForm = (form, imageFile) => {
    const errs = {};
    const trimmedName = (form.fullName || '').trim();
    if (!trimmedName) {
      errs.fullName = 'Full Name is required';
    } else if (trimmedName.length < 2) {
      errs.fullName = 'Full Name must be at least 2 characters long';
    }

    const trimmedEmail = (form.email || '').trim().toLowerCase();
    if (!trimmedEmail) {
      errs.email = 'College Email Address is required';
    } else if (!trimmedEmail.endsWith('@apsit.edu.in')) {
      errs.email = 'Email must end with @apsit.edu.in';
    }

    const cleanPhone = (form.phone || '').trim().replace(/[\s\-\(\)]/g, '').replace(/^(\+91|0)/, '');
    if (!cleanPhone) {
      errs.phone = 'Phone Number is required';
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errs.phone = 'Please enter a valid 10-digit Indian mobile number (starting with 6-9)';
    }

    if (!imageFile) {
      errs.image = 'Found Item Image / Proof Photo is required';
    }

    const trimmedDetails = (form.additionalDetails || form.finderMessage || '').trim();
    if (!trimmedDetails) {
      errs.additionalDetails = 'Additional details describing where/how you found the item are required';
    }

    return {
      isValid: Object.keys(errs).length === 0,
      errors: errs,
    };
  };

  const shouldShowFoundButton = ({ user, item }) => {
    if (!user || !item) return false;
    const reportedById = item.reportedBy?._id || item.reportedBy;
    const isOwner = reportedById && String(reportedById) === String(user._id);
    const isResolved = item.status === 'Resolved' || item.status === 'resolved' || item.status === 'Claimed';
    return item.type === 'lost' && !isOwner && !isResolved;
  };

  const shouldShowOwnerRecoverButton = ({ user, item }) => {
    if (!user || !item) return false;
    const reportedById = item.reportedBy?._id || item.reportedBy;
    const isOwner = (reportedById && String(reportedById) === String(user._id)) || user.role === 'admin';
    const isResolved = item.status === 'Resolved' || item.status === 'resolved';
    return item.type === 'lost' && isOwner && !isResolved;
  };

  describe('"I Found This Item" button visibility', () => {
    const owner = { _id: 'user_1', name: 'Ajinkya' };
    const finder = { _id: 'user_2', name: 'Priya' };
    const lostItem = {
      _id: 'item_1',
      title: 'Water Bottle',
      type: 'lost',
      status: 'Active',
      reportedBy: { _id: 'user_1', name: 'Ajinkya' },
    };

    it('should NOT show "I Found This Item" to the owner of the lost item', () => {
      assert.strictEqual(shouldShowFoundButton({ user: owner, item: lostItem }), false);
    });

    it('should show "I Found This Item" to authenticated non-owner', () => {
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: lostItem }), true);
    });

    it('should NOT show "I Found This Item" to unauthenticated visitor', () => {
      assert.strictEqual(shouldShowFoundButton({ user: null, item: lostItem }), false);
    });

    it('should NOT show "I Found This Item" if item is already resolved', () => {
      const resolvedItem = { ...lostItem, status: 'Resolved' };
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: resolvedItem }), false);
    });
  });

  describe('"I Got My Item Back" button visibility', () => {
    const owner = { _id: 'user_1', name: 'Ajinkya' };
    const finder = { _id: 'user_2', name: 'Priya' };
    const lostItem = {
      _id: 'item_1',
      title: 'Water Bottle',
      type: 'lost',
      status: 'Active',
      reportedBy: { _id: 'user_1', name: 'Ajinkya' },
    };

    it('should show "I Got My Item Back" to the item owner on active lost item', () => {
      assert.strictEqual(shouldShowOwnerRecoverButton({ user: owner, item: lostItem }), true);
    });

    it('should NOT show "I Got My Item Back" to non-owners', () => {
      assert.strictEqual(shouldShowOwnerRecoverButton({ user: finder, item: lostItem }), false);
    });

    it('should NOT show "I Got My Item Back" once item is resolved', () => {
      const resolvedItem = { ...lostItem, status: 'Resolved' };
      assert.strictEqual(shouldShowOwnerRecoverButton({ user: owner, item: resolvedItem }), false);
    });
  });

  describe('Report Found Item Form Validations', () => {
    const validForm = {
      fullName: 'Priya Patel',
      email: '24107002@apsit.edu.in',
      phone: '9876543210',
      additionalDetails: 'Found in Room 402 desk 3',
    };
    const mockImageFile = { name: 'photo.jpg', size: 1024 };

    it('should accept valid form with proof image', () => {
      const res = validateClaimForm(validForm, mockImageFile);
      assert.strictEqual(res.isValid, true);
    });

    it('should require Full Name with min 2 characters', () => {
      const emptyNameRes = validateClaimForm({ ...validForm, fullName: '' }, mockImageFile);
      assert.strictEqual(emptyNameRes.isValid, false);
      assert.strictEqual(emptyNameRes.errors.fullName, 'Full Name is required');

      const shortNameRes = validateClaimForm({ ...validForm, fullName: 'A' }, mockImageFile);
      assert.strictEqual(shortNameRes.isValid, false);
      assert.strictEqual(shortNameRes.errors.fullName, 'Full Name must be at least 2 characters long');
    });

    it('should require College Email ending with @apsit.edu.in', () => {
      const emptyEmailRes = validateClaimForm({ ...validForm, email: '' }, mockImageFile);
      assert.strictEqual(emptyEmailRes.isValid, false);
      assert.strictEqual(emptyEmailRes.errors.email, 'College Email Address is required');

      const nonApsitRes = validateClaimForm({ ...validForm, email: 'priya@gmail.com' }, mockImageFile);
      assert.strictEqual(nonApsitRes.isValid, false);
      assert.strictEqual(nonApsitRes.errors.email, 'Email must end with @apsit.edu.in');
    });

    it('should require Phone Number with valid Indian mobile format', () => {
      const emptyPhoneRes = validateClaimForm({ ...validForm, phone: '' }, mockImageFile);
      assert.strictEqual(emptyPhoneRes.isValid, false);
      assert.strictEqual(emptyPhoneRes.errors.phone, 'Phone Number is required');

      const invalidPhoneRes = validateClaimForm({ ...validForm, phone: '1234567890' }, mockImageFile);
      assert.strictEqual(invalidPhoneRes.isValid, false);
      assert.strictEqual(invalidPhoneRes.errors.phone, 'Please enter a valid 10-digit Indian mobile number (starting with 6-9)');

      // Valid with +91 prefix
      const validPrefixRes = validateClaimForm({ ...validForm, phone: '+91 9876543210' }, mockImageFile);
      assert.strictEqual(validPrefixRes.isValid, true);
    });

    it('should require Proof Photo image file', () => {
      const noImageRes = validateClaimForm(validForm, null);
      assert.strictEqual(noImageRes.isValid, false);
      assert.strictEqual(noImageRes.errors.image, 'Found Item Image / Proof Photo is required');
    });

    it('should require Additional Details', () => {
      const emptyDetailsRes = validateClaimForm({ ...validForm, additionalDetails: '   ' }, mockImageFile);
      assert.strictEqual(emptyDetailsRes.isValid, false);
      assert.strictEqual(emptyDetailsRes.errors.additionalDetails, 'Additional details describing where/how you found the item are required');
    });
  });

  describe('OTP Security & Format Validation', () => {
    it('should require a 6-digit numeric OTP', () => {
      const isValidOtp = (otp) => /^\d{6}$/.test((otp || '').trim());

      assert.strictEqual(isValidOtp('123456'), true);
      assert.strictEqual(isValidOtp('987654'), true);
      assert.strictEqual(isValidOtp('12345'), false);
      assert.strictEqual(isValidOtp('1234567'), false);
      assert.strictEqual(isValidOtp('abcdef'), false);
      assert.strictEqual(isValidOtp(''), false);
    });
  });
});
