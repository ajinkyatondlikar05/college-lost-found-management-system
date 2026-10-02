const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Student College Email Format Validation', () => {
  const collegeEmailRegex = /^[0-9]+@apsit\.edu\.in$/i;

  it('should accept valid student numeric email addresses', () => {
    const validEmails = [
      '24107068@apsit.edu.in',
      '21102001@apsit.edu.in',
      '19100001@apsit.edu.in',
      '99999999@apsit.edu.in',
    ];

    for (const email of validEmails) {
      assert.strictEqual(
        collegeEmailRegex.test(email),
        true,
        `Expected ${email} to be a valid student college email`
      );
    }
  });

  it('should accept valid student emails regardless of casing', () => {
    const mixedCaseEmails = [
      '24107068@APSIT.EDU.IN',
      '24107068@Apsit.Edu.In',
      '24107068@Apsit.edu.in',
    ];

    for (const email of mixedCaseEmails) {
      assert.strictEqual(
        collegeEmailRegex.test(email),
        true,
        `Expected ${email} to match case-insensitively`
      );
    }
  });

  it('should reject non-student or non-APSIT email domains', () => {
    const invalidEmails = [
      'student@gmail.com',
      'student@yahoo.com',
      'student@outlook.com',
      '24107068@othercollege.edu.in',
      '24107068@apsit.ac.in',
      '24107068@apsit.org',
    ];

    for (const email of invalidEmails) {
      assert.strictEqual(
        collegeEmailRegex.test(email),
        false,
        `Expected ${email} to be rejected`
      );
    }
  });

  it('should reject non-numeric student usernames', () => {
    const invalidFormatEmails = [
      'admin@apsit.edu.in',
      'john.doe@apsit.edu.in',
      'student2410@apsit.edu.in',
      '2410a7068@apsit.edu.in',
      '@apsit.edu.in',
    ];

    for (const email of invalidFormatEmails) {
      assert.strictEqual(
        collegeEmailRegex.test(email),
        false,
        `Expected ${email} with non-numeric prefix to be rejected`
      );
    }
  });

  it('should reject malformed or empty inputs', () => {
    const malformed = ['', '   ', 'invalid-email', '24107068', '24107068@apsit'];
    for (const email of malformed) {
      assert.strictEqual(collegeEmailRegex.test(email), false);
    }
  });

  it('should correctly extract studentId from valid student email', () => {
    const email = '24107068@apsit.edu.in';
    const studentId = email.split('@')[0];
    assert.strictEqual(studentId, '24107068');
  });
});
