const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/testServer');
const User = require('../models/User');

describe('Authentication Routes Validation & Security', () => {
  const testServer = createTestServer();
  let baseUrl;
  let originalFindOne;

  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_token_12345';
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

    it('should allow normal @apsit.edu.in login with valid password and approved student account', async () => {
      const prevFindOne = User.findOne;
      User.findOne = async (query) => {
        if (query.email === '24107068@apsit.edu.in') {
          return {
            _id: '64a1f1000000000000000010',
            name: 'College Student',
            email: '24107068@apsit.edu.in',
            studentId: '24107068',
            phone: '9876543210',
            department: 'Computer Engineering',
            role: 'user',
            status: 'approved',
            approved: true,
            comparePassword: async (pwd) => pwd === 'CollegeSecret123',
          };
        }
        return null;
      };

      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: '24107068@apsit.edu.in',
            password: 'CollegeSecret123',
            isAdmin: false,
          }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.email, '24107068@apsit.edu.in');
        assert.strictEqual(data.role, 'user');
        assert.ok(data.token);
      } finally {
        User.findOne = prevFindOne;
      }
    });

    it('should allow permanent production/demo login for ajinkyatondlikar@gmail.com with environment variable password', async () => {
      const prevEnvPass = process.env.DEMO_LOGIN_PASSWORD;
      process.env.DEMO_LOGIN_PASSWORD = 'TestEnvDemoPassword123';
      const prevFindOne = User.findOne;
      User.findOne = async (query) => {
        if (query.email === 'ajinkyatondlikar@gmail.com') {
          return {
            _id: '64a1f1000000000000000099',
            name: 'Ajinkya Tondlikar',
            email: 'ajinkyatondlikar@gmail.com',
            studentId: '99999999',
            phone: '',
            department: 'Computer Engineering',
            role: 'user',
            status: 'approved',
            approved: true,
          };
        }
        return null;
      };

      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ajinkyatondlikar@gmail.com',
            password: 'TestEnvDemoPassword123',
            isAdmin: false,
          }),
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.email, 'ajinkyatondlikar@gmail.com');
        assert.strictEqual(data.role, 'user');
        assert.strictEqual(data.approved, true);
        assert.ok(data.token);
      } finally {
        User.findOne = prevFindOne;
        if (prevEnvPass !== undefined) {
          process.env.DEMO_LOGIN_PASSWORD = prevEnvPass;
        } else {
          delete process.env.DEMO_LOGIN_PASSWORD;
        }
      }
    });

    it('should reject permanent production/demo login for ajinkyatondlikar@gmail.com when password does not match', async () => {
      const prevEnvPass = process.env.DEMO_LOGIN_PASSWORD;
      process.env.DEMO_LOGIN_PASSWORD = 'TestEnvDemoPassword123';
      try {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'ajinkyatondlikar@gmail.com',
            password: 'WrongPassword999',
            isAdmin: false,
          }),
        });

        assert.strictEqual(res.status, 401);
        const data = await res.json();
        assert.strictEqual(data.message, 'Invalid email or password');
      } finally {
        if (prevEnvPass !== undefined) {
          process.env.DEMO_LOGIN_PASSWORD = prevEnvPass;
        } else {
          delete process.env.DEMO_LOGIN_PASSWORD;
        }
      }
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
