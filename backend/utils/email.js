const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Create Nodemailer transporter from environment variables.
 * Supports EMAIL_* and SMTP_* naming conventions.
 */
const createTransporter = () => {
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || '').trim();
  // Strip spaces and quotes if user pasted in 4x4 format or quoted
  const pass = rawPass.replace(/["'\s]/g, '');

  if (!user || !pass) {
    return null;
  }

  const host = (process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.EMAIL_PORT || process.env.SMTP_PORT) || 465;
  const secureEnv = process.env.EMAIL_SECURE !== undefined ? process.env.EMAIL_SECURE : process.env.SMTP_SECURE;
  const secure = secureEnv !== undefined ? (secureEnv === 'true' || secureEnv === true) : (port === 465);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

const getFromAddress = () => {
  const from = (process.env.EMAIL_FROM || '').trim();
  if (from) {
    return from.includes('<') ? from : `"APSIT Lost & Found" <${from}>`;
  }
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  if (user) {
    return `"APSIT Lost & Found" <${user}>`;
  }
  return '"APSIT Lost & Found" <lostandfound.apsit@gmail.com>';
};

/**
 * Verify transporter connection with the SMTP server
 */
const verifyEmailTransporter = async () => {
  // Reset transporter instance to pick up fresh env vars if any
  transporter = createTransporter();

  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const host = (process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com').trim();

  if (!transporter) {
    const errorMsg = 'EMAIL_USER or EMAIL_PASSWORD not set in backend .env';
    console.error(`[SMTP] Verification failed: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    console.log(`[SMTP] Verifying connection to ${host} as ${user}...`);
    await transporter.verify();
    console.log(`[SMTP] Connection established and verified successfully with ${host}!`);
    return { success: true };
  } catch (error) {
    console.error(`[SMTP] Connection failed: Code=${error.code || 'UNKNOWN'} | Message=${error.message}`);
    return { success: false, error: error.message, code: error.code };
  }
};

/**
 * Send account approval email
 * @param {Object} student - { name, email }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendApprovalEmail = async (student) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env (EMAIL_USER / EMAIL_PASSWORD missing)';
    console.error(`Email sending failed:\nTO = ${student?.email}\nERROR = ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const subject = 'APSIT Lost & Found - Account Approved';
  const text = `Hello ${student.name},

Your APSIT Lost & Found account has been approved by the administrator.

Your account is now active.

You can now log in using your official APSIT college email:

${student.email}

You can now access the College Lost & Found Management System.

Thank you,
APSIT Lost & Found Management System`;

  try {
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: student.email,
      subject,
      text,
    });

    console.log(`Approval email:\nTO = ${student.email}\nRESULT = SUCCESS\nMESSAGE_ID = ${info.messageId}`);
    return { success: true, messageId: info.messageId, info };
  } catch (error) {
    console.error(`Email sending failed:\nTO = ${student.email}\nERROR = ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send account rejection email
 * @param {Object} student - { name, email }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendRejectionEmail = async (student) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env (EMAIL_USER / EMAIL_PASSWORD missing)';
    console.error(`Email sending failed:\nTO = ${student?.email}\nERROR = ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const subject = 'APSIT Lost & Found - Account Registration Update';
  const text = `Hello ${student.name},

Your APSIT Lost & Found account registration has been rejected by the administrator.

Your account cannot currently be used to access the system.

If you believe this was a mistake, please contact the administrator.

Thank you,
APSIT Lost & Found Management System`;

  try {
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: student.email,
      subject,
      text,
    });

    console.log(`Rejection email:\nTO = ${student.email}\nRESULT = SUCCESS\nMESSAGE_ID = ${info.messageId}`);
    return { success: true, messageId: info.messageId, info };
  } catch (error) {
    console.error(`Email sending failed:\nTO = ${student.email}\nERROR = ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP verification email for item reporting (Lost or Found)
 * @param {string} email
 * @param {string} name
 * @param {string} otp
 * @param {string} [itemType='lost']
 */
const sendOtpEmail = async (email, name, otp, itemType = 'lost') => {
  const mailer = getTransporter();
  const fromAddress = getFromAddress();

  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const typeLabel = (itemType || 'lost').toLowerCase() === 'found' ? 'Found' : 'Lost';
  const subject = `APSIT Lost & Found - ${typeLabel} Item Verification OTP`;
  const text = `Hello ${name || 'Student'},

Your 6-digit verification OTP code to submit your ${typeLabel} Item Report is:

${otp}

This OTP is valid for 10 minutes. Please enter this code in the Lost & Found portal to confirm your report.

If you did not request this, please disregard this email.

Thank you,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching ${typeLabel} Item OTP email to recipient: ${email}`);
    const info = await mailer.sendMail({
      from: fromAddress,
      to: email,
      subject,
      text,
    });

    console.log(`[SMTP] OTP email sent successfully to: ${email} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver OTP email to: ${email} | Code: ${error.code || 'UNKNOWN'} | Message: ${error.message}`);
    return { success: false, error: error.message, code: error.code };
  }
};

/**
 * Send claim status email notification
 * @param {Object} claim - { fullName, email, itemName, status }
 */
const sendClaimStatusEmail = async (claim) => {
  const mailer = getTransporter();
  if (!mailer) return { success: false, error: 'SMTP not configured' };

  const isApproved = claim.status === 'approved';
  const subject = `APSIT Lost & Found - Claim Request ${isApproved ? 'Approved' : 'Update'}`;
  const text = `Hello ${claim.fullName || 'Student'},

Your claim request for the item "${claim.itemName || 'Item'}" has been ${isApproved ? 'APPROVED' : 'REJECTED'} by the administrator.

${
  isApproved
    ? 'Please visit the college administration / security desk to collect or verify your item.'
    : 'If you believe this was a mistake, please contact the administrator.'
}

Thank you,
APSIT Lost & Found Management System`;

  try {
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: claim.email,
      subject,
      text,
    });
    console.log(`Claim status email sent:\nTO = ${claim.email}\nSTATUS = ${claim.status}\nMESSAGE_ID = ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Claim status email failed:\nTO = ${claim.email}\nERROR = ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send email notification to lost-item owner when another student reports finding it
 * @param {Object} params - { ownerEmail, ownerName, itemName, finderName, finderEmail, finderPhone, finderMessage }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendItemFoundNotificationEmail = async ({
  ownerEmail,
  ownerName,
  itemName,
  finderName,
  finderEmail,
  finderPhone,
  finderMessage,
}) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const subject = `APSIT Lost & Found - Good News! Your lost item "${itemName || 'Item'}" has been found!`;
  const text = `Hello ${ownerName || 'Student'},

Great news! Another student, ${finderName || 'A Student'}, has reported finding your lost item: "${itemName || 'Item'}".

Finder Details:
- Name: ${finderName || 'Student'}
- Email: ${finderEmail}
- Phone: ${finderPhone || 'Not provided'}
${finderMessage ? `- Message from Finder: "${finderMessage}"\n` : ''}
How to proceed:
1. Please contact ${finderName || 'the student'} directly via email (${finderEmail})${finderPhone ? ` or phone (${finderPhone})` : ''} to coordinate the return and verify ownership.
2. Once you have successfully recovered your item, log in to the College Lost & Found portal and click "I Got My Item Back" on your report to close and resolve the report.

Thank you,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching item found notification to owner: ${ownerEmail}`);
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: ownerEmail,
      subject,
      text,
    });
    console.log(`[SMTP] Item found notification sent successfully to: ${ownerEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver found notification to: ${ownerEmail} | Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = {
  verifyEmailTransporter,
  sendApprovalEmail,
  sendRejectionEmail,
  sendOtpEmail,
  sendClaimStatusEmail,
  sendItemFoundNotificationEmail,
};
