const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createTestServer } = require('./helpers/testServer');
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const Otp = require('../models/Otp');
const emailUtils = require('../utils/email');

describe('Lost Item -> Finder -> Owner Contact -> Resolution Workflow', () => {
  const testServer = createTestServer();
  let baseUrl;

  // Stored originals for cleanup
  let originalUserFindById;
  let originalItemFindById;
  let originalItemFind;
  let originalItemFindByIdAndUpdate;
  let originalClaimFind;
  let originalClaimFindById;
  let originalClaimFindOne;
  let originalClaimCreate;
  let originalClaimFindByIdAndDelete;
  let originalClaimCountDocuments;
  let originalOtpFindOne;
  let originalOtpCreate;
  let originalOtpDeleteMany;
  let originalSendEmail;
  let originalSendOtpEmail;
  let originalSendFinderRejectionNotificationEmail;
  let originalSendOwnerResolutionEmail;
  let originalSendFinderResolutionEmail;
  let originalSendOwnerSelfRecoveryEmail;
  let originalClaimFindByIdAndUpdate;

  // Test Entities
  const ownerUser = {
    _id: '64a1f1000000000000000001',
    name: 'Rahul Sharma',
    email: '24107001@apsit.edu.in',
    studentId: '24107001',
    phone: '9876543210',
    department: 'Computer Engineering',
    role: 'user',
    status: 'approved',
  };

  const finderUser = {
    _id: '64a1f1000000000000000002',
    name: 'Priya Patel',
    email: '24107002@apsit.edu.in',
    studentId: '24107002',
    phone: '9123456780',
    department: 'Information Technology',
    role: 'user',
    status: 'approved',
  };

  const otherUser = {
    _id: '64a1f1000000000000000003',
    name: 'Sameer Khan',
    email: '24107003@apsit.edu.in',
    studentId: '24107003',
    phone: '9822334455',
    department: 'Civil Engineering',
    role: 'user',
    status: 'approved',
  };

  const adminUser = {
    _id: '64a1f1000000000000000099',
    name: 'College Admin',
    email: 'admin@apsit.edu.in',
    role: 'admin',
    status: 'approved',
  };

  const testSecret = 'test_workflow_jwt_secret_998877';
  process.env.JWT_SECRET = testSecret;

  const ownerToken = jwt.sign({ id: ownerUser._id }, testSecret);
  const finderToken = jwt.sign({ id: finderUser._id }, testSecret);
  const otherToken = jwt.sign({ id: otherUser._id }, testSecret);
  const adminToken = jwt.sign({ id: adminUser._id }, testSecret);

  let inMemoryItem;
  let inMemoryClaims = [];
  let inMemoryOtps = [];
  let sentEmails = [];
  let sentOtpEmails = [];
  let sentRejectionEmails = [];
  let sentOwnerSelfRecoveryEmails = [];
  let emailShouldFail = false;

  const makeValidFinderBody = (overrides = {}) => ({
    itemId: inMemoryItem._id,
    fullName: finderUser.name,
    email: finderUser.email,
    phone: finderUser.phone,
    image: 'https://res.cloudinary.com/apsit/image/upload/v12345/calculator_proof.jpg',
    finderMessage: 'I found your Casio calculator in Room 402 on table 3.',
    additionalDetails: 'I found your Casio calculator in Room 402 on table 3.',
    otp: '123456',
    ...overrides,
  });

  before(async () => {
    originalUserFindById = User.findById;
    originalItemFindById = Item.findById;
    originalItemFind = Item.find;
    originalItemFindByIdAndUpdate = Item.findByIdAndUpdate;
    originalClaimFind = Claim.find;
    originalClaimFindById = Claim.findById;
    originalClaimFindOne = Claim.findOne;
    originalClaimCreate = Claim.create;
    originalClaimFindByIdAndDelete = Claim.findByIdAndDelete;
    originalClaimCountDocuments = Claim.countDocuments;
    originalOtpFindOne = Otp.findOne;
    originalOtpCreate = Otp.create;
    originalOtpDeleteMany = Otp.deleteMany;
    originalSendEmail = emailUtils.sendItemFoundNotificationEmail;
    originalSendOtpEmail = emailUtils.sendOtpEmail;
    originalSendFinderRejectionNotificationEmail = emailUtils.sendFinderRejectionNotificationEmail;
    originalSendOwnerResolutionEmail = emailUtils.sendOwnerResolutionEmail;
    originalSendFinderResolutionEmail = emailUtils.sendFinderResolutionEmail;
    originalSendOwnerSelfRecoveryEmail = emailUtils.sendOwnerSelfRecoveryEmail;
    originalClaimFindByIdAndUpdate = Claim.findByIdAndUpdate;

    const getUser = (id) => {
      const idStr = String(id);
      if (idStr === String(ownerUser._id)) return ownerUser;
      if (idStr === String(finderUser._id)) return finderUser;
      if (idStr === String(otherUser._id)) return otherUser;
      if (idStr === String(adminUser._id)) return adminUser;
      return null;
    };

    // User.findById stub for protect middleware & optional auth
    User.findById = (id) => ({
      select: () => Promise.resolve(getUser(id)),
      then: (resolve) => resolve(getUser(id)),
    });

    // Mock sendItemFoundNotificationEmail
    emailUtils.sendItemFoundNotificationEmail = async (params) => {
      if (emailShouldFail) {
        return { success: false, error: 'SMTP connection failed' };
      }
      sentEmails.push(params);
      return { success: true, messageId: '<test-found-notification-id>' };
    };

    // Mock sendFinderRejectionNotificationEmail
    emailUtils.sendFinderRejectionNotificationEmail = async (params) => {
      sentRejectionEmails.push(params);
      return { success: true, messageId: '<test-rejection-id>' };
    };

    // Mock sendOtpEmail
    emailUtils.sendOtpEmail = async (email, name, otp, type) => {
      sentOtpEmails.push({ email, name, otp, type });
      return { success: true, messageId: '<test-otp-id>' };
    };

    // Mock sendOwnerResolutionEmail
    emailUtils.sendOwnerResolutionEmail = async (params) => {
      if (emailShouldFail) {
        return { success: false, error: 'SMTP connection failed' };
      }
      sentOwnerResolutionEmails.push(params);
      return { success: true, messageId: '<test-owner-resolution-id>' };
    };

    // Mock sendFinderResolutionEmail
    emailUtils.sendFinderResolutionEmail = async (params) => {
      if (emailShouldFail) {
        return { success: false, error: 'SMTP connection failed' };
      }
      sentFinderResolutionEmails.push(params);
      return { success: true, messageId: '<test-finder-resolution-id>' };
    };

    // Mock sendOwnerSelfRecoveryEmail
    emailUtils.sendOwnerSelfRecoveryEmail = async (params) => {
      if (emailShouldFail) {
        return { success: false, error: 'SMTP connection failed' };
      }
      sentOwnerSelfRecoveryEmails.push(params);
      return { success: true, messageId: '<test-owner-self-recovery-id>' };
    };

    // Mock Otp methods
    Otp.create = async (doc) => {
      const record = { ...doc, _id: `otp_${Date.now()}` };
      inMemoryOtps.push(record);
      return record;
    };

    Otp.findOne = (query) => {
      const getMatch = () => {
        return inMemoryOtps.find((o) => {
          if (query.email && o.email !== query.email) return false;
          if (query.otp && o.otp !== query.otp) return false;
          if (query.expiresAt && query.expiresAt.$gt) {
            if (new Date(o.expiresAt) <= new Date(query.expiresAt.$gt)) return false;
          }
          if (query.expiresAt && query.expiresAt.$lte) {
            if (new Date(o.expiresAt) > new Date(query.expiresAt.$lte)) return false;
          }
          return true;
        }) || null;
      };
      return Promise.resolve(getMatch());
    };

    Otp.deleteMany = async (query) => {
      inMemoryOtps = inMemoryOtps.filter((o) => {
        if (query.email && o.email === query.email) {
          if (!query.otp || o.otp === query.otp) return false;
        }
        return true;
      });
      return { acknowledged: true, deletedCount: 1 };
    };

    baseUrl = await testServer.start();
  });

  after(async () => {
    User.findById = originalUserFindById;
    Item.findById = originalItemFindById;
    Item.find = originalItemFind;
    Item.findByIdAndUpdate = originalItemFindByIdAndUpdate;
    Claim.find = originalClaimFind;
    Claim.findById = originalClaimFindById;
    Claim.findOne = originalClaimFindOne;
    Claim.create = originalClaimCreate;
    Claim.findByIdAndDelete = originalClaimFindByIdAndDelete;
    Claim.countDocuments = originalClaimCountDocuments;
    Claim.findByIdAndUpdate = originalClaimFindByIdAndUpdate;
    Otp.findOne = originalOtpFindOne;
    Otp.create = originalOtpCreate;
    Otp.deleteMany = originalOtpDeleteMany;
    emailUtils.sendItemFoundNotificationEmail = originalSendEmail;
    emailUtils.sendOtpEmail = originalSendOtpEmail;
    emailUtils.sendFinderRejectionNotificationEmail = originalSendFinderRejectionNotificationEmail;
    emailUtils.sendOwnerResolutionEmail = originalSendOwnerResolutionEmail;
    emailUtils.sendFinderResolutionEmail = originalSendFinderResolutionEmail;
    emailUtils.sendOwnerSelfRecoveryEmail = originalSendOwnerSelfRecoveryEmail;
    await testServer.stop();
  });

  beforeEach(() => {
    sentEmails = [];
    sentOtpEmails = [];
    sentRejectionEmails = [];
    sentOwnerResolutionEmails = [];
    sentFinderResolutionEmails = [];
    sentOwnerSelfRecoveryEmails = [];
    emailShouldFail = false;
    inMemoryClaims = [];

    // Pre-populate active 6-digit OTP for finder and otherUser
    inMemoryOtps = [
      {
        email: finderUser.email,
        otp: '123456',
        purpose: 'report_found_item',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      },
      {
        email: otherUser.email,
        otp: '234567',
        purpose: 'report_found_item',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    ];

    inMemoryItem = {
      _id: '64b2f2000000000000000010',
      title: 'Scientific Calculator fx-991EX',
      category: 'Electronics',
      description: 'Black Casio calculator left in Room 402',
      location: 'Lab 402',
      type: 'lost',
      status: 'Active',
      reportedBy: { ...ownerUser },
      foundBy: null,
      claimedBy: null,
      recoveryType: null,
      recoveredBy: null,
      ownerConfirmedAt: null,
      ownerConfirmedBy: null,
      resolvedAt: null,
      save: async function () {
        return this;
      },
      toObject: function () {
        return { ...this };
      },
    };

    Item.findById = (id) => {
      const isMatch = String(id) === String(inMemoryItem._id);
      const target = isMatch ? inMemoryItem : null;
      return {
        populate: () => {
          const clone = target ? { ...target } : null;
          if (clone && clone.foundBy) {
            if (String(clone.foundBy) === String(finderUser._id)) {
              clone.foundBy = { ...finderUser };
            } else if (String(clone.foundBy) === String(otherUser._id)) {
              clone.foundBy = { ...otherUser };
            }
          } else if (clone) {
            clone.foundBy = null;
          }
          if (clone && clone.reportedBy && clone.reportedBy._id) {
            clone.reportedBy = { ...clone.reportedBy };
          }
          return Promise.resolve(clone);
        },
        then: (resolve) => resolve(target),
      };
    };

    Item.findByIdAndUpdate = async (id, update) => {
      if (String(id) === String(inMemoryItem._id)) {
        Object.assign(inMemoryItem, update);
        return inMemoryItem;
      }
      return null;
    };

    Claim.create = async (doc) => {
      const claim = {
        _id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...doc,
        save: async function () {
          return this;
        },
      };
      inMemoryClaims.push(claim);
      return claim;
    };

    Claim.findOne = (query) => {
      const getMatch = () => {
        let matches = inMemoryClaims.filter((c) => {
          if (query.item && String(c.item) !== String(query.item)) return false;
          if (query.finder && String(c.finder) !== String(query.finder)) return false;
          if (query.status && query.status.$in) {
            if (!query.status.$in.includes(c.status)) return false;
          }
          if (query.status && typeof query.status === 'string') {
            if (c.status !== query.status) return false;
          }
          return true;
        });
        return matches[0] || null;
      };

      const chain = {
        sort: () => Promise.resolve(getMatch()),
        then: (resolve) => resolve(getMatch()),
      };
      return chain;
    };

    Claim.findById = (id) => {
      const found = inMemoryClaims.find((c) => String(c._id) === String(id));
      const chain = {
        populate: () => chain,
        then: (resolve) => resolve(found || null),
      };
      return chain;
    };

    Claim.findByIdAndDelete = async (id) => {
      const idx = inMemoryClaims.findIndex((c) => String(c._id) === String(id));
      if (idx !== -1) inMemoryClaims.splice(idx, 1);
      return true;
    };

    Claim.find = (query) => {
      const getClaimsList = () => {
        return inMemoryClaims.map((c) => ({
          ...c,
          finder: c.finder && String(c.finder) === String(finderUser._id) ? { ...finderUser } : c.finder,
          owner: c.owner && String(c.owner) === String(ownerUser._id) ? { ...ownerUser } : c.owner,
        }));
      };
      const chain = {
        populate: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => Promise.resolve(getClaimsList()),
        then: (resolve) => resolve(getClaimsList()),
      };
      return chain;
    };

    Claim.countDocuments = async () => inMemoryClaims.length;
  });

  // 1. Owner cannot claim own lost item
  it('1. should prevent owner from claiming their own lost item (self-claim prevention)', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({
        fullName: ownerUser.name,
        email: ownerUser.email,
        phone: ownerUser.phone,
        finderMessage: 'This is my own calculator',
        additionalDetails: 'This is my own calculator',
      })),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /cannot claim or report/i);
    assert.strictEqual(inMemoryClaims.length, 0);
  });

  // 2. Non-owner sees valid claim action and can submit with correct OTP
  it('2. should allow a non-owner student to submit a found-item claim with message and valid OTP', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data._id);
    assert.strictEqual(data.status, 'Contacted');
    assert.strictEqual(data.finderMessage, 'I found your Casio calculator in Room 402 on table 3.');
  });

  // 3. Successful finder claim links foundBy and does NOT mark item as Resolved
  it('3. successful finder claim causes Found By to link to item while remaining Active', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    assert.strictEqual(res.status, 201);
    // Item foundBy must be linked to finder
    assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));
    // Item must NOT become Resolved at this stage
    assert.strictEqual(inMemoryItem.status, 'Active');
    assert.strictEqual(inMemoryItem.resolvedAt, null);
  });

  // 4. Other users cannot submit another active claim once an active claim exists
  it('4. should prevent other users from submitting an active claim once one already exists', async () => {
    // First finder submits valid claim
    const firstRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });
    assert.strictEqual(firstRes.status, 201);

    // Another user (otherUser) attempts to submit a claim for the same item
    const secondRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({
        fullName: otherUser.name,
        email: otherUser.email,
        phone: otherUser.phone,
        otp: '234567',
        finderMessage: 'I also found it',
      })),
    });

    assert.strictEqual(secondRes.status, 400);
    const data = await secondRes.json();
    assert.match(data.message, /already been submitted for this item/i);
    assert.strictEqual(inMemoryClaims.length, 1);
  });

  // 5. Public users do not receive finder phone/email unnecessarily (Privacy)
  it('5. public users do not receive finder phone/email or proof photo in item details (Privacy preservation)', async () => {
    // Finder reports finding the item
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    // Unauthenticated public request for item details
    const publicRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`);
    assert.strictEqual(publicRes.status, 200);
    const publicData = await publicRes.json();

    // Finder name is visible
    assert.strictEqual(publicData.foundBy?.name, finderUser.name);
    // Sensitive finder phone, email, and proof photo are stripped for public viewers
    assert.strictEqual(publicData.foundBy?.phone, undefined);
    assert.strictEqual(publicData.foundBy?.email, undefined);
    if (publicData.claims && publicData.claims.length > 0) {
      assert.strictEqual(publicData.claims[0].phone, undefined);
      assert.strictEqual(publicData.claims[0].email, undefined);
      assert.strictEqual(publicData.claims[0].image, undefined);
    }

    // Authenticated request by unrelated student (not owner, not finder, not admin)
    const otherRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.strictEqual(otherRes.status, 200);
    const otherData = await otherRes.json();
    if (otherData.claims && otherData.claims.length > 0) {
      assert.strictEqual(otherData.claims[0].phone, undefined);
      assert.strictEqual(otherData.claims[0].email, undefined);
      assert.strictEqual(otherData.claims[0].image, undefined);
    }
  });

  // 6. Owner sees complete finder contact info and can complete recovery
  it('6. owner sees complete finder contact information, proof photo, and recovery action', async () => {
    // Finder reports finding the item
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    // Owner requests item details
    const ownerRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    assert.strictEqual(ownerRes.status, 200);
    const ownerData = await ownerRes.json();

    // Owner CAN see finder phone and email to coordinate return
    assert.strictEqual(ownerData.foundBy?.name, finderUser.name);
    assert.strictEqual(ownerData.foundBy?.phone, finderUser.phone);
    assert.strictEqual(ownerData.foundBy?.email, finderUser.email);
    assert.strictEqual(ownerData.claims[0].phone, finderUser.phone);
    assert.strictEqual(ownerData.claims[0].email, finderUser.email);
    assert.strictEqual(ownerData.claims[0].image, 'https://res.cloudinary.com/apsit/image/upload/v12345/calculator_proof.jpg');
  });

  // 7. Owner recovery with OTP directly resolves item and claim without admin approval
  it('7. owner recovery directly resolves item and claim without admin approval', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    // Owner requests recovery OTP
    const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(otpRes.status, 200);

    const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];
    assert.ok(latestOtp);
    assert.strictEqual(latestOtp.email, ownerUser.email);

    // Owner submits recovery with valid OTP
    const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ otp: latestOtp.otp }),
    });

    assert.strictEqual(recoverRes.status, 200);
    const recoverData = await recoverRes.json();
    assert.strictEqual(recoverData.status, 'Resolved');
    assert.strictEqual(inMemoryClaims[0].status, 'resolved');
    assert.ok(inMemoryClaims[0].ownerConfirmedAt);
    assert.strictEqual(String(inMemoryClaims[0].ownerConfirmedBy), String(ownerUser._id));
    assert.strictEqual(inMemoryItem.status, 'Resolved');
    assert.ok(inMemoryItem.resolvedAt);
    assert.ok(inMemoryItem.ownerConfirmedAt);
    assert.strictEqual(String(inMemoryItem.ownerConfirmedBy), String(ownerUser._id));
    assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));

    // Resolution emails sent to owner and finder directly
    assert.ok(sentOwnerResolutionEmails.some((e) => e.ownerEmail === ownerUser.email));
    assert.ok(sentFinderResolutionEmails.some((e) => e.finderEmail === finderUser.email));
  });

  // 8. Admin still sees complete finder information
  it('8. admin still sees complete finder information across claims and item details', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    const adminItemRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(adminItemRes.status, 200);
    const adminItemData = await adminItemRes.json();
    assert.strictEqual(adminItemData.foundBy?.name, finderUser.name);
    assert.strictEqual(adminItemData.foundBy?.phone, finderUser.phone);
    assert.strictEqual(adminItemData.foundBy?.email, finderUser.email);

    const adminClaimsRes = await fetch(`${baseUrl}/api/claims`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(adminClaimsRes.status, 200);
    const adminClaimsData = await adminClaimsRes.json();
    assert.strictEqual(adminClaimsData.claims[0].fullName, finderUser.name);
    assert.strictEqual(adminClaimsData.claims[0].phone, finderUser.phone);
    assert.strictEqual(adminClaimsData.claims[0].email, finderUser.email);
  });

  // 9. All required finder fields are enforced
  it('9. should enforce all required finder fields (fullName, email, phone, image, message)', async () => {
    // Missing Full Name
    const res1 = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finderToken}` },
      body: JSON.stringify(makeValidFinderBody({ fullName: '' })),
    });
    assert.strictEqual(res1.status, 400);
    const data1 = await res1.json();
    assert.match(data1.message, /Full name is required/i);

    // Missing Email
    const res2 = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finderToken}` },
      body: JSON.stringify(makeValidFinderBody({ email: '' })),
    });
    assert.strictEqual(res2.status, 400);
    const data2 = await res2.json();
    assert.match(data2.message, /College email address is required/i);

    // Missing Phone
    const res3 = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finderToken}` },
      body: JSON.stringify(makeValidFinderBody({ phone: '' })),
    });
    assert.strictEqual(res3.status, 400);
    const data3 = await res3.json();
    assert.match(data3.message, /Phone number is required/i);

    // Invalid Phone format
    const resPhone = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finderToken}` },
      body: JSON.stringify(makeValidFinderBody({ phone: '12345' })),
    });
    assert.strictEqual(resPhone.status, 400);
    const dataPhone = await resPhone.json();
    assert.match(dataPhone.message, /valid 10-digit Indian mobile number/i);

    // Missing Proof Image
    const res4 = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finderToken}` },
      body: JSON.stringify(makeValidFinderBody({ image: '' })),
    });
    assert.strictEqual(res4.status, 400);
    const data4 = await res4.json();
    assert.match(data4.message, /Found item image \/ proof photo is required/i);

    // Missing Additional Details / Message
    const res5 = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${finderToken}` },
      body: JSON.stringify(makeValidFinderBody({ finderMessage: '', additionalDetails: '' })),
    });
    assert.strictEqual(res5.status, 400);
    const data5 = await res5.json();
    assert.match(data5.message, /Additional details describing where\/how you found the item are required/i);
  });

  // 10. Invalid @apsit.edu.in email rejected
  it('10. should reject email that does not end with @apsit.edu.in', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({ email: 'priya@gmail.com' })),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /ending with @apsit.edu.in is required/i);
  });


  // 11. OTP is sent to finder email via /api/items/send-report-otp
  it('11. should dispatch a 6-digit OTP to the finder college email', async () => {
    const res = await fetch(`${baseUrl}/api/items/send-report-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        email: finderUser.email,
        name: finderUser.name,
        type: 'found',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.match(data.message, /We've sent a 6-digit OTP/i);
    assert.strictEqual(sentOtpEmails.length, 1);
    assert.strictEqual(sentOtpEmails[0].email, finderUser.email);
    assert.strictEqual(sentOtpEmails[0].type, 'found');
    assert.strictEqual(sentOtpEmails[0].otp.length, 6);
  });

  // 12. Correct OTP allows claim creation
  it('12. should allow claim creation when correct 6-digit OTP is supplied', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({ otp: '123456' })),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.status, 'Contacted');
    assert.strictEqual(inMemoryClaims.length, 1);
  });

  // 13. Incorrect OTP prevents claim creation
  it('13. should reject claim creation when incorrect OTP is supplied', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({ otp: '999999' })),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /Invalid OTP code/i);
    assert.strictEqual(inMemoryClaims.length, 0);
  });

  // 14. Expired OTP prevents claim creation
  it('14. should reject claim creation when OTP is expired', async () => {
    inMemoryOtps = [
      {
        email: finderUser.email,
        otp: '888888',
        purpose: 'report_found_item',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes in the past
      },
    ];

    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({ otp: '888888' })),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /OTP has expired/i);
    assert.strictEqual(inMemoryClaims.length, 0);
  });

  // 15. Duplicate active claim by same user prevention
  it('15. should prevent duplicate active claims by the same finder for the same item', async () => {
    const firstRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });
    assert.strictEqual(firstRes.status, 201);

    inMemoryOtps.push({
      email: finderUser.email,
      otp: '654321',
      purpose: 'report_found_item',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const secondRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({ otp: '654321', finderMessage: 'Another message' })),
    });

    assert.strictEqual(secondRes.status, 400);
    const data = await secondRes.json();
    assert.match(data.message, /already submitted an active claim/i);
    assert.strictEqual(inMemoryClaims.length, 1);
  });

  // 16. Successful claim emails owner
  it('16. should dispatch an email to the lost-item owner with finder details, message, and proof photo', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    assert.strictEqual(sentEmails.length, 1);
    const email = sentEmails[0];
    assert.strictEqual(email.ownerEmail, ownerUser.email);
    assert.strictEqual(email.ownerName, ownerUser.name);
    assert.strictEqual(email.itemName, inMemoryItem.title);
    assert.strictEqual(email.finderName, finderUser.name);
    assert.strictEqual(email.finderEmail, finderUser.email);
    assert.strictEqual(email.finderPhone, finderUser.phone);
    assert.strictEqual(email.finderMessage, 'I found your Casio calculator in Room 402 on table 3.');
    assert.strictEqual(email.proofImage, 'https://res.cloudinary.com/apsit/image/upload/v12345/calculator_proof.jpg');
  });

  // 17. Email failure handling and atomic rollback
  it('17. should roll back claim record and return 500 when owner notification email fails', async () => {
    emailShouldFail = true;

    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.match(data.message, /Failed to notify the item owner via email/i);
    // Verified that no broken/orphaned claim record remains in database
    assert.strictEqual(inMemoryClaims.length, 0);
    // foundBy was also rolled back
    assert.strictEqual(inMemoryItem.foundBy, null);
  });

  // 18. Existing claim proof image behavior still works
  it('18. should allow proof image URL on claim and preserve existing fields', async () => {
    const claimWithImage = new Claim({
      fullName: 'Vikram Singh',
      email: '24107005@apsit.edu.in',
      phone: '9988776655',
      image: 'https://res.cloudinary.com/apsit/image/upload/v12345/proof.jpg',
      additionalDetails: 'Has my name engraved on back',
      finderMessage: 'Photo taken before handing over',
      status: 'pending',
    });

    const validationError = claimWithImage.validateSync();
    assert.strictEqual(validationError, undefined);
    assert.strictEqual(claimWithImage.image, 'https://res.cloudinary.com/apsit/image/upload/v12345/proof.jpg');
    assert.strictEqual(claimWithImage.finderMessage, 'Photo taken before handing over');
  });

  // 19. Non-owner cannot reject the claim
  it('19. should reject claim rejection by non-owner with 403', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /Only the item owner or an admin/i);
    assert.strictEqual(inMemoryClaims[0].status, 'Contacted');
  });

  // 20. Owner rejection sets claim status to rejected, records rejectedAt, and clears item.foundBy
  it('20. owner rejection sets claim status to rejected, records rejectedAt, clears foundBy and keeps item Active', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));

    const rejectRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.strictEqual(rejectRes.status, 200);
    const rejectData = await rejectRes.json();
    assert.strictEqual(rejectData.success, true);

    // Claim marked rejected with rejectedAt timestamp
    assert.strictEqual(inMemoryClaims[0].status, 'rejected');
    assert.ok(inMemoryClaims[0].rejectedAt);
    assert.strictEqual(String(inMemoryClaims[0].rejectedBy), String(ownerUser._id));

    // Item foundBy cleared
    assert.strictEqual(inMemoryItem.foundBy, null);

    // Item remains in active lost state (NOT resolved)
    assert.strictEqual(inMemoryItem.status, 'Active');
    assert.strictEqual(inMemoryItem.resolvedAt, null);
  });

  // 21. Owner rejection notifies previous finder by email politely
  it('21. owner rejection notifies previous finder by email without exposing owner private info', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.strictEqual(sentRejectionEmails.length, 1);
    const rejEmail = sentRejectionEmails[0];
    assert.strictEqual(rejEmail.finderEmail, finderUser.email);
    assert.strictEqual(rejEmail.itemName, inMemoryItem.title);
  });

  // 22. Item becomes claimable again for another student after rejection
  it('22. should allow a new finder to submit a report after previous finder report was rejected', async () => {
    // 1. First finder submits claim
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    // 2. Owner rejects first finder's report
    await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    assert.strictEqual(inMemoryClaims[0].status, 'rejected');

    // 3. Second finder (otherUser) submits claim
    const newClaimRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({
        fullName: otherUser.name,
        email: otherUser.email,
        phone: otherUser.phone,
        otp: '234567',
        finderMessage: 'I found the calculator on the teacher desk in 402',
      })),
    });

    assert.strictEqual(newClaimRes.status, 201);
    const newClaimData = await newClaimRes.json();
    assert.strictEqual(newClaimData.status, 'Contacted');
    assert.strictEqual(String(inMemoryItem.foundBy), String(otherUser._id));
    assert.strictEqual(inMemoryClaims.length, 2);
  });

  // 23. Rejected finder can submit a new claim for the same item later, creating a new claim document
  it('23. should allow the same rejected finder to submit a new claim document for the same item later', async () => {
    // 1. Finder submits first claim
    const firstRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });
    assert.strictEqual(firstRes.status, 201);
    const firstClaimData = await firstRes.json();
    assert.strictEqual(inMemoryClaims.length, 1);
    assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));

    // 2. Owner rejects first claim ("This Is Not My Item")
    const rejectRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(inMemoryItem.foundBy, null);
    assert.strictEqual(inMemoryClaims[0].status, 'rejected');
    assert.ok(inMemoryClaims[0].rejectedAt);

    // 3. Same finder submits a NEW claim with new OTP and details
    inMemoryOtps.push({
      email: finderUser.email,
      otp: '777888',
      purpose: 'report_found_item',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const retryRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({
        otp: '777888',
        finderMessage: 'Double checked serial number, definitely your calculator!',
      })),
    });

    assert.strictEqual(retryRes.status, 201);
    const retryData = await retryRes.json();
    assert.ok(retryData._id);
    assert.notStrictEqual(retryData._id, firstClaimData._id);
    assert.strictEqual(retryData.status, 'Contacted');
    assert.strictEqual(retryData.finderMessage, 'Double checked serial number, definitely your calculator!');

    // 4. Verifications:
    // - New claim document was created
    assert.strictEqual(inMemoryClaims.length, 2);
    // - Previous claim remains in history with status 'rejected'
    assert.strictEqual(inMemoryClaims[0].status, 'rejected');
    assert.ok(inMemoryClaims[0].rejectedAt);
    // - New claim has status 'Contacted'
    assert.strictEqual(inMemoryClaims[1].status, 'Contacted');
    // - Item foundBy is updated to the finder again
    assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));

    // 5. Active claim still blocks duplicate claim
    inMemoryOtps.push({
      email: finderUser.email,
      otp: '999000',
      purpose: 'report_found_item',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const dupRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({ otp: '999000' })),
    });
    assert.strictEqual(dupRes.status, 400);
    const dupData = await dupRes.json();
    assert.match(dupData.message, /already submitted an active claim/i);
    assert.strictEqual(inMemoryClaims.length, 2);
  });

  // 24. Admin and Owner see complete history including rejected claims
  it('24. admin and owner can see complete history including rejected claims and attempts', async () => {
    // Finder 1 claims
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    // Owner rejects Finder 1
    await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    // Finder 2 claims
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({
        fullName: otherUser.name,
        email: otherUser.email,
        phone: otherUser.phone,
        otp: '234567',
        finderMessage: 'Found in Lab 402 on cabinet',
      })),
    });

    // Query item details as admin
    const adminRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert.strictEqual(adminRes.status, 200);
    const itemData = await adminRes.json();

    // Verify both attempts exist in history
    assert.strictEqual(itemData.claims.length, 2);
    const rejectedAttempt = itemData.claims.find((c) => c.status === 'rejected');
    const activeAttempt = itemData.claims.find((c) => c.status === 'Contacted');
    assert.ok(rejectedAttempt);
    assert.ok(activeAttempt);
    assert.strictEqual(rejectedAttempt.fullName, finderUser.name);
    assert.strictEqual(activeAttempt.fullName, otherUser.name);
  });

  // 25. Final owner recovery after rejection sets final claim to resolved and updates item to Resolved
  it('25. final owner recovery after prior rejection sets final claim to resolved and item status to Resolved', async () => {
    // Finder 1 claims
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    // Owner rejects Finder 1
    await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    // Finder 2 claims
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify(makeValidFinderBody({
        fullName: otherUser.name,
        email: otherUser.email,
        phone: otherUser.phone,
        otp: '234567',
      })),
    });

    // Owner requests recovery OTP
    const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(otpRes.status, 200);
    const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

    // Owner confirms recovery with valid OTP
    const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ otp: latestOtp.otp }),
    });

    assert.strictEqual(recoverRes.status, 200);
    assert.strictEqual((inMemoryItem.status || '').toLowerCase(), 'resolved');
    assert.ok(inMemoryItem.resolvedAt);

    const resolvedClaim = inMemoryClaims.find((c) => String(c.finder) === String(otherUser._id));
    assert.strictEqual(resolvedClaim.status, 'resolved');
    assert.ok(resolvedClaim.resolvedAt);

    // The rejected claim remained rejected in history
    const priorRejectedClaim = inMemoryClaims.find((c) => String(c.finder) === String(finderUser._id));
    assert.strictEqual(priorRejectedClaim.status, 'rejected');
  });

  // 26. Admin approval sends owner email and finder email with required resolution details
  it('26. admin approval resolves claim and item, and sends owner and finder resolution emails', async () => {
    // 1. Finder submits claim
    const claimRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });
    assert.strictEqual(claimRes.status, 201);
    const createdClaim = await claimRes.json();

    // 26. Admin approval sends owner email
    it('26. admin approval sends owner email', async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const createdClaim = await claimRes.json();

      const approveRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      assert.strictEqual(approveRes.status, 200);
      const approvedData = await approveRes.json();
      assert.strictEqual(approvedData.status, 'resolved');
      assert.strictEqual(inMemoryItem.status, 'Resolved');

      assert.strictEqual(sentOwnerResolutionEmails.length, 1);
      const ownerEmail = sentOwnerResolutionEmails[0];
      assert.strictEqual(ownerEmail.ownerEmail, ownerUser.email);
      assert.ok(inMemoryClaims[0].ownerResolutionEmailSentAt);
    });

    // 27. Admin approval sends finder email
    it('27. admin approval sends finder email', async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const createdClaim = await claimRes.json();

      const approveRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      assert.strictEqual(approveRes.status, 200);
      assert.strictEqual(sentFinderResolutionEmails.length, 1);
      const finderEmail = sentFinderResolutionEmails[0];
      assert.strictEqual(finderEmail.finderEmail, finderUser.email);
      assert.ok(inMemoryClaims[0].finderResolutionEmailSentAt);
    });

    // 28. Owner email contains item + finder + resolution information
    it('28. owner email contains item + finder + resolution information', async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const createdClaim = await claimRes.json();

      const approveRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.strictEqual(approveRes.status, 200);

      assert.strictEqual(sentOwnerResolutionEmails.length, 1);
      const ownerEmail = sentOwnerResolutionEmails[0];
      assert.strictEqual(ownerEmail.ownerName, ownerUser.name);
      assert.ok(ownerEmail.itemName.includes('Calculator'));
      assert.strictEqual(ownerEmail.finderName, finderUser.name);
      assert.ok(ownerEmail.resolutionDate);
    });

    // 29. Finder email contains item + resolution information
    it('29. finder email contains item + resolution information', async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const createdClaim = await claimRes.json();

      const approveRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.strictEqual(approveRes.status, 200);

      assert.strictEqual(sentFinderResolutionEmails.length, 1);
      const finderEmail = sentFinderResolutionEmails[0];
      assert.strictEqual(finderEmail.finderName, finderUser.name);
      assert.ok(finderEmail.itemName.includes('Calculator'));
      assert.ok(finderEmail.resolutionDate);
    });

    // 30. Repeated approval does not send duplicate emails
    it('30. repeated approval does not send duplicate emails', async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const createdClaim = await claimRes.json();

      const firstRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.strictEqual(firstRes.status, 200);
      assert.strictEqual(sentOwnerResolutionEmails.length, 1);
      assert.strictEqual(sentFinderResolutionEmails.length, 1);

      const retryRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.strictEqual(retryRes.status, 200);

      assert.strictEqual(sentOwnerResolutionEmails.length, 1);
      assert.strictEqual(sentFinderResolutionEmails.length, 1);
    });

    // 31. Email failure is handled safely
    it('31. email failure is handled safely', async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const createdClaim = await claimRes.json();

      emailShouldFail = true;

      const approveRes = await fetch(`${baseUrl}/api/claims/${createdClaim._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });

      assert.strictEqual(approveRes.status, 200);
      const data = await approveRes.json();

      assert.strictEqual(data.status, 'resolved');
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      assert.strictEqual(inMemoryClaims[0].status, 'resolved');
      assert.strictEqual(sentOwnerResolutionEmails.length, 0);
      assert.strictEqual(sentFinderResolutionEmails.length, 0);
    });
  });

  describe('FINDER OTP Verification Tests', () => {
    it('non-owner can request finder OTP', async () => {
      const res = await fetch(`${baseUrl}/api/items/send-report-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify({ email: finderUser.email, name: finderUser.name, type: 'found' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    it('OTP sent to finder', async () => {
      await fetch(`${baseUrl}/api/items/send-report-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify({ email: finderUser.email, name: finderUser.name, type: 'found' }),
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];
      assert.ok(latestOtp);
      assert.strictEqual(latestOtp.email, finderUser.email);
      assert.strictEqual(latestOtp.type, 'found');
      assert.strictEqual(latestOtp.otp.length, 6);
    });

    it('correct finder OTP creates claim', async () => {
      await fetch(`${baseUrl}/api/items/send-report-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify({ email: finderUser.email, name: finderUser.name, type: 'found' }),
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      const res = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody({ otp: latestOtp.otp })),
      });
      assert.strictEqual(res.status, 201);
      const claimData = await res.json();
      assert.strictEqual(claimData.status, 'Contacted');
      assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));
    });

    it('wrong OTP blocks claim', async () => {
      const res = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody({ otp: '000000' })),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /invalid otp/i);
    });

    it('expired OTP blocks claim', async () => {
      inMemoryOtps.push({
        email: finderUser.email,
        otp: '887766',
        purpose: 'report_found_item',
        expiresAt: new Date(Date.now() - 5000),
      });

      const res = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody({ otp: '887766' })),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /expired/i);
    });

    it('OTP cannot be reused', async () => {
      await fetch(`${baseUrl}/api/items/send-report-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify({ email: finderUser.email, name: finderUser.name, type: 'found' }),
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      // First claim succeeds
      const firstRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody({ otp: latestOtp.otp })),
      });
      assert.strictEqual(firstRes.status, 201);

      // Same OTP reuse attempt by another user or same user must fail
      const reuseRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherToken}`,
        },
        body: JSON.stringify(makeValidFinderBody({ email: otherUser.email, otp: latestOtp.otp })),
      });
      assert.strictEqual(reuseRes.status, 400);
    });
  });

  describe('OWNER OTP Verification Tests', () => {
    let activeClaimId;

    beforeEach(async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      const data = await claimRes.json();
      activeClaimId = data._id;
    });

    it('owner can request recovery OTP', async () => {
      const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.maskedEmail);
    });

    it("OTP sent to authenticated owner's actual college email", async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];
      assert.ok(latestOtp);
      assert.strictEqual(latestOtp.email, ownerUser.email);
      assert.strictEqual(latestOtp.type, 'recovery');
      assert.strictEqual(latestOtp.otp.length, 6);
    });

    it('non-owner cannot request recovery OTP', async () => {
      const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${finderToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('wrong OTP blocks recovery', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: '000000' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /invalid otp/i);
    });

    it('expired OTP blocks recovery', async () => {
      inMemoryOtps.push({
        email: ownerUser.email,
        otp: '998877',
        purpose: 'item_recovery',
        expiresAt: new Date(Date.now() - 5000),
      });

      const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: '998877' }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.message, /expired/i);
    });

    it('OTP cannot be reused', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      const firstRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });
      assert.strictEqual(firstRes.status, 200);

      const reuseRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });
      assert.strictEqual(reuseRes.status, 400);
    });

    it('successful owner OTP directly resolves item and claim', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });
      assert.strictEqual(res.status, 200);

      const currentClaim = inMemoryClaims.find((c) => String(c._id) === String(activeClaimId));
      assert.strictEqual(currentClaim.status, 'resolved');
      assert.ok(currentClaim.resolvedAt);
      assert.ok(currentClaim.ownerConfirmedAt);
      assert.strictEqual(String(currentClaim.ownerConfirmedBy), String(ownerUser._id));
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      assert.ok(inMemoryItem.resolvedAt);
      assert.ok(inMemoryItem.ownerConfirmedAt);
      assert.strictEqual(String(inMemoryItem.ownerConfirmedBy), String(ownerUser._id));
    });

    it('successful owner OTP does NOT require admin approval', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });

      assert.strictEqual((inMemoryItem.status || '').toLowerCase(), 'resolved');
      assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));
      assert.ok(sentOwnerResolutionEmails.some((e) => e.ownerEmail === ownerUser.email));
      assert.ok(sentFinderResolutionEmails.some((e) => e.finderEmail === finderUser.email));
    });
  });

  describe('ADMIN Dashboard History & View Tests', () => {
    let activeClaimId;

    beforeEach(async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      const data = await claimRes.json();
      activeClaimId = data._id;

      // Owner recovery with OTP directly resolves without admin approval
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });
    });

    it('admin can view resolved claim history and recovery audit details', async () => {
      const res = await fetch(`${baseUrl}/api/claims/${activeClaimId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'resolved');
      assert.ok(data.ownerConfirmedAt);
      assert.ok(data.resolvedAt);
      assert.strictEqual(String(data.finder?._id || data.finder), String(finderUser._id));
      assert.strictEqual(String(data.owner?._id || data.owner), String(ownerUser._id));
    });

    it('non-admin cannot access admin claim endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/claims/${activeClaimId}`, {
        headers: { Authorization: `Bearer ${finderToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    it('recovery does not require admin approval to resolve item', async () => {
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      const currentClaim = inMemoryClaims.find((c) => String(c._id) === String(activeClaimId));
      assert.strictEqual(currentClaim.status, 'resolved');
    });

    it('admin sees owner confirmation and resolution timestamps in claim history', async () => {
      const currentClaim = inMemoryClaims.find((c) => String(c._id) === String(activeClaimId));
      assert.ok(currentClaim.ownerConfirmedAt);
      assert.ok(currentClaim.resolvedAt);
      assert.strictEqual(String(currentClaim.ownerConfirmedBy), String(ownerUser._id));
    });

    it('owner and finder resolution emails are sent upon owner OTP recovery without admin action', async () => {
      assert.ok(sentOwnerResolutionEmails.some((e) => e.ownerEmail === ownerUser.email));
      assert.ok(sentFinderResolutionEmails.some((e) => e.finderEmail === finderUser.email));
    });
  });

  describe('WRONG FINDER Tests', () => {
    let activeClaimId;

    beforeEach(async () => {
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      const data = await claimRes.json();
      activeClaimId = data._id;
    });

    it('owner can reject finder', async () => {
      const res = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(res.status, 200);
      const currentClaim = inMemoryClaims.find((c) => String(c._id) === String(activeClaimId));
      assert.strictEqual(currentClaim.status, 'rejected');
      assert.ok(currentClaim.rejectedAt);
      assert.strictEqual(String(currentClaim.rejectedBy), String(ownerUser._id));
    });

    it('rejection clears foundBy', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(inMemoryItem.foundBy, null);
    });

    it('rejected claim stays in history', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const rejectedClaim = inMemoryClaims.find((c) => String(c._id) === String(activeClaimId));
      assert.ok(rejectedClaim);
      assert.strictEqual(rejectedClaim.status, 'rejected');
    });

    it('another finder can claim', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      const res = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherToken}`,
        },
        body: JSON.stringify({
          ...makeValidFinderBody(),
          fullName: otherUser.name,
          email: otherUser.email,
          phone: otherUser.phone,
          otp: '234567',
        }),
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(String(inMemoryItem.foundBy), String(otherUser._id));
    });

    it('same rejected finder can claim again after rejection creating a new document', async () => {
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });

      inMemoryOtps.push({
        email: finderUser.email,
        otp: '889900',
        purpose: 'report_found_item',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const reclaimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody({ otp: '889900', finderMessage: 'Rechecked the location and found it again' })),
      });
      assert.strictEqual(reclaimRes.status, 201);
      const data = await reclaimRes.json();
      assert.strictEqual(data.status, 'Contacted');
      assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));
      assert.ok(inMemoryClaims.length >= 2);
      const rejectedClaim = inMemoryClaims.find((c) => c.status === 'rejected');
      const activeClaim = inMemoryClaims.find((c) => c.status === 'Contacted');
      assert.ok(rejectedClaim, 'Previous rejected claim must remain in history');
      assert.ok(activeClaim, 'New active claim document must be created');
    });
  });

  describe('OWNER SELF-RECOVERY Tests (Direct Resolution + Email)', () => {
    it('owner self-recovery sends owner email', async () => {
      // Owner requests recovery OTP for active lost item (no finder claim)
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(otpRes.status, 200);

      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];
      assert.ok(latestOtp);
      assert.strictEqual(latestOtp.email, ownerUser.email);

      // Owner verifies OTP and directly resolves
      const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });

      assert.strictEqual(recoverRes.status, 200);
      const data = await recoverRes.json();
      assert.strictEqual(data.status, 'Resolved');
      assert.strictEqual(data.recoveryType, 'owner_found');

      // Verifies owner self-recovery email was sent immediately
      assert.strictEqual(sentOwnerSelfRecoveryEmails.length, 1);
    });

    it('email contains item name and resolved status', async () => {
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(otpRes.status, 200);
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });

      const sentMail = sentOwnerSelfRecoveryEmails[sentOwnerSelfRecoveryEmails.length - 1];
      assert.ok(sentMail);
      assert.strictEqual(sentMail.itemName, inMemoryItem.title);
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      assert.strictEqual(inMemoryItem.recoveryType, 'owner_found');
    });

    it("email uses authenticated owner's actual email", async () => {
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      // Sending arbitrary email in body must be ignored in favor of authenticated user DB email
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp, email: 'spoofed@external.com' }),
      });

      const sentMail = sentOwnerSelfRecoveryEmails[sentOwnerSelfRecoveryEmails.length - 1];
      assert.ok(sentMail);
      assert.strictEqual(sentMail.ownerEmail, ownerUser.email);
      assert.notStrictEqual(sentMail.ownerEmail, 'spoofed@external.com');
    });

    it('no admin approval required', async () => {
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });

      assert.strictEqual(recoverRes.status, 200);
      const data = await recoverRes.json();

      // Resolved immediately without requiring admin approval
      assert.strictEqual(data.status, 'Resolved');
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      assert.strictEqual(inMemoryItem.recoveryType, 'owner_found');
      assert.strictEqual(String(inMemoryItem.recoveredBy), String(ownerUser._id));
      assert.ok(inMemoryItem.ownerConfirmedAt);
      assert.ok(inMemoryItem.resolvedAt);

      // Does NOT create a finder claim
      assert.strictEqual(inMemoryClaims.length, 0);
    });

    it('owner self-recovery remains Resolved', async () => {
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });

      assert.strictEqual(inMemoryItem.status, 'Resolved');

      const getRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`);
      assert.strictEqual(getRes.status, 200);
      const itemData = await getRes.json();
      assert.strictEqual(itemData.status, 'Resolved');
      assert.strictEqual(itemData.recoveryType, 'owner_found');
    });

    it('finder workflow remains unchanged', async () => {
      // 1. Finder submits claim with proof photo and OTP
      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const claimData = await claimRes.json();
      assert.strictEqual(claimData.status, 'Contacted');

      // 2. Owner requests recovery OTP
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(otpRes.status, 200);
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      // 3. Owner submits recovery when an active finder claim exists
      const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });
      assert.strictEqual(recoverRes.status, 200);
      const recoverData = await recoverRes.json();

      // Finder workflow: directly resolves upon owner OTP without admin approval
      assert.strictEqual(recoverData.status, 'Resolved');
      assert.strictEqual(inMemoryClaims[0].status, 'resolved');
      assert.strictEqual((inMemoryItem.status || '').toLowerCase(), 'resolved');
      assert.strictEqual(sentOwnerResolutionEmails.length, 1);
      assert.strictEqual(sentFinderResolutionEmails.length, 1);
    });
  });

  describe('ADMIN DASHBOARD AUTOMATIC WORKFLOW & SECTION FILTERING', () => {
    it('LOST report appears in Lost Items while active and unresolved', async () => {
      // Clean unresolved lost item
      inMemoryItem.type = 'lost';
      inMemoryItem.status = 'Pending';
      inMemoryItem.foundBy = null;
      inMemoryItem.recoveryType = null;
      inMemoryClaims = [];

      const getRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`);
      assert.strictEqual(getRes.status, 200);
      const data = await getRes.json();
      assert.strictEqual(data.type, 'lost');
      assert.notStrictEqual(data.status, 'Resolved');
      assert.strictEqual(data.foundBy, null);
    });

    it('finder report causes item to appear in Found Items and active claim in Claim Requests', async () => {
      inMemoryItem.type = 'lost';
      inMemoryItem.status = 'Active';
      inMemoryItem.foundBy = null;
      inMemoryClaims = [];

      const claimRes = await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(claimRes.status, 201);
      const claimData = await claimRes.json();
      assert.strictEqual(claimData.status, 'Contacted');

      // Now item has foundBy set
      assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));
      assert.strictEqual(inMemoryClaims.length, 1);
      assert.strictEqual(inMemoryClaims[0].status, 'Contacted');
    });

    it('finder-reported lost item is not duplicated across state changes', async () => {
      await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      const originalId = String(inMemoryItem._id);
      assert.strictEqual(String(inMemoryClaims[0].item), originalId);
      assert.strictEqual(String(inMemoryItem._id), originalId);
    });

    it('wrong finder rejection returns item to Lost and keeps rejected claim in history', async () => {
      // First finder reports item
      await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });
      assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));

      // Owner rejects finder
      const rejectRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/reject-finder`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(rejectRes.status, 200);

      // foundBy is cleared, item returns to active Lost
      assert.strictEqual(inMemoryItem.foundBy, null);
      assert.strictEqual(inMemoryItem.status, 'Active');

      // Previous claim stays in history with rejected status
      assert.strictEqual(inMemoryClaims.length, 1);
      assert.strictEqual(inMemoryClaims[0].status, 'rejected');
      assert.ok(inMemoryClaims[0].rejectedAt);
    });

    it('owner self-recovery appears directly in Claimed without creating finder claim', async () => {
      // Reset to clean lost item
      inMemoryItem.status = 'Pending';
      inMemoryItem.foundBy = null;
      inMemoryItem.recoveryType = null;
      inMemoryClaims = [];

      // Owner requests OTP
      const otpRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(otpRes.status, 200);
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      // Owner confirms self-recovery
      const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp, recoveryType: 'owner_found' }),
      });
      assert.strictEqual(recoverRes.status, 200);

      // Resolved directly, recoveryType is owner_found
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      assert.strictEqual(inMemoryItem.recoveryType, 'owner_found');
      assert.ok(inMemoryItem.resolvedAt);

      // No claim record created!
      assert.strictEqual(inMemoryClaims.length, 0);
    });

    it('completed finder recovery appears in Claimed and resolved record disappears from active lists', async () => {
      // Setup finder-reported item
      inMemoryItem.status = 'Active';
      inMemoryItem.foundBy = null;
      inMemoryItem.recoveryType = null;
      inMemoryClaims = [];

      await fetch(`${baseUrl}/api/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finderToken}`,
        },
        body: JSON.stringify(makeValidFinderBody()),
      });

      // Owner OTP and recovery
      await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recovery-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const latestOtp = sentOtpEmails[sentOtpEmails.length - 1];

      const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ otp: latestOtp.otp }),
      });
      assert.strictEqual(recoverRes.status, 200);

      // Item is resolved and claim is resolved
      assert.strictEqual(inMemoryItem.status, 'Resolved');
      assert.strictEqual(inMemoryItem.recoveryType, 'finder_found');
      assert.strictEqual(inMemoryClaims[0].status, 'resolved');
      assert.ok(inMemoryItem.resolvedAt);
    });

    it('normal FOUND report can become Claimed after recovery', async () => {
      inMemoryItem.type = 'found';
      inMemoryItem.status = 'Pending';
      inMemoryItem.foundBy = null;
      inMemoryItem.recoveryType = null;
      inMemoryClaims = [];

      // Direct resolution / recovery
      inMemoryItem.status = 'Resolved';
      inMemoryItem.recoveryType = 'normal_found';
      inMemoryItem.resolvedAt = new Date();

      const getRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`);
      assert.strictEqual(getRes.status, 200);
      const data = await getRes.json();
      assert.strictEqual(data.status, 'Resolved');
      assert.strictEqual(data.recoveryType, 'normal_found');
    });

    it('Admin sees correct owner, finder, recovery, and audit information unmasked', async () => {
      inMemoryItem.status = 'Resolved';
      inMemoryItem.recoveryType = 'finder_found';
      inMemoryItem.resolvedAt = new Date();
      inMemoryItem.foundBy = finderUser._id;
      inMemoryClaims = [
        {
          _id: '64c3f3000000000000000001',
          item: inMemoryItem._id,
          finder: finderUser,
          owner: ownerUser,
          fullName: finderUser.name,
          email: finderUser.email,
          phone: finderUser.phone,
          status: 'resolved',
          submittedAt: new Date(),
          resolvedAt: inMemoryItem.resolvedAt,
        },
      ];

      const adminRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(adminRes.status, 200);
      const data = await adminRes.json();
      assert.ok(data.reportedBy);
      assert.strictEqual(data.status, 'Resolved');
      assert.strictEqual(data.recoveryType, 'finder_found');
      assert.ok(data.claims);
    });
  });
});
