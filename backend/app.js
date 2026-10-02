const express = require('express');
const cors = require('cors');
const path = require('path');
const { register, metricsMiddleware } = require('./utils/metrics');

const app = express();

// Metrics Middleware
app.use(metricsMiddleware);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Prometheus Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'College Lost & Found API is running!' });
});

module.exports = app;

