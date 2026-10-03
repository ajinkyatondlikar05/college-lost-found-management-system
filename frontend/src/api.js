import axios from 'axios';

// In production builds (e.g. Vercel deployment), use relative '/api' so requests proxy same-origin.
// In local development, respect VITE_API_URL if configured, falling back to '/api'.
const isProd = typeof import.meta !== 'undefined' && import.meta.env && Boolean(import.meta.env.PROD);

const rawApiUrl = (!isProd && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL.trim()
  : '';

const getBaseURL = () => {
  if (isProd || !rawApiUrl) return '/api';
  const trimmed = rawApiUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const API = axios.create({
  baseURL: getBaseURL(),
});

/**
 * Converts a stored image path into the appropriate absolute or relative URL.
 * - If already a full URL (http://, https://, or data:), returns it directly.
 * - Normalizes Windows backslashes and ensures a clean leading slash.
 * - When an API base URL is configured, resolves relative '/uploads/...' against the backend origin.
 * - When not configured, preserves relative '/uploads/...' for Vite proxy, Docker Nginx proxy, and Vercel rewrites.
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return '';
  if (/^(?:https?:|\/\/|data:)/i.test(imagePath.trim())) return imagePath.trim();

  const normalized = imagePath.trim().replace(/\\/g, '/');
  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;

  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL.trim()
    : '';

  const apiBase = API?.defaults?.baseURL;
  const rawUrl = envUrl || (/^https?:\/\//i.test(apiBase || '') ? apiBase : '');

  if (rawUrl) {
    const backendOrigin = rawUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    return `${backendOrigin}${cleanPath}`;
  }

  return cleanPath;
};

// Attach JWT token to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const register = (data) => API.post('/auth/register', data);
export const login = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');

// Items
export const getAllItems = (params) => API.get('/items', { params });
export const getItemById = (id) => API.get(`/items/${id}`);
export const createItem = (data) => API.post('/items', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const updateItem = (id, data) => API.put(`/items/${id}`, data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const deleteItem = (id) => API.delete(`/items/${id}`);
export const recoverItem = (id) => API.put(`/items/${id}/recover`);
export const getMyReports = () => API.get('/items/user/my-reports');
export const sendReportOtp = (data) => API.post('/items/send-report-otp', data);
export const verifyReportOtp = (data) => API.post('/items/verify-report-otp', data);

// Admin / Users
export const getAllUsers = () => API.get('/users');
export const getAdminStats = () => API.get('/users/stats');
export const updateUserRole = (id, role) => API.put(`/users/${id}/role`, { role });
export const approveUser = (id) => API.put(`/users/${id}/approve`);
export const rejectUser = (id) => API.put(`/users/${id}/reject`);
export const deleteUser = (id) => API.delete(`/users/${id}`);

// Categories
export const getCategories = () => API.get('/categories');
export const createCategory = (data) => API.post('/categories', data);
export const updateCategory = (id, data) => API.put(`/categories/${id}`, data);
export const deleteCategory = (id) => API.delete(`/categories/${id}`);

// Claims
export const getClaims = (params) => API.get('/claims', { params });
export const getClaimById = (id) => API.get(`/claims/${id}`);
export const createClaim = (data) => API.post('/claims', data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const updateClaimStatus = (id, status) => API.put(`/claims/${id}/status`, { status });
export const updateClaim = (id, data) => API.put(`/claims/${id}`, data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const deleteClaim = (id) => API.delete(`/claims/${id}`);

// Admin Panel Analytics & Notifications & Admins
export const getAdminAnalytics = () => API.get('/admin/analytics');
export const getAdminNotifications = () => API.get('/admin/notifications');
export const getAdminList = () => API.get('/admin/admins');
export const createAdminUser = (data) => API.post('/admin/admins', data);
export const updateAdminUser = (id, data) => API.put(`/admin/admins/${id}`, data);
export const deleteAdminUser = (id) => API.delete(`/admin/admins/${id}`);

export default API;
