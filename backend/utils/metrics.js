const client = require('prom-client');

// Initialize a dedicated Prometheus Registry
const register = new client.Registry();

// Add default recommended labels across all metrics
register.setDefaultLabels({
  app: 'college-lost-found-backend',
});

// Enable default Node.js runtime and OS metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({ register });

// HTTP Request Counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed by Express',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP Request Duration Histogram
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Express middleware to record request duration and status code
 */
function metricsMiddleware(req, res, next) {
  // Avoid recording metrics for the metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;

    // Use parameterized route pattern if available to prevent high cardinality
    let route = req.route ? `${req.baseUrl || ''}${req.route.path}` : req.path;
    if (!route) route = 'unknown';

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, duration);
  });

  next();
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDurationSeconds,
};
