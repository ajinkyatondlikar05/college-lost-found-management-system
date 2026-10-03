const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createTestServer } = require('./helpers/testServer');
const User = require('../models/User');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
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
  let originalSendEmail;

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
  const adminToken = jwt.sign({ id: adminUser._id }, testSecret);

  let inMemoryItem;
  let inMemoryClaims = [];
  let sentEmails = [];
  let emailShouldFail = false;

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
    originalSendEmail = emailUtils.sendItemFoundNotificationEmail;

    // User.findById stub for protect middleware
    User.findById = (id) => ({
      select: () => {
        const idStr = String(id);
        if (idStr === String(ownerUser._id)) return Promise.resolve(ownerUser);
        if (idStr === String(finderUser._id)) return Promise.resolve(finderUser);
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
    emailUtils.sendItemFoundNotificationEmail = originalSendEmail;
    await testServer.stop();
  });

  beforeEach(() => {
    sentEmails = [];
    emailShouldFail = false;
    inMemoryClaims = [];

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
        populate: () => Promise.resolve(target),
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
      const chain = {
        populate: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => Promise.resolve(inMemoryClaims),
        then: (resolve) => resolve(inMemoryClaims),
      };
      return chain;
    };

    Claim.countDocuments = async () => inMemoryClaims.length;
  });

  // 1. Finder cannot claim own lost item
  it('1. should prevent owner from claiming their own lost item (self-claim prevention)', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: ownerUser.name,
        email: ownerUser.email,
        phone: ownerUser.phone,
        finderMessage: 'This is my own calculator',
      }),
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /cannot claim or report/i);
    assert.strictEqual(inMemoryClaims.length, 0);
  });

  // 2. Valid finder claim submission
  it('2. should allow a non-owner student to submit a found-item claim with message', async () => {
    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'I found your calculator in the 4th floor library study desk.',
      }),
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data._id);
    assert.strictEqual(data.status, 'Contacted');
    assert.strictEqual(data.finderMessage, 'I found your calculator in the 4th floor library study desk.');
  });

  // 3. Duplicate active claim prevention
  it('3. should prevent duplicate active claims by the same finder for the same item', async () => {
    // Submit first claim
    const firstRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'Found on table',
      }),
    });
    assert.strictEqual(firstRes.status, 201);

    // Attempt second claim
    const secondRes = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'Another message',
      }),
    });

    assert.strictEqual(secondRes.status, 400);
    const data = await secondRes.json();
    assert.match(data.message, /already submitted an active claim/i);
    assert.strictEqual(inMemoryClaims.length, 1);
  });

  // 4. Claim record stores owner and finder correctly
  it('4. should correctly store itemId, owner, finder, finderMessage, and initial status', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'Found under desk B12',
      }),
    });

    assert.strictEqual(inMemoryClaims.length, 1);
    const storedClaim = inMemoryClaims[0];
    assert.strictEqual(String(storedClaim.item), String(inMemoryItem._id));
    assert.strictEqual(String(storedClaim.owner), String(ownerUser._id));
    assert.strictEqual(String(storedClaim.finder), String(finderUser._id));
    assert.strictEqual(storedClaim.finderMessage, 'Found under desk B12');
    assert.strictEqual(storedClaim.status, 'Contacted');
  });

  // 5. Owner email is triggered
  it('5. should dispatch an email to the lost-item owner with finder details and message', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'I have kept it safely with the Lab in-charge.',
      }),
    });

    assert.strictEqual(sentEmails.length, 1);
    const email = sentEmails[0];
    assert.strictEqual(email.ownerEmail, ownerUser.email);
    assert.strictEqual(email.ownerName, ownerUser.name);
    assert.strictEqual(email.itemName, inMemoryItem.title);
    assert.strictEqual(email.finderName, finderUser.name);
    assert.strictEqual(email.finderEmail, finderUser.email);
    assert.strictEqual(email.finderPhone, finderUser.phone);
    assert.strictEqual(email.finderMessage, 'I have kept it safely with the Lab in-charge.');
  });

  // 6. Email failure handling and atomic rollback
  it('6. should roll back claim record and return 500 when owner notification email fails', async () => {
    emailShouldFail = true;

    const res = await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'Item found',
      }),
    });

    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.match(data.message, /Failed to notify the item owner via email/i);
    // Verified that no broken/orphaned claim record remains in database
    assert.strictEqual(inMemoryClaims.length, 0);
  });

  // 7. Owner recovery / resolution workflow
  it('7. should allow item owner to mark item as recovered and resolve active claim', async () => {
    // First, finder reports finding the item
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'I returned it to you outside library.',
      }),
    });

    assert.strictEqual(inMemoryClaims.length, 1);
    assert.strictEqual(inMemoryClaims[0].status, 'Contacted');

    // Owner marks item as recovered: PUT /api/items/:id/recover
    const recoverRes = await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.strictEqual(recoverRes.status, 200);
    const updatedItem = await recoverRes.json();
    assert.strictEqual(updatedItem.status, 'Resolved');
    assert.ok(updatedItem.resolvedAt);

    // Verify claim status is updated to 'resolved'
    assert.strictEqual(inMemoryClaims[0].status, 'resolved');
    assert.ok(inMemoryClaims[0].resolvedAt);
  });

  // 8. Final foundBy value is correctly assigned
  it('8. should set item.foundBy to the finder user when resolved', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'I have your item.',
      }),
    });

    await fetch(`${baseUrl}/api/items/${inMemoryItem._id}/recover`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.strictEqual(String(inMemoryItem.foundBy), String(finderUser._id));
  });

  // 9. Admin can retrieve owner/finder information
  it('9. should allow admin to retrieve claims with owner and finder info', async () => {
    await fetch(`${baseUrl}/api/claims`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finderToken}`,
      },
      body: JSON.stringify({
        itemId: inMemoryItem._id,
        fullName: finderUser.name,
        email: finderUser.email,
        phone: finderUser.phone,
        finderMessage: 'Found in campus garden.',
      }),
    });

    const res = await fetch(`${baseUrl}/api/claims`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.claims));
    assert.strictEqual(data.claims.length, 1);
    assert.strictEqual(data.claims[0].fullName, finderUser.name);
    assert.strictEqual(data.claims[0].finderMessage, 'Found in campus garden.');
  });

  // 10. Existing claim proof image behavior still works
  it('10. should allow proof image URL on claim and preserve existing fields', async () => {
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
