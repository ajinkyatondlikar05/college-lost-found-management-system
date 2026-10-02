const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestServer } = require('./helpers/testServer');

describe('API Health and Root Endpoints', () => {
  const testServer = createTestServer();
  let baseUrl;

  before(async () => {
    baseUrl = await testServer.start();
  });

  after(async () => {
    await testServer.stop();
  });

  it('GET / should return 200 with health status message', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.message, 'College Lost & Found API is running!');
  });

  it('GET non-existent endpoint should return 404', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-route-12345`);
    assert.strictEqual(res.status, 404);
  });

  it('should include CORS headers for cross-origin requests', async () => {
    const res = await fetch(`${baseUrl}/`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });
    // Express CORS middleware responds with access-control-allow-origin
    const allowOrigin = res.headers.get('access-control-allow-origin');
    assert.ok(allowOrigin === '*' || allowOrigin === 'http://localhost:3000');
  });
});
