const mongoose = require('mongoose');
const seedAdmin = require('./seedAdmin');
const seedCategories = require('./seedCategories');
const { verifyEmailTransporter } = require('./email');

// Global cache across serverless warm invocations
let cached = global._mongooseConnection;
if (!cached) {
  cached = global._mongooseConnection = { conn: null, promise: null, initialized: false };
}

/**
 * Connect to MongoDB and execute startup seeding & verification routines once.
 * Caches connection across serverless invocations to avoid connection leaks.
 */
async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not set in environment variables');
    }

    const safeUri = MONGO_URI.replace(/:\/\/[^@]+@/, '://***:***@');

    cached.promise = mongoose
      .connect(MONGO_URI)
      .then(async (m) => {
        console.log(`MongoDB connected successfully → ${safeUri}`);
        if (!cached.initialized) {
          try {
            await seedAdmin();
            await seedCategories();
            await verifyEmailTransporter();
            cached.initialized = true;
          } catch (initErr) {
            console.error('Initialization error during startup:', initErr.message);
          }
        }
        return m;
      })
      .catch((err) => {
        cached.promise = null;
        console.error(`MongoDB connection failed: ${err.message}`);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

module.exports = connectDB;
