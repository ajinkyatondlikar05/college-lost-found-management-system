const User = require('../models/User');

/**
 * Automatically seeds or updates the dedicated Admin account in MongoDB.
 * Ensures:
 * - Email: admin@apsit.edu.in
 * - Role: admin
 * - Status: approved
 * - Password: secure bcrypt hash of configured ADMIN_PASSWORD
 */
const seedAdmin = async () => {
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@apsit.edu.in').trim().toLowerCase();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@ChangeMe123';

  try {
    let admin = await User.findOne({ email: ADMIN_EMAIL });

    if (admin) {
      admin.name = 'System Admin';
      admin.role = 'admin';
      admin.status = 'approved';
      admin.approved = true;
      admin.password = ADMIN_PASSWORD; // Triggers pre('save') bcrypt hashing
      await admin.save();
      console.log(`Dedicated admin account verified and configured: ${ADMIN_EMAIL}`);
    } else {
      // Check if an existing admin with another email exists (e.g., admin@college.edu)
      const existingOtherAdmin = await User.findOne({ role: 'admin' });

      if (existingOtherAdmin) {
        existingOtherAdmin.email = ADMIN_EMAIL;
        existingOtherAdmin.name = 'System Admin';
        existingOtherAdmin.role = 'admin';
        existingOtherAdmin.status = 'approved';
        existingOtherAdmin.approved = true;
        existingOtherAdmin.password = ADMIN_PASSWORD;
        await existingOtherAdmin.save();
        console.log(`Updated existing admin account to dedicated email: ${ADMIN_EMAIL}`);
      } else {
        await User.create({
          name: 'System Admin',
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          role: 'admin',
          status: 'approved',
          approved: true,
          department: 'Administration',
        });
        console.log(`Created new dedicated admin account: ${ADMIN_EMAIL}`);
      }
    }

    // Ensure all other accounts are role: 'user' so only the dedicated account has admin privileges
    await User.updateMany(
      { email: { $ne: ADMIN_EMAIL }, role: 'admin' },
      { $set: { role: 'user' } }
    );
  } catch (error) {
    console.error('Failed to seed dedicated admin account:', error.message);
  }
};

module.exports = seedAdmin;
