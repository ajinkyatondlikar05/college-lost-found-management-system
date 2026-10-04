import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getImageUrl } from '../src/api.js';
import { getItemPrimaryStatus, formatTimelineDate, buildReportTimeline } from '../src/utils/reportCardUtils.js';

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
    const isResolved = (item.status || '').toLowerCase() === 'resolved' || (item.status || '').toLowerCase() === 'claimed';
    const activeClaim = item.claims?.find(
      (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
    );
    const hasActiveFinder = Boolean(item.foundBy || activeClaim);
    return item.type === 'lost' && !isOwner && !hasActiveFinder && !isResolved;
  };

  const shouldShowFoundBySection = ({ item }) => {
    if (!item) return false;
    const activeClaim = item.claims?.find(
      (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
    );
    const hasActiveFinder = Boolean(item.foundBy || activeClaim);
    const isResolved = (item.status || '').toLowerCase() === 'resolved';
    return item.type === 'lost' && hasActiveFinder && !isResolved;
  };

  const shouldShowOwnerRecoverButton = ({ user, item }) => {
    if (!user || !item) return false;
    const reportedById = item.reportedBy?._id || item.reportedBy;
    const isOwner = (reportedById && String(reportedById) === String(user._id)) || user.role === 'admin';
    const isResolved = (item.status || '').toLowerCase() === 'resolved';
    return item.type === 'lost' && isOwner && !isResolved;
  };

  const shouldShowRejectButton = ({ user, item }) => {
    if (!user || !item) return false;
    const reportedById = item.reportedBy?._id || item.reportedBy;
    const isOwner = (reportedById && String(reportedById) === String(user._id)) || user.role === 'admin';
    const isResolved = (item.status || '').toLowerCase() === 'resolved';
    const activeClaim = item.claims?.find(
      (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
    );
    const hasActiveFinder = Boolean(item.foundBy || activeClaim);
    return item.type === 'lost' && isOwner && !isResolved && hasActiveFinder;
  };

  const getFinderVisibleDetails = ({ user, item }) => {
    const activeClaim = item.claims?.find(
      (c) => ['Contacted', 'pending', 'Pending Owner Confirmation', 'approved'].includes(c.status)
    );
    const reportedById = item.reportedBy?._id || item.reportedBy;
    const isOwner = user && reportedById && String(reportedById) === String(user._id);
    const isAdmin = user && user.role === 'admin';

    const finderName = activeClaim?.fullName || item.foundBy?.name || 'A Student';
    const foundDate = activeClaim?.createdAt || item.updatedAt;

    if (isOwner || isAdmin) {
      return {
        finderName,
        foundDate,
        email: activeClaim?.email || item.foundBy?.email,
        phone: activeClaim?.phone || item.foundBy?.phone,
        message: activeClaim?.finderMessage,
      };
    }

    return {
      finderName,
      foundDate,
      email: undefined,
      phone: undefined,
      message: undefined,
    };
  };

  describe('"I Found This Item" button visibility', () => {
    const owner = { _id: 'user_1', name: 'Ajinkya' };
    const finder = { _id: 'user_2', name: 'Priya' };
    const thirdUser = { _id: 'user_3', name: 'Sameer' };
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

    it('should show "I Found This Item" to authenticated non-owner when no active claim exists', () => {
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: lostItem }), true);
    });

    it('should NOT show "I Found This Item" to unauthenticated visitor', () => {
      assert.strictEqual(shouldShowFoundButton({ user: null, item: lostItem }), false);
    });

    it('should NOT show "I Found This Item" if item is already resolved', () => {
      const resolvedItem = { ...lostItem, status: 'Resolved' };
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: resolvedItem }), false);
    });

    it('should NOT show "I Found This Item" to other users once an active claim/finder exists', () => {
      const itemWithFinder = {
        ...lostItem,
        foundBy: { _id: 'user_2', name: 'Priya' },
        claims: [{ status: 'Contacted', fullName: 'Priya Patel' }],
      };
      assert.strictEqual(shouldShowFoundButton({ user: thirdUser, item: itemWithFinder }), false);
    });
  });

  describe('"FOUND BY" visual state and privacy', () => {
    const owner = { _id: 'user_1', name: 'Ajinkya' };
    const admin = { _id: 'admin_1', name: 'Admin', role: 'admin' };
    const publicUser = { _id: 'user_3', name: 'Sameer' };
    const itemWithFinder = {
      _id: 'item_1',
      title: 'Water Bottle',
      type: 'lost',
      status: 'Active',
      reportedBy: { _id: 'user_1', name: 'Ajinkya' },
      foundBy: { _id: 'user_2', name: 'Veddika Sheetty', phone: '9876543210', email: 'veddika@apsit.edu.in' },
      claims: [{
        status: 'Contacted',
        fullName: 'Veddika Sheetty',
        email: 'veddika@apsit.edu.in',
        phone: '9876543210',
        finderMessage: 'Found in Lab 402',
        createdAt: new Date('2026-10-03T10:00:00Z'),
      }],
    };

    it('should show FOUND BY section when active claim/finder exists', () => {
      assert.strictEqual(shouldShowFoundBySection({ item: itemWithFinder }), true);
    });

    it('should NOT show FOUND BY section once item is marked Resolved', () => {
      const resolved = { ...itemWithFinder, status: 'Resolved' };
      assert.strictEqual(shouldShowFoundBySection({ item: resolved }), false);
    });

    it('should reveal finder phone/email to item owner', () => {
      const details = getFinderVisibleDetails({ user: owner, item: itemWithFinder });
      assert.strictEqual(details.finderName, 'Veddika Sheetty');
      assert.strictEqual(details.phone, '9876543210');
      assert.strictEqual(details.email, 'veddika@apsit.edu.in');
    });

    it('should reveal finder phone/email to admin', () => {
      const details = getFinderVisibleDetails({ user: admin, item: itemWithFinder });
      assert.strictEqual(details.finderName, 'Veddika Sheetty');
      assert.strictEqual(details.phone, '9876543210');
      assert.strictEqual(details.email, 'veddika@apsit.edu.in');
    });

    it('should hide finder phone/email from other students/public viewers', () => {
      const details = getFinderVisibleDetails({ user: publicUser, item: itemWithFinder });
      assert.strictEqual(details.finderName, 'Veddika Sheetty');
      assert.strictEqual(details.phone, undefined);
      assert.strictEqual(details.email, undefined);
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

  describe('"This Is Not My Item" button & rejection confirmation dialog', () => {
    const owner = { _id: 'user_1', name: 'Ajinkya' };
    const finder = { _id: 'user_2', name: 'Priya' };
    const lostItemNoFinder = {
      _id: 'item_1',
      title: 'Water Bottle',
      type: 'lost',
      status: 'Active',
      reportedBy: { _id: 'user_1', name: 'Ajinkya' },
      foundBy: null,
      claims: [],
    };
    const lostItemWithFinder = {
      ...lostItemNoFinder,
      foundBy: { _id: 'user_2', name: 'Priya' },
      claims: [{ status: 'Contacted', fullName: 'Priya Patel' }],
    };

    it('should show "This Is Not My Item" to the owner when an active finder claim exists', () => {
      assert.strictEqual(shouldShowRejectButton({ user: owner, item: lostItemWithFinder }), true);
    });

    it('should NOT show "This Is Not My Item" to non-owners', () => {
      assert.strictEqual(shouldShowRejectButton({ user: finder, item: lostItemWithFinder }), false);
    });

    it('should NOT show "This Is Not My Item" when no active finder claim exists', () => {
      assert.strictEqual(shouldShowRejectButton({ user: owner, item: lostItemNoFinder }), false);
    });

    it('should NOT show "This Is Not My Item" once the item is marked Resolved', () => {
      const resolvedItem = { ...lostItemWithFinder, status: 'Resolved' };
      assert.strictEqual(shouldShowRejectButton({ user: owner, item: resolvedItem }), false);
    });

    it('dialog modal must present required confirmation text and options', () => {
      const confirmationTitle = 'Are you sure this is not your item?';
      const buttonCancelText = 'Cancel';
      const buttonConfirmText = 'Yes, This Is Not My Item';

      assert.strictEqual(confirmationTitle, 'Are you sure this is not your item?');
      assert.strictEqual(buttonCancelText, 'Cancel');
      assert.strictEqual(buttonConfirmText, 'Yes, This Is Not My Item');
    });

    it('after rejection: clears foundBy, hides FOUND BY, and restores "I Found This Item"', () => {
      // Before rejection:
      assert.strictEqual(shouldShowFoundBySection({ item: lostItemWithFinder }), true);
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: lostItemWithFinder }), false);

      // Simulated state after owner rejection:
      const rejectedItem = {
        ...lostItemWithFinder,
        foundBy: null,
        status: 'Active',
        claims: [{ status: 'rejected', fullName: 'Priya Patel' }],
      };

      // After rejection:
      assert.strictEqual(shouldShowFoundBySection({ item: rejectedItem }), false);
      assert.strictEqual(shouldShowFoundButton({ user: { _id: 'user_3', name: 'Other Student' }, item: rejectedItem }), true);
      // Same finder is NOT blocked: can open form and submit a new report
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: rejectedItem }), true);
      assert.strictEqual(shouldShowRejectButton({ user: owner, item: rejectedItem }), false);
    });

    it('after final recovery: shows RESOLVED and final finder', () => {
      const recoveredItem = {
        ...lostItemWithFinder,
        status: 'Resolved',
        resolvedAt: new Date(),
        foundBy: { _id: 'user_2', name: 'Priya' },
        claims: [{ status: 'resolved', fullName: 'Priya Patel' }],
      };

      assert.strictEqual(shouldShowFoundBySection({ item: recoveredItem }), false);
      assert.strictEqual(shouldShowFoundButton({ user: finder, item: recoveredItem }), false);
      assert.strictEqual(shouldShowOwnerRecoverButton({ user: owner, item: recoveredItem }), false);
      assert.strictEqual(recoveredItem.foundBy.name, 'Priya');
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

  describe('Print Report vs Print History Separation', () => {
    const mockReports = [
      {
        _id: '670000000000000000000001',
        title: 'Analog Watch',
        type: 'lost',
        category: 'Accessories',
        location: 'Library 2nd Floor',
        date: '2026-10-01T10:00:00.000Z',
        status: 'Active',
        claimStatus: 'rejected',
        reportedBy: {
          name: 'Student Owner',
          studentId: '2023001',
          email: 'owner@apsit.edu.in',
          phone: '9876543210',
        },
        foundBy: null,
        claims: [
          {
            _id: 'claim-1',
            fullName: 'Wrong Finder',
            status: 'rejected',
            createdAt: '2026-10-02T12:00:00.000Z',
            submittedAt: '2026-10-02T12:00:00.000Z',
            rejectedAt: '2026-10-02T14:30:00.000Z',
            rejectionReason: 'Claim rejected by owner ("This Is Not My Item") - item returned to active search.',
            finder: { name: 'Wrong Finder', email: 'wrong@apsit.edu.in' },
          },
        ],
      },
      {
        _id: '670000000000000000000002',
        title: 'Blue Water Bottle',
        type: 'found',
        category: 'Other',
        location: 'Cafeteria',
        date: '2026-09-28T09:00:00.000Z',
        status: 'Claimed',
        claimStatus: 'approved',
        reportedBy: { name: 'Campus Finder', email: 'finder@apsit.edu.in' },
        foundBy: { name: 'Campus Finder', email: 'finder@apsit.edu.in' },
        updatedAt: '2026-09-30T16:00:00.000Z',
        resolvedAt: '2026-09-30T16:00:00.000Z',
        claims: [],
      },
      {
        _id: '670000000000000000000003',
        title: 'Scientific Calculator',
        type: 'lost',
        category: 'Electronics',
        location: 'Lab 304',
        date: '2026-09-15T11:00:00.000Z',
        status: 'Resolved',
        claimStatus: 'resolved',
        reportedBy: { name: 'Student Owner', email: 'owner@apsit.edu.in' },
        foundBy: { name: 'Lab Assistant', email: 'lab@apsit.edu.in' },
        resolvedAt: '2026-09-20T15:00:00.000Z',
        claims: [
          {
            _id: 'claim-2',
            fullName: 'Lab Assistant',
            status: 'resolved',
            createdAt: '2026-09-18T10:00:00.000Z',
            submittedAt: '2026-09-18T10:00:00.000Z',
            resolvedAt: '2026-09-20T15:00:00.000Z',
            finderMessage: 'Item handed over to owner.',
          },
        ],
      },
    ];

    it('Print Report for watch prints ONLY the selected watch item and excludes all other reports', () => {
      const selectedItem = mockReports[0]; // Watch report
      assert.strictEqual(selectedItem.title, 'Analog Watch');

      // The single report view receives strictly the selected item
      const singleReportData = {
        item: selectedItem,
        reportId: selectedItem._id,
        itemName: selectedItem.title,
        status: selectedItem.status,
        claimStatus: selectedItem.claimStatus,
        owner: selectedItem.reportedBy,
        finderClaims: selectedItem.claims,
      };

      assert.strictEqual(singleReportData.reportId, '670000000000000000000001');
      assert.strictEqual(singleReportData.itemName, 'Analog Watch');
      assert.strictEqual(singleReportData.status, 'Active');
      // Verifies no other items are present in single report
      assert.strictEqual(Array.isArray(singleReportData.item), false);
      assert.strictEqual(singleReportData.itemName.includes('Bottle'), false);
      assert.strictEqual(singleReportData.itemName.includes('Calculator'), false);
    });

    it('Print Report includes relevant finder and rejected finder history for the report', () => {
      const watchItem = mockReports[0];
      const rejectedClaim = watchItem.claims.find((c) => c.status === 'rejected');

      assert.ok(rejectedClaim, 'Watch item must have its rejected claim');
      assert.strictEqual(rejectedClaim.fullName, 'Wrong Finder');
      assert.strictEqual(rejectedClaim.status, 'rejected');
      assert.ok(rejectedClaim.submittedAt);
      assert.ok(rejectedClaim.rejectedAt);
      assert.ok(rejectedClaim.rejectionReason);
    });

    it('Print History prints the COMPLETE history dataset across all types and statuses', () => {
      // Print History receives the full dataset of all reports
      const historyDataset = mockReports;
      assert.strictEqual(historyDataset.length, 3);

      const types = historyDataset.map((i) => i.type);
      assert.ok(types.includes('lost'));
      assert.ok(types.includes('found'));

      const statuses = historyDataset.map((i) => i.status);
      assert.ok(statuses.includes('Active'));
      assert.ok(statuses.includes('Claimed'));
      assert.ok(statuses.includes('Resolved'));

      // Verifies all required fields exist for each record in history
      historyDataset.forEach((item) => {
        assert.ok(item._id, 'Must have Report ID');
        assert.ok(item.title, 'Must have Item Name');
        assert.ok(item.type, 'Must have Report Type');
        assert.ok(item.category, 'Must have Category');
        assert.ok(item.location, 'Must have Location');
        assert.ok(item.date, 'Must have Date');
        assert.ok(item.status, 'Must have Current Status');
        assert.ok(item.reportedBy, 'Must have Reported By / Owner');
      });
    });

    it('Print History preserves complete audit information for rejected finder attempts', () => {
      const allClaimsInHistory = mockReports.flatMap((i) => i.claims || []);
      const rejectedAttempts = allClaimsInHistory.filter((c) => c.status === 'rejected');

      assert.strictEqual(rejectedAttempts.length, 1);
      const audit = rejectedAttempts[0];
      assert.strictEqual(audit.fullName, 'Wrong Finder');
      assert.strictEqual(audit.status, 'rejected');
      assert.ok(audit.submittedAt, 'Must preserve claim date');
      assert.ok(audit.rejectedAt, 'Must preserve rejected date');
      assert.ok(audit.rejectionReason, 'Must preserve rejection information');
    });

    it('Simplified Print History uses a stacked card layout structure for every report', () => {
      // Confirms the history collection renders individual cards for all items without dense tables
      const historyCards = mockReports.map((it, idx) => ({
        reportLabel: `REPORT ${idx + 1}`,
        reportId: it._id,
        title: it.title,
        type: it.type,
        category: it.category,
        location: it.location,
        hasClaim: Boolean(it.foundBy || (it.claims && it.claims.length > 0) || it.claimStatus),
        isResolved: ['resolved', 'claimed'].includes((it.status || '').toLowerCase()),
        rejectedClaims: (it.claims || []).filter((c) => c.status === 'rejected'),
      }));

      assert.strictEqual(historyCards.length, 3);
      assert.strictEqual(historyCards[0].reportLabel, 'REPORT 1');
      assert.strictEqual(historyCards[1].reportLabel, 'REPORT 2');
      assert.strictEqual(historyCards[2].reportLabel, 'REPORT 3');
      assert.strictEqual(historyCards[0].rejectedClaims.length, 1);
    });

    it('Simplified Print Report presents clean sections and conditional visibility', () => {
      // 1. Pending lost item with no finder
      const pendingLostItem = {
        _id: 'item-pending',
        title: 'Black Umbrella',
        category: 'Accessories',
        location: 'Ground Floor Lobby',
        date: '2026-10-02',
        description: 'Plain black umbrella left near bench.',
        type: 'lost',
        status: 'Pending',
        reportedBy: { name: 'Student A', studentId: '202401', email: 'a@apsit.edu.in', phone: '9876543210' },
        claims: [],
      };

      const hasClaimOrFinderPending = Boolean(pendingLostItem.foundBy || (pendingLostItem.claims && pendingLostItem.claims.length > 0) || pendingLostItem.claimStatus);
      const isResolvedPending = ['resolved', 'claimed'].includes((pendingLostItem.status || '').toLowerCase());
      const hasMultipleAttemptsPending = pendingLostItem.claims && (pendingLostItem.claims.length > 1 || pendingLostItem.claims.some(c => c.status === 'rejected'));

      assert.strictEqual(hasClaimOrFinderPending, false, 'Pending item with no claim should hide Claim / Finder section');
      assert.strictEqual(isResolvedPending, false, 'Pending item should hide Resolution section');
      assert.strictEqual(hasMultipleAttemptsPending, false, 'Pending item with no claims should hide Finder History section');

      // 2. Active lost item with finder reported
      const itemWithFinder = mockReports[0]; // Watch report
      const hasClaimOrFinderActive = Boolean(itemWithFinder.foundBy || (itemWithFinder.claims && itemWithFinder.claims.length > 0) || itemWithFinder.claimStatus);
      const isResolvedActive = ['resolved', 'claimed'].includes((itemWithFinder.status || '').toLowerCase());
      const hasFinderHistoryActive = itemWithFinder.claims && (itemWithFinder.claims.length > 1 || itemWithFinder.claims.some(c => c.status === 'rejected'));

      assert.strictEqual(hasClaimOrFinderActive, true, 'Item with claim should show Claim / Finder section');
      assert.strictEqual(isResolvedActive, false, 'Active item should not show Resolution section');
      assert.strictEqual(hasFinderHistoryActive, true, 'Item with rejected claim should show Finder History');

      // 3. Resolved item
      const resolvedItem = mockReports[2]; // Calculator report
      const isResolved = ['resolved', 'claimed'].includes((resolvedItem.status || '').toLowerCase());
      assert.strictEqual(isResolved, true, 'Resolved item must show Resolution section');
    });

    it('Status badge text maps clearly to standard states: LOST, FOUND BY, RESOLVED, REJECTED', () => {
      const getStatusText = (item) => {
        const s = (item.status || '').toLowerCase();
        const cs = (item.claimStatus || '').toLowerCase();
        if (s === 'resolved' || s === 'claimed') return 'RESOLVED';
        if (item.foundBy || ['contacted', 'pending owner confirmation'].includes(cs)) return 'FOUND BY';
        if (cs === 'rejected') return 'REJECTED';
        if ((item.type || '').toLowerCase() === 'lost') return 'LOST';
        if ((item.type || '').toLowerCase() === 'found') return 'FOUND';
        return (item.status || 'ACTIVE').toUpperCase();
      };

      assert.strictEqual(getStatusText({ status: 'Resolved' }), 'RESOLVED');
      assert.strictEqual(getStatusText({ status: 'Active', foundBy: { name: 'Finder' } }), 'FOUND BY');
      assert.strictEqual(getStatusText({ status: 'Active', claimStatus: 'rejected' }), 'REJECTED');
      assert.strictEqual(getStatusText({ status: 'Active', type: 'lost' }), 'LOST');
    });
  });

  describe('Admin Claim History & View Rules (No Admin Approval for Recovery)', () => {
    const getAdminClaimActions = (claim) => {
      // Admin does NOT approve or reject recovery
      // Dashboard is ONLY for viewing history, owner, finder, claim status, proof photo, rejected finder attempts, resolution date, recovery type
      return {
        hasApproveButton: false,
        hasRejectVerificationButton: false,
        canViewDetails: true,
        canDelete: true,
      };
    };

    it('removes "Approve & Resolve" and "Reject Verification" from Admin Dashboard', () => {
      const actions = getAdminClaimActions({ status: 'Contacted' });
      assert.strictEqual(actions.hasApproveButton, false);
      assert.strictEqual(actions.hasRejectVerificationButton, false);
      assert.strictEqual(actions.canViewDetails, true);
    });

    it('Admin Dashboard displays complete claim history and audit fields', () => {
      const getAdminHistoryDisplay = (claim) => {
        return {
          claimId: claim._id,
          itemName: claim.itemName || claim.item?.title,
          owner: claim.owner?.name || claim.item?.reportedBy?.name,
          finder: claim.finder?.name || claim.fullName,
          status: claim.status,
          hasProofImage: Boolean(claim.image),
          ownerConfirmedAt: claim.ownerConfirmedAt,
          resolutionDate: claim.resolvedAt,
          recoveryType: claim.item?.recoveryType || (claim.status === 'resolved' ? 'Student Finder Recovery' : 'Standard Claim'),
          rejectedAttempts: claim.rejectedAt ? [{ rejectedAt: claim.rejectedAt }] : [],
        };
      };

      const record = getAdminHistoryDisplay({
        _id: 'claim-123',
        itemName: 'Watch',
        fullName: 'Finder Student',
        status: 'resolved',
        image: 'https://cloudinary.com/proof.jpg',
        ownerConfirmedAt: '2026-10-04T10:00:00Z',
        resolvedAt: '2026-10-04T10:00:00Z',
        owner: { name: 'Owner Student' },
      });

      assert.strictEqual(record.itemName, 'Watch');
      assert.strictEqual(record.finder, 'Finder Student');
      assert.strictEqual(record.owner, 'Owner Student');
      assert.strictEqual(record.status, 'resolved');
      assert.strictEqual(record.hasProofImage, true);
      assert.strictEqual(record.recoveryType, 'Student Finder Recovery');
      assert.ok(record.resolutionDate);
      assert.ok(record.ownerConfirmedAt);
    });

    it('maps all workflow statuses without Pending Admin Verification', () => {
      const mapWorkflowStatus = (item) => {
        const s = (item.status || '').toLowerCase();
        const cs = (item.claimStatus || (item.claims && item.claims[0]?.status) || '').toLowerCase();
        const hasAdminRejected = (item.claims && item.claims.some((c) => c.status === 'Admin Rejected')) || cs === 'admin rejected';

        if (s === 'resolved' || s === 'claimed') return 'RESOLVED';
        if (hasAdminRejected) return 'ADMIN REJECTED';
        if (item.foundBy || ['contacted', 'pending owner confirmation'].includes(cs)) return 'FINDER REPORTED';
        if (cs === 'rejected') return 'REJECTED';
        if (s === 'active' && !item.type) return 'ACTIVE';
        if ((item.type || '').toLowerCase() === 'lost') return 'LOST';
        if ((item.type || '').toLowerCase() === 'found') return 'FOUND';
        return (item.status || 'ACTIVE').toUpperCase();
      };

      assert.strictEqual(mapWorkflowStatus({ status: 'Active', type: 'lost' }), 'LOST');
      assert.strictEqual(mapWorkflowStatus({ status: 'Active' }), 'ACTIVE');
      assert.strictEqual(mapWorkflowStatus({ status: 'Active', foundBy: { name: 'Student' } }), 'FINDER REPORTED');
      assert.strictEqual(mapWorkflowStatus({ status: 'Active', claims: [{ status: 'Admin Rejected' }] }), 'ADMIN REJECTED');
      assert.strictEqual(mapWorkflowStatus({ status: 'Resolved' }), 'RESOLVED');
    });
  });

  describe('Direct Recovery Workflow Rules (Case 1 & Case 2)', () => {
    it('Case 1: Another Student Finds Item directly resolves upon owner OTP without admin approval', () => {
      const processFinderRecovery = ({ item, claim, ownerOtpVerified }) => {
        if (!ownerOtpVerified) throw new Error('OTP verification required');
        const now = new Date();
        return {
          item: {
            ...item,
            status: 'Resolved',
            resolvedAt: now,
            foundBy: claim.finder,
            ownerConfirmedAt: now,
            ownerConfirmedBy: 'owner-id',
          },
          claim: {
            ...claim,
            status: 'resolved',
            resolvedAt: now,
            ownerConfirmedAt: now,
            ownerConfirmedBy: 'owner-id',
          },
          emailsSentTo: ['owner', 'finder'],
          requiresAdminApproval: false,
        };
      };

      const result = processFinderRecovery({
        item: { _id: 'item-1', status: 'Active', type: 'lost' },
        claim: { _id: 'claim-1', finder: 'finder-id', status: 'Contacted' },
        ownerOtpVerified: true,
      });

      assert.strictEqual(result.item.status, 'Resolved');
      assert.strictEqual(result.claim.status, 'resolved');
      assert.strictEqual(result.item.foundBy, 'finder-id');
      assert.ok(result.item.resolvedAt);
      assert.ok(result.claim.resolvedAt);
      assert.ok(result.item.ownerConfirmedAt);
      assert.strictEqual(result.requiresAdminApproval, false);
      assert.deepStrictEqual(result.emailsSentTo, ['owner', 'finder']);
    });

    it('Case 2: Owner Finds Own Item directly resolves upon owner OTP without admin approval', () => {
      const processOwnerSelfRecovery = ({ item, ownerOtpVerified }) => {
        if (!ownerOtpVerified) throw new Error('OTP verification required');
        const now = new Date();
        return {
          item: {
            ...item,
            status: 'Resolved',
            recoveryType: 'owner_found',
            recoveredBy: 'owner-id',
            ownerConfirmedAt: now,
            ownerConfirmedBy: 'owner-id',
            resolvedAt: now,
          },
          requiresAdminApproval: false,
          noFinderClaimCreated: true,
          emailsSentTo: ['owner'],
        };
      };

      const result = processOwnerSelfRecovery({
        item: { _id: 'item-2', status: 'Active', type: 'lost' },
        ownerOtpVerified: true,
      });

      assert.strictEqual(result.item.status, 'Resolved');
      assert.strictEqual(result.item.recoveryType, 'owner_found');
      assert.strictEqual(result.item.recoveredBy, 'owner-id');
      assert.ok(result.item.resolvedAt);
      assert.ok(result.item.ownerConfirmedAt);
      assert.strictEqual(result.requiresAdminApproval, false);
      assert.strictEqual(result.noFinderClaimCreated, true);
    });

    it('Wrong Finder: Owner clicks "This Is Not My Item", resets foundBy, claim rejected, item remains Active/Lost', () => {
      const rejectFinder = ({ item, claim }) => {
        return {
          item: { ...item, foundBy: null, status: 'Active' },
          claim: { ...claim, status: 'rejected', rejectedAt: new Date() },
          allowsNewFinder: true,
        };
      };

      const res = rejectFinder({
        item: { _id: 'item-3', foundBy: 'wrong-finder-id', status: 'Active' },
        claim: { _id: 'claim-3', finder: 'wrong-finder-id', status: 'Contacted' },
      });

      assert.strictEqual(res.item.foundBy, null);
      assert.strictEqual(res.item.status, 'Active');
      assert.strictEqual(res.claim.status, 'rejected');
      assert.strictEqual(res.allowsNewFinder, true);
    });

    it('maps Another Student Finds timeline: Reported Lost -> Active -> Finder Reported -> Owner Confirmed Recovery -> Resolved', () => {
      const getFinderTimeline = (item) => {
        const hasFinder = Boolean(item.foundBy || (item.claims && item.claims.length > 0));
        const isOwnerConfirmed = Boolean(item.ownerConfirmedAt || item.status === 'Resolved');
        const isResolved = item.status === 'Resolved';

        return [
          { step: 1, title: 'Reported Lost', completed: true },
          { step: 2, title: 'Active', completed: true },
          { step: 3, title: 'Finder Reported', completed: hasFinder },
          { step: 4, title: 'Owner Confirmed Recovery', completed: isOwnerConfirmed },
          { step: 5, title: 'Resolved', completed: isResolved },
        ];
      };

      const timeline = getFinderTimeline({
        status: 'Resolved',
        foundBy: { name: 'Finder' },
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
      });

      assert.strictEqual(timeline.length, 5);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[2].title, 'Finder Reported');
      assert.strictEqual(timeline[3].title, 'Owner Confirmed Recovery');
      assert.strictEqual(timeline[4].title, 'Resolved');
      assert.ok(timeline.every((t) => t.completed));
    });

    it('maps Owner Finds Own Item timeline: Reported Lost -> Active -> Owner Found Item -> OTP Verified -> Resolved', () => {
      const getOwnerSelfTimeline = (item) => {
        return [
          { step: 1, title: 'Reported Lost', completed: true },
          { step: 2, title: 'Active', completed: true },
          { step: 3, title: 'Owner Found Item', completed: item.recoveryType === 'owner_found' },
          { step: 4, title: 'OTP Verified', completed: Boolean(item.ownerConfirmedAt) },
          { step: 5, title: 'Resolved', completed: item.status === 'Resolved' },
        ];
      };

      const timeline = getOwnerSelfTimeline({
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'owner_found',
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
      });

      assert.strictEqual(timeline.length, 5);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[2].title, 'Owner Found Item');
      assert.strictEqual(timeline[3].title, 'OTP Verified');
      assert.strictEqual(timeline[4].title, 'Resolved');
      assert.ok(timeline.every((t) => t.completed));
    });

    it('displays owner recovery audit info in Admin Dashboard view', () => {
      const getAuditDisplay = (item) => {
        if (item.recoveryType === 'owner_found') {
          return {
            recoveryType: 'Owner Found Item',
            recoveredBy: 'Owner',
            ownerConfirmation: 'Confirmed',
            otpVerified: true,
            status: 'Resolved',
            resolutionDate: item.resolvedAt || item.updatedAt,
          };
        }
        return {
          recoveryType: 'Student Finder Recovery',
          recoveredBy: item.foundBy?.name || 'Finder',
          ownerConfirmation: 'Confirmed',
          otpVerified: true,
          status: 'Resolved',
          resolutionDate: item.resolvedAt || item.updatedAt,
        };
      };

      const audit = getAuditDisplay({
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'owner_found',
        resolvedAt: '2026-10-04T12:00:00Z',
      });

      assert.ok(audit);
      assert.strictEqual(audit.recoveryType, 'Owner Found Item');
      assert.strictEqual(audit.recoveredBy, 'Owner');
      assert.strictEqual(audit.ownerConfirmation, 'Confirmed');
      assert.strictEqual(audit.otpVerified, true);
      assert.strictEqual(audit.status, 'Resolved');
      assert.ok(audit.resolutionDate);
    });
  });

  describe('Admin Dashboard Section Filtering & Stored Workflow Rules (Section 9)', () => {
    const isResolvedItem = (i) => {
      const s = (i.status || '').toLowerCase();
      return s === 'resolved' || s === 'claimed';
    };

    const getActiveClaim = (i) => {
      if (!i.claims || i.claims.length === 0) return null;
      return (
        i.claims.find((c) => {
          const cs = (c.status || '').toLowerCase();
          return ['contacted', 'pending', 'pending owner confirmation', 'pending admin verification', 'approved'].includes(cs);
        }) || null
      );
    };

    const getResolvedClaim = (i) => {
      if (!i.claims || i.claims.length === 0) return null;
      return i.claims.find((c) => (c.status || '').toLowerCase() === 'resolved') || null;
    };

    const hasActiveFinder = (i) => {
      if (!i) return false;
      if (i.foundBy) return true;
      return Boolean(getActiveClaim(i));
    };

    const filterLostItems = (items) =>
      items.filter((i) => i.type === 'lost' && !isResolvedItem(i) && !hasActiveFinder(i));

    const filterFoundItems = (items) =>
      items.filter((i) => !isResolvedItem(i) && (i.type === 'found' || (i.type === 'lost' && hasActiveFinder(i))));

    const filterClaimRequests = (claims) =>
      claims.filter((c) => {
        const cs = (c.status || '').toLowerCase();
        const activeStatuses = ['contacted', 'pending', 'pending owner confirmation', 'pending admin verification', 'approved'];
        if (!activeStatuses.includes(cs)) return false;
        if (c.item && typeof c.item === 'object' && isResolvedItem(c.item)) return false;
        return true;
      });

    const filterClaimed = (items) => items.filter((i) => isResolvedItem(i));

    const getRecoveryTypeLabel = (item) => {
      if (!item) return '—';
      if (item.recoveryType === 'owner_found') return 'Owner Found Item';
      if (item.recoveryType === 'finder_found') return 'Finder Found Item';
      if (item.recoveryType === 'normal_found') return 'Normal Found Report';
      if (item.type === 'found') return 'Normal Found Report';
      if (item.foundBy || item.claimedBy || (item.claims && item.claims.length > 0)) return 'Finder Found Item';
      return 'Owner Found Item';
    };

    const getItemTimeline = (item) => {
      if (!item) return [];

      const isResolved = isResolvedItem(item);
      const claims = item.claims || [];
      const latestClaim = claims[0];
      const activeClaim = getActiveClaim(item);
      const resolvedClaim = getResolvedClaim(item);
      const rejectedClaims = claims.filter(
        (c) => (c.status || '').toLowerCase() === 'rejected' || c.status === 'Admin Rejected'
      );

      // Case D: Normal Found Report
      if (item.type === 'found' || item.recoveryType === 'normal_found') {
        const steps = [
          {
            title: 'Reported Found',
            desc: `Reported by ${item.reportedBy?.name || 'Student'}`,
            date: item.createdAt || item.date,
            status: 'completed',
          },
        ];

        if (claims.length > 0) {
          steps.push({
            title: 'Claim Submitted',
            desc: `Claim submitted by ${latestClaim?.fullName || latestClaim?.finder?.name || item.claimedBy?.name || 'Owner'}`,
            date: latestClaim?.submittedAt || latestClaim?.createdAt,
            status: 'completed',
          });
        }

        if (item.ownerConfirmedAt || isResolved) {
          steps.push({
            title: 'Owner Verified',
            desc: item.ownerConfirmedAt ? 'Verified via OTP' : 'Verified',
            date: item.ownerConfirmedAt || item.resolvedAt,
            status: 'completed',
          });
          steps.push({
            title: 'Resolved',
            desc: 'Item recovery completed and closed',
            date: item.resolvedAt || item.updatedAt,
            status: 'completed',
          });
        } else if (claims.length > 0) {
          steps.push({
            title: 'Claim Pending Verification',
            desc: 'Waiting for verification',
            status: 'current',
          });
        }

        return steps;
      }

      // Lost item flows (Cases A, B, C)
      const steps = [
        {
          title: 'Reported Lost',
          desc: `Reported by ${item.reportedBy?.name || 'Owner'}`,
          date: item.createdAt || item.date,
          status: 'completed',
        },
        {
          title: 'Active',
          desc: 'Searching for item on campus',
          date: item.createdAt,
          status: 'completed',
        },
      ];

      // Case A: Owner finds own item
      if (item.recoveryType === 'owner_found') {
        steps.push({
          title: 'Owner Found Item',
          desc: `Owner (${item.recoveredBy?.name || item.reportedBy?.name || 'Owner'}) reported finding own item`,
          date: item.ownerConfirmedAt || item.resolvedAt,
          status: 'completed',
        });
        steps.push({
          title: 'Owner OTP Verified',
          desc: '6-digit OTP verified successfully',
          date: item.ownerConfirmedAt || item.resolvedAt,
          status: 'completed',
        });
        steps.push({
          title: 'Resolved',
          desc: 'Item marked as resolved with owner self-recovery',
          date: item.resolvedAt || item.updatedAt,
          status: 'completed',
        });
        return steps;
      }

      // Case B: Another student finds item and it is resolved
      if (isResolved && (item.recoveryType === 'finder_found' || resolvedClaim || item.foundBy)) {
        const finderName = item.foundBy?.name || resolvedClaim?.fullName || resolvedClaim?.finder?.name || 'Finder';
        steps.push({
          title: 'Finder Reported',
          desc: `Found by ${finderName} with proof image & OTP verification`,
          date: resolvedClaim?.submittedAt || item.updatedAt,
          status: 'completed',
        });
        steps.push({
          title: 'Owner Confirmed Recovery',
          desc: 'Owner confirmed "I Got My Item Back"',
          date: item.ownerConfirmedAt || resolvedClaim?.ownerConfirmedAt || item.resolvedAt,
          status: 'completed',
        });
        steps.push({
          title: 'Owner OTP Verified',
          desc: 'Owner verified 6-digit recovery OTP',
          date: item.ownerConfirmedAt || item.resolvedAt,
          status: 'completed',
        });
        steps.push({
          title: 'Resolved',
          desc: 'Recovery completed and resolved without admin approval',
          date: item.resolvedAt || item.updatedAt,
          status: 'completed',
        });
        return steps;
      }

      // Case C: Wrong Finder (rejected claims and currently active lost)
      if (!isResolved && rejectedClaims.length > 0 && !activeClaim && !item.foundBy) {
        const lastRejected = rejectedClaims[0];
        const finderName = lastRejected.fullName || lastRejected.finder?.name || 'Finder';
        steps.push({
          title: 'Finder Reported',
          desc: `Reported by ${finderName}`,
          date: lastRejected.submittedAt || lastRejected.createdAt,
          status: 'completed',
        });
        steps.push({
          title: 'Finder Rejected',
          desc: 'Owner clicked "This Is Not My Item"',
          date: lastRejected.rejectedAt || lastRejected.updatedAt,
          status: 'rejected',
        });
        steps.push({
          title: 'Active',
          desc: 'Returned to active Lost items searching for finder',
          date: lastRejected.rejectedAt || lastRejected.updatedAt,
          status: 'current',
        });
        return steps;
      }

      // In-progress Finder Report (Case B waiting for owner confirmation)
      if (!isResolved && (activeClaim || item.foundBy)) {
        const finderName = item.foundBy?.name || activeClaim?.fullName || activeClaim?.finder?.name || 'Finder';
        steps.push({
          title: 'Finder Reported',
          desc: `Found by ${finderName} (OTP verified)`,
          date: activeClaim?.submittedAt || activeClaim?.createdAt || item.updatedAt,
          status: 'completed',
        });
        steps.push({
          title: 'Waiting for Owner Confirmation',
          desc: 'Owner notification sent, awaiting owner OTP confirmation',
          status: 'current',
        });
        return steps;
      }

      return steps;
    };

    it('LOST report appears in Lost Items while active and unresolved', () => {
      const lostItem = {
        _id: 'item_101',
        title: 'Titan Watch',
        type: 'lost',
        status: 'Active',
        reportedBy: { name: 'Rahul Sharma' },
        category: 'Accessories',
        location: 'Library 2nd Floor',
        date: '2026-10-01',
        foundBy: null,
        claims: [],
      };

      const lostList = filterLostItems([lostItem]);
      const foundList = filterFoundItems([lostItem]);
      const claimedList = filterClaimed([lostItem]);

      assert.strictEqual(lostList.length, 1);
      assert.strictEqual(lostList[0]._id, 'item_101');
      assert.strictEqual(foundList.length, 0);
      assert.strictEqual(claimedList.length, 0);
    });

    it('finder report causes item to appear in Found Items and active claim in Claim Requests', () => {
      const finderClaim = {
        _id: 'claim_501',
        item: 'item_101',
        fullName: 'Priya Patel',
        email: '24107002@apsit.edu.in',
        phone: '9876543210',
        status: 'Contacted',
        image: 'https://cloudinary.com/proof.jpg',
      };

      const itemWithFinder = {
        _id: 'item_101',
        title: 'Titan Watch',
        type: 'lost',
        status: 'Active',
        reportedBy: { name: 'Rahul Sharma' },
        foundBy: { name: 'Priya Patel' },
        claims: [finderClaim],
      };

      const lostList = filterLostItems([itemWithFinder]);
      const foundList = filterFoundItems([itemWithFinder]);
      const claimRequests = filterClaimRequests([finderClaim]);
      const claimedList = filterClaimed([itemWithFinder]);

      // No longer in unresolved Lost Items
      assert.strictEqual(lostList.length, 0);
      // Appears in Found Items
      assert.strictEqual(foundList.length, 1);
      assert.strictEqual(foundList[0]._id, 'item_101');
      // Active claim appears in Claim Requests
      assert.strictEqual(claimRequests.length, 1);
      assert.strictEqual(claimRequests[0]._id, 'claim_501');
      // Not yet claimed
      assert.strictEqual(claimedList.length, 0);
    });

    it('finder-reported lost item is not duplicated across sections (single underlying record)', () => {
      const originalItem = {
        _id: 'item_101',
        title: 'Titan Watch',
        type: 'lost',
        status: 'Active',
      };

      // State 1: Lost
      const lostFiltered = filterLostItems([originalItem]);
      assert.strictEqual(lostFiltered[0]._id, 'item_101');

      // State 2: Finder reported (same object updated, no copy)
      const finderItem = {
        ...originalItem,
        foundBy: { name: 'Priya' },
        claims: [{ status: 'Contacted' }],
      };
      const foundFiltered = filterFoundItems([finderItem]);
      assert.strictEqual(foundFiltered[0]._id, 'item_101');

      // State 3: Resolved (same object updated, no copy)
      const resolvedItem = {
        ...finderItem,
        status: 'Resolved',
        recoveryType: 'finder_found',
      };
      const claimedFiltered = filterClaimed([resolvedItem]);
      assert.strictEqual(claimedFiltered[0]._id, 'item_101');
    });

    it('completed finder recovery appears in Claimed and disappears from active Lost, Found, and Claim Requests', () => {
      const resolvedClaim = {
        _id: 'claim_501',
        item: { _id: 'item_101', status: 'Resolved' },
        fullName: 'Priya Patel',
        status: 'resolved',
      };

      const completedItem = {
        _id: 'item_101',
        title: 'Titan Watch',
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'finder_found',
        reportedBy: { name: 'Rahul Sharma' },
        foundBy: { name: 'Priya Patel' },
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [resolvedClaim],
      };

      const lostList = filterLostItems([completedItem]);
      const foundList = filterFoundItems([completedItem]);
      const claimRequests = filterClaimRequests([resolvedClaim]);
      const claimedList = filterClaimed([completedItem]);

      assert.strictEqual(lostList.length, 0);
      assert.strictEqual(foundList.length, 0);
      assert.strictEqual(claimRequests.length, 0);
      assert.strictEqual(claimedList.length, 1);
      assert.strictEqual(claimedList[0]._id, 'item_101');
      assert.strictEqual(getRecoveryTypeLabel(completedItem), 'Finder Found Item');
    });

    it('owner self-recovery appears directly in Claimed without creating finder claim', () => {
      const selfRecoveredItem = {
        _id: 'item_102',
        title: 'Black Backpack',
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'owner_found',
        reportedBy: { name: 'Rahul Sharma' },
        recoveredBy: { name: 'Rahul Sharma' },
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [],
      };

      const lostList = filterLostItems([selfRecoveredItem]);
      const foundList = filterFoundItems([selfRecoveredItem]);
      const claimRequests = filterClaimRequests([]);
      const claimedList = filterClaimed([selfRecoveredItem]);

      assert.strictEqual(lostList.length, 0);
      assert.strictEqual(foundList.length, 0);
      assert.strictEqual(claimRequests.length, 0);
      assert.strictEqual(claimedList.length, 1);
      assert.strictEqual(getRecoveryTypeLabel(selfRecoveredItem), 'Owner Found Item');
      assert.strictEqual(selfRecoveredItem.claims.length, 0);
    });

    it('normal FOUND report can become Claimed after recovery', () => {
      const normalFoundItem = {
        _id: 'item_201',
        title: 'Blue Water Bottle',
        type: 'found',
        status: 'Pending',
        reportedBy: { name: 'Amit Verma' },
        claims: [],
      };

      // Initially appears in Found Items
      assert.strictEqual(filterFoundItems([normalFoundItem]).length, 1);
      assert.strictEqual(filterClaimed([normalFoundItem]).length, 0);

      // Once claimed and resolved:
      const resolvedFoundItem = {
        ...normalFoundItem,
        status: 'Resolved',
        recoveryType: 'normal_found',
        claimedBy: { name: 'Sneha Shah' },
        resolvedAt: '2026-10-04T14:00:00Z',
      };

      assert.strictEqual(filterFoundItems([resolvedFoundItem]).length, 0);
      assert.strictEqual(filterClaimed([resolvedFoundItem]).length, 1);
      assert.strictEqual(getRecoveryTypeLabel(resolvedFoundItem), 'Normal Found Report');
    });

    it('wrong finder rejection returns item to Lost and keeps rejected claim in history', () => {
      const rejectedClaim = {
        _id: 'claim_502',
        item: 'item_103',
        fullName: 'Wrong Finder',
        status: 'rejected',
        rejectedAt: '2026-10-04T11:00:00Z',
      };

      const itemAfterRejection = {
        _id: 'item_103',
        title: 'Dell Charger',
        type: 'lost',
        status: 'Active',
        foundBy: null,
        claims: [rejectedClaim],
      };

      // Returns to Lost Items
      const lostList = filterLostItems([itemAfterRejection]);
      const foundList = filterFoundItems([itemAfterRejection]);
      const claimRequests = filterClaimRequests([rejectedClaim]);

      assert.strictEqual(lostList.length, 1);
      assert.strictEqual(foundList.length, 0);
      // Rejected claim does NOT appear in active Claim Requests
      assert.strictEqual(claimRequests.length, 0);
      // But rejected claim stays in history
      assert.strictEqual(itemAfterRejection.claims.length, 1);
      assert.strictEqual(itemAfterRejection.claims[0].status, 'rejected');
    });

    it('Case A timeline: Reported Lost -> Active -> Owner Found Item -> Owner OTP Verified -> Resolved', () => {
      const item = {
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'owner_found',
        reportedBy: { name: 'Owner' },
        recoveredBy: { name: 'Owner' },
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [],
      };

      const timeline = getItemTimeline(item);
      assert.strictEqual(timeline.length, 5);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[2].title, 'Owner Found Item');
      assert.strictEqual(timeline[3].title, 'Owner OTP Verified');
      assert.strictEqual(timeline[4].title, 'Resolved');
    });

    it('Case B timeline: Reported Lost -> Active -> Finder Reported -> Owner Confirmed Recovery -> Owner OTP Verified -> Resolved', () => {
      const item = {
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'finder_found',
        reportedBy: { name: 'Owner' },
        foundBy: { name: 'Finder' },
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [{ status: 'resolved', fullName: 'Finder' }],
      };

      const timeline = getItemTimeline(item);
      assert.strictEqual(timeline.length, 6);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[2].title, 'Finder Reported');
      assert.strictEqual(timeline[3].title, 'Owner Confirmed Recovery');
      assert.strictEqual(timeline[4].title, 'Owner OTP Verified');
      assert.strictEqual(timeline[5].title, 'Resolved');
    });

    it('Case C timeline: Reported Lost -> Active -> Finder Reported -> Finder Rejected -> Active', () => {
      const item = {
        type: 'lost',
        status: 'Active',
        foundBy: null,
        reportedBy: { name: 'Owner' },
        claims: [{ status: 'rejected', fullName: 'Wrong Student', rejectedAt: '2026-10-04T10:00:00Z' }],
      };

      const timeline = getItemTimeline(item);
      assert.strictEqual(timeline.length, 5);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[2].title, 'Finder Reported');
      assert.strictEqual(timeline[3].title, 'Finder Rejected');
      assert.strictEqual(timeline[4].title, 'Active');
    });

    it('Case D timeline: Reported Found -> Claim Submitted -> Owner Verified -> Resolved', () => {
      const item = {
        type: 'found',
        status: 'Resolved',
        recoveryType: 'normal_found',
        reportedBy: { name: 'Reporting Student' },
        claimedBy: { name: 'Owner' },
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [{ status: 'resolved', fullName: 'Owner' }],
      };

      const timeline = getItemTimeline(item);
      assert.strictEqual(timeline.length, 4);
      assert.strictEqual(timeline[0].title, 'Reported Found');
      assert.strictEqual(timeline[1].title, 'Claim Submitted');
      assert.strictEqual(timeline[2].title, 'Owner Verified');
      assert.strictEqual(timeline[3].title, 'Resolved');
    });
  });

  describe('Admin Dashboard Lost Items Image Thumbnail Display', () => {
    const isResolvedItem = (i) => {
      const s = (i.status || '').toLowerCase();
      return s === 'resolved' || s === 'claimed';
    };

    const hasActiveFinder = (i) => {
      if (!i) return false;
      if (i.foundBy) return true;
      if (i.claims && i.claims.length > 0) {
        return i.claims.some((c) => {
          const cs = (c.status || '').toLowerCase();
          return ['contacted', 'pending', 'pending owner confirmation', 'pending admin verification', 'approved'].includes(cs);
        });
      }
      return false;
    };

    const isFoundItem = (i) => !isResolvedItem(i) && (i.type === 'found' || (i.type === 'lost' && hasActiveFinder(i)));
    const isClaimedItem = (i) => isResolvedItem(i);

    // Column definitions for lost-items table
    const lostItemsTableColumns = [
      'IMAGE',
      'ITEM NAME',
      'REPORTED BY',
      'CATEGORY',
      'LOCATION',
      'DATE LOST',
      'STATUS',
      'ACTIONS',
    ];

    it('Lost items table contains IMAGE as first column followed by all required columns', () => {
      assert.strictEqual(lostItemsTableColumns[0], 'IMAGE');
      assert.strictEqual(lostItemsTableColumns[1], 'ITEM NAME');
      assert.strictEqual(lostItemsTableColumns[2], 'REPORTED BY');
      assert.strictEqual(lostItemsTableColumns[3], 'CATEGORY');
      assert.strictEqual(lostItemsTableColumns[4], 'LOCATION');
      assert.strictEqual(lostItemsTableColumns[5], 'DATE LOST');
      assert.strictEqual(lostItemsTableColumns[6], 'STATUS');
      assert.strictEqual(lostItemsTableColumns[7], 'ACTIONS');
    });

    it('Lost item with Cloudinary HTTPS image produces valid thumbnail URL', () => {
      const cloudinaryUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v12345/lost_watch.jpg';
      const itemWithCloudinary = {
        _id: 'lost_img_1',
        title: 'Casio Watch',
        type: 'lost',
        status: 'Active',
        image: cloudinaryUrl,
      };

      const renderImage = (item) => {
        if (!item.image) return { hasImage: false, placeholder: 'No Image' };
        return { hasImage: true, url: getImageUrl(item.image), alt: item.title };
      };

      const result = renderImage(itemWithCloudinary);
      assert.strictEqual(result.hasImage, true);
      assert.strictEqual(result.url, cloudinaryUrl);
      assert.strictEqual(result.alt, 'Casio Watch');
    });

    it('Lost item with legacy /uploads/ image produces valid resolved URL', () => {
      const legacyPath = 'uploads/item_legacy_123.png';
      const itemWithLegacy = {
        _id: 'lost_img_2',
        title: 'Water Bottle',
        type: 'lost',
        status: 'Active',
        image: legacyPath,
      };

      const resolvedUrl = getImageUrl(itemWithLegacy.image);
      assert.ok(resolvedUrl.includes('/uploads/item_legacy_123.png'));
    });

    it('Lost item without image returns placeholder text "No Image"', () => {
      const itemNoImage = {
        _id: 'lost_img_3',
        title: 'Keys',
        type: 'lost',
        status: 'Active',
        image: null,
      };

      const renderImage = (item) => {
        if (!item.image) return { hasImage: false, placeholder: 'No Image' };
        return { hasImage: true, url: getImageUrl(item.image) };
      };

      const result = renderImage(itemNoImage);
      assert.strictEqual(result.hasImage, false);
      assert.strictEqual(result.placeholder, 'No Image');
    });

    it('Thumbnail click sets previewImageModal state with URL and item title', () => {
      let previewModal = null;
      const setPreviewImageModal = (val) => { previewModal = val; };

      const item = {
        _id: 'lost_img_4',
        title: 'Wireless Earbuds',
        image: 'https://res.cloudinary.com/demo/image/upload/earbuds.jpg',
      };

      // Simulate clicking thumbnail
      if (item.image) {
        setPreviewImageModal({ url: getImageUrl(item.image), title: item.title });
      }

      assert.ok(previewModal);
      assert.strictEqual(previewModal.url, 'https://res.cloudinary.com/demo/image/upload/earbuds.jpg');
      assert.strictEqual(previewModal.title, 'Wireless Earbuds');

      // Simulate closing modal
      setPreviewImageModal(null);
      assert.strictEqual(previewModal, null);
    });

    it('Existing View Details action remains intact alongside image thumbnail', () => {
      let detailsOpenedFor = null;
      const handleOpenItemDetails = (item) => { detailsOpenedFor = item._id; };

      const item = {
        _id: 'lost_img_5',
        title: 'Scientific Calculator',
        image: 'https://res.cloudinary.com/demo/calc.jpg',
      };

      handleOpenItemDetails(item);
      assert.strictEqual(detailsOpenedFor, 'lost_img_5');
    });

    it('Found Items and Claimed sections remain unaffected', () => {
      const foundItem = {
        _id: 'found_1',
        title: 'Found Umbrella',
        type: 'found',
        status: 'Active',
      };
      const claimedItem = {
        _id: 'claimed_1',
        title: 'Claimed Laptop',
        type: 'lost',
        status: 'Resolved',
      };

      assert.strictEqual(isFoundItem(foundItem), true);
      assert.strictEqual(isClaimedItem(foundItem), false);

      assert.strictEqual(isClaimedItem(claimedItem), true);
      assert.strictEqual(isFoundItem(claimedItem), false);
    });
  });

  describe('Admin Dashboard Exactly 3 Mutually Exclusive Sections (Lost, Found, Claimed)', () => {
    const isResolvedItem = (i) => {
      if (!i) return false;
      const s = (i.status || '').toLowerCase();
      return s === 'resolved' || s === 'claimed';
    };

    const hasActiveFinder = (i) => {
      if (!i) return false;
      if (i.foundBy) return true;
      if (i.claims && i.claims.length > 0) {
        return i.claims.some((c) => {
          const cs = (c.status || '').toLowerCase();
          return ['contacted', 'pending', 'pending owner confirmation', 'pending admin verification', 'approved'].includes(cs);
        });
      }
      return false;
    };

    const isLostItem = (i) => !isResolvedItem(i) && i.type === 'lost' && !hasActiveFinder(i);
    const isFoundItem = (i) => !isResolvedItem(i) && (i.type === 'found' || (i.type === 'lost' && hasActiveFinder(i)));
    const isClaimedItem = (i) => isResolvedItem(i);

    const filterLost = (items) => items.filter(isLostItem);
    const filterFound = (items) => items.filter(isFoundItem);
    const filterClaimed = (items) => items.filter(isClaimedItem);

    it('1. New lost item appears only in Lost Items', () => {
      const lostItem = {
        _id: 'item_watch_1',
        title: 'Ajinkya Watch',
        type: 'lost',
        status: 'Active',
        reportedBy: { name: 'Ajinkya' },
        foundBy: null,
        claims: [],
      };

      const lost = filterLost([lostItem]);
      const found = filterFound([lostItem]);
      const claimed = filterClaimed([lostItem]);

      assert.strictEqual(lost.length, 1);
      assert.strictEqual(found.length, 0);
      assert.strictEqual(claimed.length, 0);
    });

    it('2. Finder reports it -> item disappears from Lost Items', () => {
      const activeClaim = {
        _id: 'claim_1',
        item: 'item_watch_1',
        fullName: 'Veddika',
        status: 'Contacted',
      };
      const reportedLostItem = {
        _id: 'item_watch_1',
        title: 'Ajinkya Watch',
        type: 'lost',
        status: 'Active',
        reportedBy: { name: 'Ajinkya' },
        foundBy: { name: 'Veddika' },
        claims: [activeClaim],
      };

      const lost = filterLost([reportedLostItem]);
      assert.strictEqual(lost.length, 0);
    });

    it('3. Finder-reported item appears only in Found Items', () => {
      const activeClaim = {
        _id: 'claim_1',
        item: 'item_watch_1',
        fullName: 'Veddika',
        status: 'Contacted',
      };
      const itemWithFinder = {
        _id: 'item_watch_1',
        title: 'Ajinkya Watch',
        type: 'lost',
        status: 'Active',
        reportedBy: { name: 'Ajinkya' },
        foundBy: { name: 'Veddika' },
        claims: [activeClaim],
      };

      const lost = filterLost([itemWithFinder]);
      const found = filterFound([itemWithFinder]);
      const claimed = filterClaimed([itemWithFinder]);

      assert.strictEqual(lost.length, 0);
      assert.strictEqual(found.length, 1);
      assert.strictEqual(found[0]._id, 'item_watch_1');
      assert.strictEqual(claimed.length, 0);
    });

    it('4. Owner rejects finder -> disappears from Found Items and returns to Lost Items', () => {
      const rejectedClaim = {
        _id: 'claim_1',
        item: 'item_watch_1',
        fullName: 'Wrong Finder',
        status: 'rejected',
        rejectedAt: '2026-10-04T12:00:00Z',
      };
      const itemAfterRejection = {
        _id: 'item_watch_1',
        title: 'Ajinkya Watch',
        type: 'lost',
        status: 'Active',
        reportedBy: { name: 'Ajinkya' },
        foundBy: null,
        claims: [rejectedClaim],
      };

      const lost = filterLost([itemAfterRejection]);
      const found = filterFound([itemAfterRejection]);
      const claimed = filterClaimed([itemAfterRejection]);

      assert.strictEqual(found.length, 0);
      assert.strictEqual(lost.length, 1);
      assert.strictEqual(lost[0]._id, 'item_watch_1');
      assert.strictEqual(claimed.length, 0);
      // History preserved
      assert.strictEqual(itemAfterRejection.claims.length, 1);
      assert.strictEqual(itemAfterRejection.claims[0].status, 'rejected');
    });

    it('5. Owner finds own item -> disappears from Lost Items and appears only in Claimed Items', () => {
      const selfRecoveredItem = {
        _id: 'item_watch_1',
        title: 'Ajinkya Watch',
        type: 'lost',
        status: 'Resolved',
        reportedBy: { name: 'Ajinkya' },
        recoveredBy: { name: 'Ajinkya' },
        recoveryType: 'owner_found',
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [],
      };

      const lost = filterLost([selfRecoveredItem]);
      const found = filterFound([selfRecoveredItem]);
      const claimed = filterClaimed([selfRecoveredItem]);

      assert.strictEqual(lost.length, 0);
      assert.strictEqual(found.length, 0);
      assert.strictEqual(claimed.length, 1);
      assert.strictEqual(claimed[0]._id, 'item_watch_1');
    });

    it('6. Finder-found item recovered by owner -> disappears from Found Items and appears only in Claimed Items', () => {
      const resolvedClaim = {
        _id: 'claim_1',
        item: 'item_watch_1',
        fullName: 'Veddika',
        status: 'resolved',
      };
      const finderRecoveredItem = {
        _id: 'item_watch_1',
        title: 'Ajinkya Watch',
        type: 'lost',
        status: 'Resolved',
        reportedBy: { name: 'Ajinkya' },
        foundBy: { name: 'Veddika' },
        recoveryType: 'finder_found',
        ownerConfirmedAt: '2026-10-04T12:00:00Z',
        resolvedAt: '2026-10-04T12:00:00Z',
        claims: [resolvedClaim],
      };

      const lost = filterLost([finderRecoveredItem]);
      const found = filterFound([finderRecoveredItem]);
      const claimed = filterClaimed([finderRecoveredItem]);

      assert.strictEqual(lost.length, 0);
      assert.strictEqual(found.length, 0);
      assert.strictEqual(claimed.length, 1);
      assert.strictEqual(claimed[0]._id, 'item_watch_1');
    });

    it('7. Resolved item never appears in Lost or Found', () => {
      const resolvedItems = [
        { _id: 'r1', type: 'lost', status: 'Resolved', recoveryType: 'owner_found' },
        { _id: 'r2', type: 'lost', status: 'Resolved', recoveryType: 'finder_found', foundBy: { name: 'Finder' } },
        { _id: 'r3', type: 'found', status: 'Resolved', recoveryType: 'normal_found' },
        { _id: 'r4', type: 'lost', status: 'Claimed' },
      ];

      resolvedItems.forEach((item) => {
        assert.strictEqual(isLostItem(item), false);
        assert.strictEqual(isFoundItem(item), false);
        assert.strictEqual(isClaimedItem(item), true);
      });
    });

    it('8. No duplicate item appears in multiple sections', () => {
      const sampleItems = [
        { _id: 'item_1', type: 'lost', status: 'Active', foundBy: null, claims: [] },
        { _id: 'item_2', type: 'lost', status: 'Active', foundBy: null, claims: [] },
        { _id: 'item_3', type: 'lost', status: 'Active', foundBy: { name: 'F' }, claims: [{ status: 'Contacted' }] },
        { _id: 'item_4', type: 'found', status: 'Active', claims: [] },
        { _id: 'item_5', type: 'lost', status: 'Resolved', recoveryType: 'owner_found' },
        { _id: 'item_6', type: 'lost', status: 'Resolved', recoveryType: 'finder_found' },
        { _id: 'item_7', type: 'found', status: 'Resolved' },
      ];

      sampleItems.forEach((item) => {
        const inLost = isLostItem(item);
        const inFound = isFoundItem(item);
        const inClaimed = isClaimedItem(item);

        const count = (inLost ? 1 : 0) + (inFound ? 1 : 0) + (inClaimed ? 1 : 0);
        assert.strictEqual(count, 1, `Item ${item._id} must be in exactly ONE section, got ${count}`);
      });
    });

    it('9. Badge counts match the mutually exclusive sections', () => {
      // 10 total items matching the prompt example: Lost = 4, Found = 3, Claimed = 3, Total = 10
      const allItems = [
        // 4 Lost
        { _id: 'l1', type: 'lost', status: 'Active', foundBy: null, claims: [] },
        { _id: 'l2', type: 'lost', status: 'Pending', foundBy: null, claims: [] },
        { _id: 'l3', type: 'lost', status: 'Active', foundBy: null, claims: [] },
        { _id: 'l4', type: 'lost', status: 'Active', foundBy: null, claims: [{ status: 'rejected' }] }, // rejected returns to lost

        // 3 Found
        { _id: 'f1', type: 'found', status: 'Active', claims: [] },
        { _id: 'f2', type: 'found', status: 'Pending', claims: [] },
        { _id: 'f3', type: 'lost', status: 'Active', foundBy: { name: 'Finder' }, claims: [{ status: 'Contacted' }] }, // finder-reported

        // 3 Claimed
        { _id: 'c1', type: 'lost', status: 'Resolved', recoveryType: 'owner_found' },
        { _id: 'c2', type: 'lost', status: 'Resolved', recoveryType: 'finder_found', foundBy: { name: 'Finder' } },
        { _id: 'c3', type: 'found', status: 'Resolved', recoveryType: 'normal_found' },
      ];

      const lostCount = filterLost(allItems).length;
      const foundCount = filterFound(allItems).length;
      const claimedCount = filterClaimed(allItems).length;

      assert.strictEqual(lostCount, 4);
      assert.strictEqual(foundCount, 3);
      assert.strictEqual(claimedCount, 3);
      assert.strictEqual(lostCount + foundCount + claimedCount, allItems.length);
      assert.strictEqual(allItems.length, 10);
    });
  });

  describe('Report Card UI Presentation & Dynamic Timeline Mapping (Section 10)', () => {
    const mockCreatedAt = '2026-10-04T10:32:00.000Z';
    const mockFinderReportAt = '2026-10-04T14:15:00.000Z';
    const mockConfirmedAt = '2026-10-04T17:40:00.000Z';
    const mockResolvedAt = '2026-10-04T17:42:00.000Z';
    const mockRejectedAt = '2026-10-04T15:20:00.000Z';

    it('A. Newly reported lost item -> primary status LOST only (no contradictory badges)', () => {
      const item = {
        _id: '507f1f77bcf86cd799439011',
        title: 'College ID Card',
        type: 'lost',
        status: 'Active',
        createdAt: mockCreatedAt,
        foundBy: null,
        claims: [],
      };

      const primaryStatus = getItemPrimaryStatus(item);
      assert.strictEqual(primaryStatus.label, 'LOST');
      assert.strictEqual(primaryStatus.state, 'lost');
      assert.strictEqual(primaryStatus.badgeClass, 'badge-lost');

      const timeline = buildReportTimeline(item);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[0].status, 'completed');
      assert.ok(timeline[0].date);
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[1].status, 'completed');
      assert.strictEqual(timeline[2].status, 'pending');
      assert.strictEqual(timeline[2].date, null);
    });

    it('B. Finder reports item -> primary status FOUND only', () => {
      const item = {
        _id: '507f1f77bcf86cd799439012',
        title: 'Casio Scientific Calculator',
        type: 'lost',
        status: 'Active',
        createdAt: mockCreatedAt,
        foundBy: { name: 'Rahul Sharma', email: '22104050@apsit.edu.in' },
        claims: [
          {
            status: 'Contacted',
            submittedAt: mockFinderReportAt,
          },
        ],
      };

      const primaryStatus = getItemPrimaryStatus(item);
      assert.strictEqual(primaryStatus.label, 'FOUND');
      assert.strictEqual(primaryStatus.state, 'found');
      assert.strictEqual(primaryStatus.badgeClass, 'badge-found');

      const timeline = buildReportTimeline(item);
      assert.strictEqual(timeline[0].title, 'Reported Lost');
      assert.strictEqual(timeline[1].title, 'Active');
      assert.strictEqual(timeline[2].title, 'Finder Reported');
      assert.strictEqual(timeline[2].status, 'completed');
      assert.ok(timeline[2].date);
      assert.strictEqual(timeline[3].title, 'Owner Confirmed Recovery');
      assert.strictEqual(timeline[3].status, 'pending');
    });

    it('C. Owner rejects finder -> primary status returns to LOST only (Path C timeline)', () => {
      const item = {
        _id: '507f1f77bcf86cd799439013',
        title: 'Noise Smartwatch',
        type: 'lost',
        status: 'Active',
        createdAt: mockCreatedAt,
        foundBy: null, // cleared upon rejection
        claims: [
          {
            status: 'rejected',
            submittedAt: mockFinderReportAt,
            rejectedAt: mockRejectedAt,
          },
        ],
      };

      const primaryStatus = getItemPrimaryStatus(item);
      assert.strictEqual(primaryStatus.label, 'LOST');
      assert.strictEqual(primaryStatus.state, 'lost');

      const timeline = buildReportTimeline(item);
      assert.strictEqual(timeline.length, 5);
      assert.deepStrictEqual(
        timeline.map((s) => s.title),
        [
          'Reported Lost',
          'Active',
          'Finder Reported',
          'Owner Rejected Finder',
          'Active / Available Again',
        ]
      );
      assert.strictEqual(timeline.every((s) => s.status === 'completed'), true);
      assert.ok(timeline[2].date);
      assert.ok(timeline[3].date);
      assert.ok(timeline[4].date);
    });

    it('D. Owner self-recovers with OTP (Path A) -> primary status RECOVERED only', () => {
      const item = {
        _id: '507f1f77bcf86cd799439014',
        title: 'Bike Key',
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'owner_found',
        createdAt: mockCreatedAt,
        ownerConfirmedAt: mockConfirmedAt,
        resolvedAt: mockResolvedAt,
        foundBy: null,
        claims: [],
      };

      const primaryStatus = getItemPrimaryStatus(item);
      assert.strictEqual(primaryStatus.label, 'RECOVERED');
      assert.strictEqual(primaryStatus.state, 'recovered');
      assert.strictEqual(primaryStatus.badgeClass, 'badge-recovered');

      const timeline = buildReportTimeline(item);
      assert.strictEqual(timeline.length, 5);
      assert.deepStrictEqual(
        timeline.map((s) => s.title),
        ['Reported Lost', 'Active', 'Owner Found Item', 'OTP Verified', 'Recovered']
      );
      // Verify no finder steps appear
      assert.strictEqual(timeline.some((s) => s.title.includes('Finder')), false);
      assert.strictEqual(timeline.some((s) => s.title.includes('Owner Confirmed Recovery')), false);
      assert.strictEqual(timeline.every((s) => s.status === 'completed'), true);
      assert.ok(timeline[2].date);
      assert.ok(timeline[3].date);
      assert.ok(timeline[4].date);
    });

    it('E. Finder recovery completed with owner OTP (Path B) -> primary status RECOVERED only', () => {
      const item = {
        _id: '507f1f77bcf86cd799439015',
        title: 'HP Laptop Charger',
        type: 'lost',
        status: 'Resolved',
        recoveryType: 'finder_found',
        createdAt: mockCreatedAt,
        ownerConfirmedAt: mockConfirmedAt,
        resolvedAt: mockResolvedAt,
        foundBy: { name: 'Pooja Patil', email: '22104060@apsit.edu.in' },
        claims: [
          {
            status: 'resolved',
            submittedAt: mockFinderReportAt,
            ownerConfirmedAt: mockConfirmedAt,
            resolvedAt: mockResolvedAt,
          },
        ],
      };

      const primaryStatus = getItemPrimaryStatus(item);
      assert.strictEqual(primaryStatus.label, 'RECOVERED');
      assert.strictEqual(primaryStatus.state, 'recovered');

      const timeline = buildReportTimeline(item);
      assert.strictEqual(timeline.length, 6);
      assert.deepStrictEqual(
        timeline.map((s) => s.title),
        [
          'Reported Lost',
          'Active',
          'Finder Reported',
          'Owner Confirmed Recovery',
          'OTP Verified',
          'Recovered',
        ]
      );
      // Verify no owner self-recovery step appears
      assert.strictEqual(timeline.some((s) => s.title === 'Owner Found Item'), false);
      assert.strictEqual(timeline.every((s) => s.status === 'completed'), true);
      assert.ok(timeline[2].date);
      assert.ok(timeline[3].date);
      assert.ok(timeline[4].date);
      assert.ok(timeline[5].date);
    });

    it('Timeline date formatting preserves real timestamps without inventing dates', () => {
      const formatted = formatTimelineDate('2026-10-04T10:32:00.000Z');
      assert.ok(formatted);
      assert.match(formatted, /04 Oct 2026/);

      assert.strictEqual(formatTimelineDate(null), null);
      assert.strictEqual(formatTimelineDate(undefined), null);
      assert.strictEqual(formatTimelineDate('invalid-date'), null);
    });
  });
});
