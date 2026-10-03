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

    // User.findById stub for protect middleware & optional auth
    User.findById = (id) => ({
      select: () => {
        const idStr = String(id);
        if (idStr === String(ownerUser._id)) return Promise.resolve(ownerUser);
        if (idStr === String(finderUser._id)) return Promise.resolve(finderUser);
        if (idStr === String(otherUser._id)) return Promise.resolve(otherUser);
        if (idStr === String(adminUser._id)) return Promise.resolve(adminUser);
        return Promise.resolve(null);
      },
    });

    // Mock sendItemFoundNotificationEmail
    emailUtils.sendItemFoundNotificationEmail = async (params) => {
      if (emailShouldFail) {
        return { success: false, error: 'SMTP connection failed' };
      }
      sentEmails.push(params);
      return { success: true, messageId: '<test-found-notification-id>' };
    };

    // Mock sendOtpEmail
    emailUtils.sendOtpEmail = async (email, name, otp, type) => {
      sentOtpEmails.push({ email, name, otp, type });
      return { success: true, messageId: '<test-otp-id>' };
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
    Otp.findOne = originalOtpFindOne;
    Otp.create = originalOtpCreate;
    Otp.deleteMany = originalOtpDeleteMany;
    emailUtils.sendItemFoundNotificationEmail = originalSendEmail;
    emailUtils.sendOtpEmail = originalSendOtpEmail;
    await testServer.stop();
  });

  beforeEach(() => {
    sentEmails = [];
    sentOtpEmails = [];
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
          if (clone && clone.foundBy && String(clone.foundBy) === String(finderUser._id)) {
            clone.foundBy = { ...finderUser };
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
  it('5. public users do not receive finder phone/email in item details (Privacy preservation)', async () => {
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
    // Sensitive finder phone & email are stripped for public viewers
    assert.strictEqual(publicData.foundBy?.phone, undefined);
    assert.strictEqual(publicData.foundBy?.email, undefined);
    if (publicData.claims && publicData.claims.length > 0) {
      assert.strictEqual(publicData.claims[0].phone, undefined);
      assert.strictEqual(publicData.claims[0].email, undefined);
    }
  });

  // 6. Owner sees complete finder contact info and can complete recovery
  it('6. owner sees complete finder contact information and recovery action', async () => {
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
  });

  // 7. Owner recovery marks item and claim as Resolved
  it('7. owner recovery changes item status to Resolved and resolves claim', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify(makeValidFinderBody()),
    });

    const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.strictEqual(recoverRes.status, 200);
    const recoverData = await recoverRes.json();
    assert.strictEqual(recoverData.status || recoverData.item?.status, 'Resolved');
    assert.strictEqual(inMemoryClaims[0].status, 'resolved');
    assert.ok(inMemoryClaims[0].resolvedAt);
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
  it('16. should dispatch an email to the lost-item owner with finder details and message', async () => {
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
});
