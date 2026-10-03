const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  cloudinary,
  isCloudinaryConfigured,
  configureCloudinary,
  uploadImage,
} = require('../config/cloudinary');

describe('Cloudinary Storage Integration & Configuration', () => {
  const originalEnv = { ...process.env };
  const originalUpload = cloudinary.uploader.upload;

  beforeEach(() => {
    // Reset env vars before each test
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  afterEach(() => {
    // Restore env and mocked upload method
    process.env = { ...originalEnv };
    cloudinary.uploader.upload = originalUpload;
  });

  it('isCloudinaryConfigured should return false when credentials are unset', () => {
    assert.strictEqual(isCloudinaryConfigured(), false);
  });

  it('isCloudinaryConfigured should return false when only partial credentials exist', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    assert.strictEqual(isCloudinaryConfigured(), false);
  });

  it('isCloudinaryConfigured should return true when all 3 credentials are set', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    assert.strictEqual(isCloudinaryConfigured(), true);
  });

  it('configureCloudinary should safely configure the Cloudinary SDK with secure=true', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
    process.env.CLOUDINARY_API_KEY = 'mock-key';
    process.env.CLOUDINARY_API_SECRET = 'mock-secret';

    configureCloudinary();
    const config = cloudinary.config();
    assert.strictEqual(config.cloud_name, 'mock-cloud');
    assert.strictEqual(config.api_key, 'mock-key');
    assert.strictEqual(config.secure, true);
  });

  it('uploadImage should fall back to local /uploads/ filename when Cloudinary is not configured', async () => {
    const mockFile = {
      path: '/tmp/test-file.png',
      filename: 'local-test-123.png',
    };
    const resultUrl = await uploadImage(mockFile, 'college-lost-found/items');
    assert.strictEqual(resultUrl, '/uploads/local-test-123.png');
  });

  it('uploadImage should upload to Cloudinary and return secure_url when configured (mocked)', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
    process.env.CLOUDINARY_API_KEY = 'mock-key';
    process.env.CLOUDINARY_API_SECRET = 'mock-secret';

    // Create temporary dummy file on disk
    const tempFile = path.join(os.tmpdir(), `test-upload-${Date.now()}.png`);
    fs.writeFileSync(tempFile, 'dummy-image-bytes');

    let capturedFolder = '';
    const mockSecureUrl = 'https://res.cloudinary.com/mock-cloud/image/upload/v12345/college-lost-found/items/mock-img.png';

    // Mock Cloudinary uploader upload method
    cloudinary.uploader.upload = async (filePath, options) => {
      assert.strictEqual(filePath, tempFile);
      capturedFolder = options.folder;
      assert.strictEqual(options.resource_type, 'image');
      return {
        secure_url: mockSecureUrl,
        public_id: 'college-lost-found/items/mock-img',
      };
    };

    const mockFile = {
      path: tempFile,
      filename: path.basename(tempFile),
    };

    const resultUrl = await uploadImage(mockFile, 'college-lost-found/items');
    assert.strictEqual(resultUrl, mockSecureUrl);
    assert.strictEqual(capturedFolder, 'college-lost-found/items');

    // Verify temp file was cleaned up after successful Cloudinary upload
    assert.strictEqual(fs.existsSync(tempFile), false);
  });

  it('uploadImage should handle upload failures gracefully and clean up temp files', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'mock-cloud';
    process.env.CLOUDINARY_API_KEY = 'mock-key';
    process.env.CLOUDINARY_API_SECRET = 'mock-secret';

    const tempFile = path.join(os.tmpdir(), `test-fail-${Date.now()}.png`);
    fs.writeFileSync(tempFile, 'dummy-image-bytes');

    // Mock Cloudinary upload rejection
    cloudinary.uploader.upload = async () => {
      throw new Error('Connection refused to cloud storage');
    };

    const mockFile = {
      path: tempFile,
      filename: path.basename(tempFile),
    };

    await assert.rejects(
      async () => {
        await uploadImage(mockFile, 'college-lost-found/items');
      },
      (err) => {
        assert.strictEqual(err.message, 'Image upload failed. Please try again.');
        // Ensure no internal credentials leaked in error message
        assert.ok(!err.message.includes('mock-key'));
        assert.ok(!err.message.includes('mock-secret'));
        return true;
      }
    );

    // Verify temp file was cleaned up even after failure
    assert.strictEqual(fs.existsSync(tempFile), false);
  });

  it('uploadImage returns null when file is null or undefined', async () => {
    assert.strictEqual(await uploadImage(null), null);
    assert.strictEqual(await uploadImage(undefined), null);
  });
});

describe('Item Model & Existing Image URL Preservation', () => {
  const Item = require('../models/Item');

  it('should accept and store permanent HTTPS Cloudinary URLs in Item.image', () => {
    const cloudinaryUrl = 'https://res.cloudinary.com/apsit/image/upload/v179000/college-lost-found/items/laptop.jpg';
    const item = new Item({
      title: 'HP Laptop',
      category: 'Electronics',
      description: 'Lost in Computer Lab 3',
      location: 'Lab 3',
      date: new Date(),
      type: 'lost',
      image: cloudinaryUrl,
      reportedBy: '507f1f77bcf86cd799439011',
    });

    const error = item.validateSync();
    assert.strictEqual(error, undefined);
    assert.strictEqual(item.image, cloudinaryUrl);
  });

  it('should preserve existing external HTTPS image URLs unchanged', () => {
    const externalUrl = 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed';
    const item = new Item({
      title: 'Water Bottle',
      category: 'Other',
      description: 'Found near cafeteria',
      location: 'Cafeteria',
      date: new Date(),
      type: 'found',
      image: externalUrl,
      reportedBy: '507f1f77bcf86cd799439011',
    });

    const error = item.validateSync();
    assert.strictEqual(error, undefined);
    assert.strictEqual(item.image, externalUrl);
  });

  it('should preserve legacy /uploads/ relative paths for backward compatibility', () => {
    const legacyPath = '/uploads/1790928287894-85121559.png';
    const item = new Item({
      title: 'Scientific Calculator',
      category: 'Electronics',
      description: 'Found in Room 204',
      location: 'Room 204',
      date: new Date(),
      type: 'found',
      image: legacyPath,
      reportedBy: '507f1f77bcf86cd799439011',
    });

    const error = item.validateSync();
    assert.strictEqual(error, undefined);
    assert.strictEqual(item.image, legacyPath);
  });
});
