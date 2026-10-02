const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/testServer');
const User = require('../models/User');

describe('Authentication Routes Validation & Security', () => {
  const testServer = createTestServer();
  let baseUrl;
  let originalFindOne;

  before(async () => {
    // Stub User.findOne for offline test execution without database connection
    originalFindOne = User.findOne;
    User.findOne = async () => null;
    baseUrl = await testServer.start();
  });

  after(async () => {
    User.findOne = originalFindOne;
    await testServer.stop();
  });

  describe('POST /api/auth/register', () => {
    it('should reject registration when email is missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Student',
          password: 'Password123',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('official college email'));
    });

    it('should reject registration with non-college email domain (e.g. gmail.com)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Student',
          email: 'student@gmail.com',
          password: 'Password123',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('official college email'));
    });

    it('should reject registration with non-numeric username at college domain', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Student',
          email: 'john.doe@apsit.edu.in',
          password: 'Password123',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('official college email'));
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject login when email is missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'Password123',
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('official college email'));
    });

    it('should reject student login with non-APSIT email format', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'external@gmail.com',
          password: 'Password123',
          isAdmin: false,
        }),
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.message.includes('official college email'));
    });

    it('should reject admin portal login attempt with invalid email', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'intruder@random.com',
          password: 'SomePassword',
          isAdmin: true,
        }),
      });

      // Admin portal login rejects unauthorized non-admin emails
      assert.ok(res.status === 401 || res.status === 403);
    });
  });

  describe('GET /api/auth/me (Protected Route)', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.message, 'Not authorized, no token');
    });

    it('should return 401 when token is invalid or malformed', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Authorization: 'Bearer invalid.mock.jwt.token',
        },
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.message, 'Not authorized, token failed');
    });
  });
});
