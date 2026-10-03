const cloudinary = require('cloudinary').v2;
const fs = require('fs');

/**
 * Checks whether Cloudinary credentials are fully configured via environment variables.
 *
 * @returns {boolean}
 */
function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Configure Cloudinary using server-side environment variables only.
 */
function configureCloudinary() {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

// Initial configuration attempt on module load
configureCloudinary();

/**
 * Uploads a Multer file to Cloudinary if configured, or falls back to local /uploads path.
 *
 * @param {Object} file - Multer file object (has .path, .filename, etc.)
 * @param {string} [folder='college-lost-found/items'] - Target Cloudinary folder
 * @returns {Promise<string>} The secure HTTPS image URL or local relative path.
 */
async function uploadImage(file, folder = 'college-lost-found/items') {
  if (!file) return null;

  if (isCloudinaryConfigured()) {
    configureCloudinary();
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        resource_type: 'image',
      });

      // Safely delete temporary file from local/serverless filesystem after successful upload
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {
          // Ignore temp cleanup error
        }
      }

      return result.secure_url;
    } catch (error) {
      // Clean up temporary local file on failure as well
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (_) {
          // Ignore temp cleanup error
        }
      }

      // Log sanitized error message without exposing credentials
      console.error('[Cloudinary Upload Error]', error.message || 'Upload failed');
      throw new Error('Image upload failed. Please try again.');
    }
  }

  // Fallback: Local / Docker storage without Cloudinary configured
  return `/uploads/${file.filename}`;
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  configureCloudinary,
  uploadImage,
};
