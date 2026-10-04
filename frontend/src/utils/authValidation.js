/**
 * Authentication and email validation utilities for College Lost & Found System
 */

// Permanent production / demo account email exception
export const PERMANENT_DEMO_EMAIL = 'ajinkyatondlikar@gmail.com';

// Official student college email pattern: numeric student ID + @apsit.edu.in
export const COLLEGE_STUDENT_EMAIL_REGEX = /^[0-9]+@apsit\.edu\.in$/i;

/**
 * Validates whether an email is allowed for User Login and Registration:
 * 1. Explicitly allows the permanent demo account (ajinkyatondlikar@gmail.com).
 * 2. Allows any configured demo email from environment variables (e.g. VITE_DEMO_LOGIN_EMAIL / VITE_TEMP_TEST_LOGIN_EMAIL).
 * 3. Enforces that normal student emails must strictly match /^[0-9]+@apsit\.edu\.in$/i.
 * 4. Rejects all other Gmail or personal email addresses.
 *
 * @param {string} email
 * @returns {boolean}
 */
export const isAllowedUserEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  // 1. Explicit permanent approved demo account
  if (normalized === PERMANENT_DEMO_EMAIL) {
    return true;
  }

  // 2. Configured demo email via environment variables
  try {
    const envDemo = (
      typeof import.meta !== 'undefined' && import.meta?.env
        ? (import.meta.env.VITE_DEMO_LOGIN_EMAIL || import.meta.env.VITE_TEMP_TEST_LOGIN_EMAIL || '')
        : ''
    ).trim().toLowerCase();

    if (envDemo && normalized === envDemo) {
      return true;
    }
  } catch {
    // Ignore environments where import.meta is unavailable
  }

  // 3. Normal student emails must strictly match numeric APSIT format
  return COLLEGE_STUDENT_EMAIL_REGEX.test(normalized);
};

/**
 * Validates whether an email is allowed for Login (handles Admin vs User)
 * - Admin emails: admin@apsit.edu.in or starts with 'admin'
 * - Student / User emails: validated via isAllowedUserEmail
 *
 * @param {string} email
 * @param {boolean} isAdmin
 * @returns {boolean}
 */
export const isAllowedLoginEmail = (email, isAdmin = false) => {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  if (isAdmin) {
    return normalized.endsWith('@apsit.edu.in') || normalized.startsWith('admin');
  }

  // If user portal, also allow admin accounts if typed in general login page
  if (normalized.startsWith('admin') && normalized.endsWith('@apsit.edu.in')) {
    return true;
  }

  return isAllowedUserEmail(normalized);
};
