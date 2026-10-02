const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');

describe('Email Notification Service (Mocked Transporter)', () => {
  let originalCreateTransport;
  let originalEmailUser;
  let originalEmailPass;
  let sentEmails = [];
  let emailModule;

  before(() => {
    sentEmails = [];
    originalEmailUser = process.env.EMAIL_USER;
    originalEmailPass = process.env.EMAIL_PASSWORD;

    // Use dummy mock env vars for testing (no real credentials)
    process.env.EMAIL_USER = 'mock_service@apsit.edu.in';
    process.env.EMAIL_PASSWORD = 'mock_dummy_password';

    originalCreateTransport = nodemailer.createTransport;

    // Mock nodemailer transport to prevent any real network calls
    nodemailer.createTransport = () => ({
      verify: async () => true,
      sendMail: async (options) => {
        sentEmails.push(options);
        return { messageId: '<mock-msg-id-12345>' };
      },
    });

    // Require fresh email module with mocked nodemailer
    delete require.cache[require.resolve('../utils/email')];
    emailModule = require('../utils/email');
  });

  after(() => {
    process.env.EMAIL_USER = originalEmailUser;
    process.env.EMAIL_PASSWORD = originalEmailPass;
    nodemailer.createTransport = originalCreateTransport;
    delete require.cache[require.resolve('../utils/email')];
  });

  it('sendOtpEmail should format lost item OTP notification correctly', async () => {
    const res = await emailModule.sendOtpEmail('24107068@apsit.edu.in', 'Ajinkya', '654321', 'lost');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.messageId, '<mock-msg-id-12345>');

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107068@apsit.edu.in');
    assert.ok(lastMail.subject.includes('Lost Item Verification OTP'));
    assert.ok(lastMail.text.includes('654321'));
    assert.ok(lastMail.text.includes('APSIT Lost & Found'));
  });

  it('sendOtpEmail should format found item OTP notification correctly', async () => {
    const res = await emailModule.sendOtpEmail('24107068@apsit.edu.in', 'Ajinkya', '112233', 'found');
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.ok(lastMail.subject.includes('Found Item Verification OTP'));
    assert.ok(lastMail.text.includes('112233'));
  });

  it('sendApprovalEmail should format account approval message', async () => {
    const res = await emailModule.sendApprovalEmail({
      name: 'John Student',
      email: '24107000@apsit.edu.in',
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107000@apsit.edu.in');
    assert.ok(lastMail.subject.includes('Account Approved'));
    assert.ok(lastMail.text.includes('John Student'));
  });

  it('sendRejectionEmail should format account rejection message', async () => {
    const res = await emailModule.sendRejectionEmail({
      name: 'Jane Student',
      email: '24107001@apsit.edu.in',
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107001@apsit.edu.in');
    assert.ok(lastMail.subject.includes('Account Registration Update'));
  });

  it('sendClaimStatusEmail should format approved claim notification', async () => {
    const res = await emailModule.sendClaimStatusEmail({
      fullName: 'Alice Walker',
      email: '24107002@apsit.edu.in',
      itemName: 'Blue Umbrella',
      status: 'approved',
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107002@apsit.edu.in');
    assert.ok(lastMail.subject.includes('Approved'));
    assert.ok(lastMail.text.includes('Blue Umbrella'));
  });
});
