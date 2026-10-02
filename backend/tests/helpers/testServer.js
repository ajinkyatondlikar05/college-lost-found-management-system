const http = require('http');
const app = require('../../app');

function createTestServer() {
  const server = http.createServer(app);
  let baseUrl = '';

  const start = () =>
    new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve(baseUrl);
      });
    });

  const stop = () =>
    new Promise((resolve) => {
      server.close(resolve);
    });

  const getUrl = () => baseUrl;

  return { start, stop, getUrl };
}

module.exports = { createTestServer };
