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

  it('owner email contains item + finder + resolution information', async () => {
    const res = await emailModule.sendOwnerResolutionEmail({
      ownerEmail: '24107010@apsit.edu.in',
      ownerName: 'Rahul Sharma',
      itemName: 'Wireless Earbuds',
      finderName: 'Priya Patel',
      resolutionDate: new Date('2026-10-04T10:00:00Z'),
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107010@apsit.edu.in');
    assert.strictEqual(lastMail.subject, 'Lost Item Recovery Verified - Wireless Earbuds');
    assert.ok(lastMail.text.includes('Rahul Sharma'));
    assert.ok(lastMail.text.includes('Wireless Earbuds'));
    assert.ok(lastMail.text.includes('Priya Patel'));
    assert.ok(lastMail.text.includes('Claim Status: Resolved'));
    assert.ok(lastMail.text.includes('Resolution Date:'));
    assert.ok(lastMail.text.includes('verified'));
    assert.ok(lastMail.text.includes('administrator'));
  });

  it('finder email contains item + resolution information', async () => {
    const res = await emailModule.sendFinderResolutionEmail({
      finderEmail: '24107011@apsit.edu.in',
      finderName: 'Priya Patel',
      itemName: 'Wireless Earbuds',
      resolutionDate: new Date('2026-10-04T10:00:00Z'),
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107011@apsit.edu.in');
    assert.strictEqual(lastMail.subject, 'Found Item Report Verified - Wireless Earbuds');
    assert.ok(lastMail.text.includes('Priya Patel'));
    assert.ok(lastMail.text.includes('Wireless Earbuds'));
    assert.ok(lastMail.text.includes('Claim Status: Resolved'));
    assert.ok(lastMail.text.includes('Resolution Date:'));
    assert.ok(lastMail.text.includes('verified'));
    assert.ok(lastMail.text.includes('administrator'));
  });

  it('owner self-recovery sends owner email with item name and resolved status', async () => {
    const res = await emailModule.sendOwnerSelfRecoveryEmail({
      ownerEmail: '24107001@apsit.edu.in',
      ownerName: 'Rahul Sharma',
      itemName: 'Casio Scientific Calculator',
      recoveryDate: new Date('2026-10-04T12:00:00Z'),
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107001@apsit.edu.in');
    assert.strictEqual(lastMail.subject, 'Your Lost Item Has Been Recovered - Casio Scientific Calculator');
    assert.ok(lastMail.text.includes('Rahul Sharma'));
    assert.ok(lastMail.text.includes('Casio Scientific Calculator'));
    assert.ok(lastMail.text.includes('Recovery Type: Owner Found Item'));
    assert.ok(lastMail.text.includes('Status: Resolved'));
    assert.ok(lastMail.text.includes('Recovery Date:'));
    assert.ok(lastMail.text.includes('finding your own lost item'));
    assert.ok(lastMail.text.includes('directly marked as Resolved'));
  });

  it('sendItemFoundNotificationEmail should format owner notification with proof image attachment, CID, and fallback link', async () => {
    const proofUrl = 'https://res.cloudinary.com/apsit/image/upload/v12345/calculator_proof.jpg';
    const res = await emailModule.sendItemFoundNotificationEmail({
      ownerEmail: '24107001@apsit.edu.in',
      ownerName: 'Rahul Sharma',
      itemName: 'Casio Scientific Calculator',
      finderName: 'Priya Patel',
      finderEmail: '24107002@apsit.edu.in',
      finderPhone: '9123456780',
      finderMessage: 'I found your calculator in Room 402 on table 3.',
      proofImage: proofUrl,
    });
    assert.strictEqual(res.success, true);

    const lastMail = sentEmails[sentEmails.length - 1];
    assert.strictEqual(lastMail.to, '24107001@apsit.edu.in');
    assert.strictEqual(lastMail.subject, 'Someone Found Your Lost Item - Casio Scientific Calculator');
    assert.ok(lastMail.text.includes('Rahul Sharma'));
    assert.ok(lastMail.text.includes('Casio Scientific Calculator'));
    assert.ok(lastMail.text.includes('Priya Patel'));
    assert.ok(lastMail.text.includes('I found your calculator in Room 402 on table 3.'));
    assert.ok(lastMail.text.includes('24107002@apsit.edu.in'));
    assert.ok(lastMail.text.includes('9123456780'));
    assert.ok(lastMail.text.includes(proofUrl));

    // Inline image and attachment verification
    assert.ok(Array.isArray(lastMail.attachments));
    assert.strictEqual(lastMail.attachments.length, 1);
    assert.strictEqual(lastMail.attachments[0].cid, 'finderProofPhoto');
    assert.strictEqual(lastMail.attachments[0].filename, 'finder-proof-photo.jpg');
    assert.strictEqual(lastMail.attachments[0].path, proofUrl);

    // HTML inline image and fallback link verification
    assert.ok(lastMail.html.includes('src="cid:finderProofPhoto"'));
    assert.ok(lastMail.html.includes(`href="${proofUrl}"`));
    assert.ok(lastMail.html.includes('View Proof Photo'));
  });
});
