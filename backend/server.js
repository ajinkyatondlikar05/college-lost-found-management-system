const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is not set in .env');
  process.exit(1);
}

// Safe URI for logging — strips credentials before printing
const safeUri = MONGO_URI.replace(/:\/\/[^@]+@/, '://***:***@');

const seedAdmin = require('./utils/seedAdmin');
const seedCategories = require('./utils/seedCategories');
const { verifyEmailTransporter } = require('./utils/email');

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(`MongoDB connected successfully → ${safeUri}`);
    await seedAdmin();
    await seedCategories();
    await verifyEmailTransporter();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    // Only log the message, never the full error (which can contain the URI)
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  });

