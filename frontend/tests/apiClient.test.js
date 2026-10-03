import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import API, {
  register,
  login,
  getMe,
  getAllItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getMyReports,
  sendReportOtp,
  verifyReportOtp,
  getAllUsers,
  getAdminStats,
  updateUserRole,
  approveUser,
  rejectUser,
  deleteUser,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getClaims,
  getClaimById,
  createClaim,
  updateClaimStatus,
  updateClaim,
  deleteClaim,
  getAdminAnalytics,
  getAdminNotifications,
  getAdminList,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getImageUrl,
} from '../src/api.js';

describe('Frontend API Client Configuration & Endpoints', () => {
  it('should initialize Axios instance with base URL /api', () => {
    assert.ok(API);
    assert.strictEqual(API.defaults.baseURL, '/api');
  });

  it('should export getImageUrl and resolve image URLs properly', () => {
    assert.strictEqual(typeof getImageUrl, 'function');
    assert.strictEqual(getImageUrl(''), '');
    assert.strictEqual(getImageUrl('/uploads/sample.png'), '/uploads/sample.png');
    assert.strictEqual(getImageUrl('https://example.com/photo.jpg'), 'https://example.com/photo.jpg');
  });

  it('should export all authentication API methods', () => {
    assert.strictEqual(typeof register, 'function');
    assert.strictEqual(typeof login, 'function');
    assert.strictEqual(typeof getMe, 'function');
  });

  it('should export all item and reporting API methods', () => {
    assert.strictEqual(typeof getAllItems, 'function');
    assert.strictEqual(typeof getItemById, 'function');
    assert.strictEqual(typeof createItem, 'function');
    assert.strictEqual(typeof updateItem, 'function');
    assert.strictEqual(typeof deleteItem, 'function');
    assert.strictEqual(typeof getMyReports, 'function');
    assert.strictEqual(typeof sendReportOtp, 'function');
    assert.strictEqual(typeof verifyReportOtp, 'function');
  });

  it('should export all user management API methods', () => {
    assert.strictEqual(typeof getAllUsers, 'function');
    assert.strictEqual(typeof getAdminStats, 'function');
    assert.strictEqual(typeof updateUserRole, 'function');
    assert.strictEqual(typeof approveUser, 'function');
    assert.strictEqual(typeof rejectUser, 'function');
    assert.strictEqual(typeof deleteUser, 'function');
  });

  it('should export all category and claim API methods', () => {
    assert.strictEqual(typeof getCategories, 'function');
    assert.strictEqual(typeof createCategory, 'function');
    assert.strictEqual(typeof updateCategory, 'function');
    assert.strictEqual(typeof deleteCategory, 'function');
    assert.strictEqual(typeof getClaims, 'function');
    assert.strictEqual(typeof getClaimById, 'function');
    assert.strictEqual(typeof createClaim, 'function');
    assert.strictEqual(typeof updateClaimStatus, 'function');
    assert.strictEqual(typeof updateClaim, 'function');
    assert.strictEqual(typeof deleteClaim, 'function');
  });

  it('should export all admin analytics and notification methods', () => {
    assert.strictEqual(typeof getAdminAnalytics, 'function');
    assert.strictEqual(typeof getAdminNotifications, 'function');
    assert.strictEqual(typeof getAdminList, 'function');
    assert.strictEqual(typeof createAdminUser, 'function');
    assert.strictEqual(typeof updateAdminUser, 'function');
    assert.strictEqual(typeof deleteAdminUser, 'function');
  });
});
