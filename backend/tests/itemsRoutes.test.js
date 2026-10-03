const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/testServer');
const Item = require('../models/Item');

describe('Items & Reports API Endpoints Protection and Query Behavior', () => {
  const testServer = createTestServer();
  let baseUrl;
  let originalFind;
  let originalCountDocuments;
  let originalFindById;

  before(async () => {
    // Stub Mongoose query methods so routes can be tested offline without database
    originalFind = Item.find;
    originalCountDocuments = Item.countDocuments;
    originalFindById = Item.findById;

    Item.countDocuments = async () => 0;
    Item.find = () => ({
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: async () => [],
          }),
        }),
      }),
    });
    Item.findById = () => ({
      populate: async () => null,
    });

    baseUrl = await testServer.start();
  });

  after(async () => {
    Item.find = originalFind;
    Item.countDocuments = originalCountDocuments;
    Item.findById = originalFindById;
    await testServer.stop();
  });

  describe('Public Item Queries', () => {
    it('GET /api/items should return structured paginated list', async () => {
      const res = await fetch(`${baseUrl}/api/items`);
      assert.strictEqual(res.status, 200);

      const data = await res.json();
      assert.ok(Array.isArray(data.items));
      assert.strictEqual(data.total, 0);
      assert.strictEqual(data.page, 1);
      assert.strictEqual(data.pages, 1);
    });

    it('GET /api/items/:id should return 404 when item does not exist', async () => {
      const res = await fetch(`${baseUrl}/api/items/nonexistentid12345`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.message, 'Item not found');
    });
  });

  describe('Protected Reporting Endpoints', () => {
    it('POST /api/items should reject unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Lost Calculator',
          category: 'Electronics',
        }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('POST /api/items/send-report-otp should reject unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/items/send-report-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lost',
        }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('POST /api/items/verify-report-otp should reject unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/items/verify-report-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: '24107068@apsit.edu.in',
          otp: '123456',
        }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('GET /api/items/user/my-reports should reject unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/items/user/my-reports`);
      assert.strictEqual(res.status, 401);
    });

    it('PUT /api/items/:id should reject unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/items/item123`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });
      assert.strictEqual(res.status, 401);
    });

    it('DELETE /api/items/:id should reject unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/items/item123`, {
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 401);
    });
  });
});
