const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');

/**
 * Vercel-compatible serverless entrypoint.
 * Exports the Express app instance without calling app.listen().
 * Incoming requests automatically trigger database connection & verification
 * via the connectDB middleware in app.js before reaching route handlers.
 */
module.exports = app;
