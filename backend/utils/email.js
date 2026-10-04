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

  const normalizedType = (itemType || 'lost').toLowerCase();
  const typeLabel = normalizedType === 'found' ? 'Found' : (normalizedType === 'recovery' ? 'Item Recovery' : 'Lost');
  const actionLabel = normalizedType === 'recovery' ? 'confirm your item recovery' : `submit your ${typeLabel} Item Report`;
  const subject = normalizedType === 'recovery'
    ? 'APSIT Lost & Found - Item Recovery Verification OTP'
    : `APSIT Lost & Found - ${typeLabel} Item Verification OTP`;
  const text = `Hello ${name || 'Student'},

Your 6-digit verification OTP code to ${actionLabel} is:

${otp}

This OTP is valid for 10 minutes. Please enter this code in the Lost & Found portal to confirm your request.

If you did not request this, please disregard this email.

Thank you,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching ${typeLabel} OTP email to recipient: ${email}`);
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
 * @param {Object} params - { ownerEmail, ownerName, itemName, finderName, finderEmail, finderPhone, finderMessage, proofImage }
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
  proofImage,
}) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const subject = `Someone Found Your Lost Item - ${itemName || 'Item'}`;
  const text = `Hello ${ownerName || 'Student'},

Someone has reported finding your lost item.

Item:
${itemName || 'Item'}

Found By:
${finderName || 'Student'}

Finder Message:
${finderMessage || 'No message provided'}

Finder Contact:
${finderEmail}
${finderPhone || 'Not provided'}

Finder Proof Photo:
${proofImage ? `[Attached / Inline Image: Finder Proof Photo]\nView Proof Photo: ${proofImage}` : '[No photo provided]'}

Thank you,
APSIT Lost & Found Management System`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 24px; text-align: center; color: #ffffff; }
    .header h2 { margin: 0; font-size: 20px; color: #ffffff; }
    .content { padding: 24px; }
    .field-label { font-weight: 700; color: #475569; margin-top: 14px; margin-bottom: 4px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-value { font-size: 15px; color: #0f172a; margin-bottom: 12px; }
    .proof-img { max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #cbd5e1; display: block; margin: 12px 0; object-fit: contain; }
    .fallback-link { display: inline-block; color: #4f46e5; text-decoration: underline; font-weight: 600; margin-top: 6px; }
    .footer { padding: 16px 24px; background: #f1f5f9; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Someone Found Your Lost Item</h2>
    </div>
    <div class="content">
      <p>Hello <strong>${ownerName || 'Student'}</strong>,</p>
      <p>Someone has reported finding your lost item.</p>

      <div class="field-label">Item:</div>
      <div class="field-value">${itemName || 'Item'}</div>

      <div class="field-label">Found By:</div>
      <div class="field-value">${finderName || 'Student'}</div>

      <div class="field-label">Finder Message:</div>
      <div class="field-value">${finderMessage || 'No message provided'}</div>

      <div class="field-label">Finder Contact:</div>
      <div class="field-value">
        <div>${finderEmail}</div>
        ${finderPhone ? `<div>${finderPhone}</div>` : ''}
      </div>

      <div class="field-label">Finder Proof Photo:</div>
      ${
        proofImage
          ? `<img src="cid:finderProofPhoto" alt="Finder Proof Photo" class="proof-img" />
             <div><a href="${proofImage}" target="_blank" rel="noopener noreferrer" class="fallback-link">View Proof Photo</a></div>`
          : '<div class="field-value">No photo provided</div>'
      }
    </div>
    <div class="footer">
      Thank you,<br/>
      APSIT Lost & Found Management System
    </div>
  </div>
</body>
</html>`;

  const attachments = [];
  if (proofImage) {
    attachments.push({
      filename: 'finder-proof-photo.jpg',
      path: proofImage,
      cid: 'finderProofPhoto',
    });
  }

  try {
    console.log(`[SMTP] Dispatching item found notification to owner: ${ownerEmail}`);
    const mailOptions = {
      from: getFromAddress(),
      to: ownerEmail,
      subject,
      text,
      html,
    };
    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await mailer.sendMail(mailOptions);
    console.log(`[SMTP] Item found notification sent successfully to: ${ownerEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver found notification to owner: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send polite notification to finder when the owner indicates it is not their item
 * @param {Object} params - { finderEmail, finderName, itemName }
 */
const sendFinderRejectionNotificationEmail = async ({
  finderEmail,
  finderName,
  itemName,
}) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const subject = `APSIT Lost & Found - Update regarding item "${itemName || 'Item'}"`;
  const text = `Hello ${finderName || 'Student'},

The owner of the lost item "${itemName || 'Item'}" has reviewed your finder report and confirmed that this is not their missing item.

Your finder report has been marked as rejected, and the item has returned to active search so other reports may be received.

Thank you for your honesty, effort, and willingness to help fellow students!

Best regards,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching finder report rejection notification to: ${finderEmail}`);
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: finderEmail,
      subject,
      text,
    });
    console.log(`[SMTP] Finder rejection notification sent successfully to: ${finderEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver finder rejection email to: ${finderEmail} | Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send email notification to lost item owner upon admin approval/resolution
 * @param {Object} params - { ownerEmail, ownerName, itemName, finderName, resolutionDate }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendOwnerResolutionEmail = async ({
  ownerEmail,
  ownerName,
  itemName,
  finderName,
  resolutionDate,
}) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const safeItemName = itemName || 'Item';
  const formattedDate = resolutionDate
    ? new Date(resolutionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const subject = `Lost Item Recovery Verified - ${safeItemName}`;
  const text = `Hello ${ownerName || 'Student'},

The administrator has verified the recovery of your lost item.

Resolution Details:
- Owner Name: ${ownerName || 'Student'}
- Item Name: ${safeItemName}
- Final Finder: ${finderName || 'Student'}
- Claim Status: Resolved
- Resolution Date: ${formattedDate}

An administrator has reviewed and officially verified this recovery. If you have not yet collected your item, please coordinate with the finder or visit the college administration / security desk to complete any final handover procedures.

Thank you for using the APSIT Lost & Found Management System!

Best regards,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching owner recovery resolution email to: ${ownerEmail}`);
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: ownerEmail,
      subject,
      text,
    });
    console.log(`[SMTP] Owner resolution email sent successfully to: ${ownerEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver owner resolution email to: ${ownerEmail} | Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send email notification to final finder upon admin approval/resolution
 * @param {Object} params - { finderEmail, finderName, itemName, resolutionDate }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendFinderResolutionEmail = async ({
  finderEmail,
  finderName,
  itemName,
  resolutionDate,
}) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const safeItemName = itemName || 'Item';
  const formattedDate = resolutionDate
    ? new Date(resolutionDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const subject = `Found Item Report Verified - ${safeItemName}`;
  const text = `Hello ${finderName || 'Student'},

The administrator has verified the recovery of the item you reported.

Resolution Details:
- Finder Name: ${finderName || 'Student'}
- Item Name: ${safeItemName}
- Claim Status: Resolved
- Resolution Date: ${formattedDate}

An administrator has officially reviewed and verified this recovery. Thank you for your honesty, cooperation, and dedication to helping your fellow students!

Best regards,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching finder report resolution email to: ${finderEmail}`);
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: finderEmail,
      subject,
      text,
    });
    console.log(`[SMTP] Finder resolution email sent successfully to: ${finderEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver finder resolution email to: ${finderEmail} | Error: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Send email notification to authenticated lost item owner upon self-recovery ("I Got My Item Back")
 * @param {Object} params - { ownerEmail, ownerName, itemName, recoveryDate }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendOwnerSelfRecoveryEmail = async ({
  ownerEmail,
  ownerName,
  itemName,
  recoveryDate,
}) => {
  const mailer = getTransporter();
  if (!mailer) {
    const errorMsg = 'SMTP credentials not configured in backend .env';
    console.error(`[SMTP] Send aborted: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  const safeItemName = itemName || 'Item';
  const safeOwnerName = ownerName || 'Student';
  const formattedDate = recoveryDate
    ? new Date(recoveryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

  const subject = `Your Lost Item Has Been Recovered - ${safeItemName}`;
  const text = `Hello ${safeOwnerName},

We are pleased to confirm that you have reported finding your own lost item.

Recovery Details:
- Owner Name: ${safeOwnerName}
- Item Name: ${safeItemName}
- Recovery Type: Owner Found Item
- Status: Resolved
- Recovery Date: ${formattedDate}

Confirmation:
- You have confirmed that you recovered your own lost item through the College Lost & Found portal with 6-digit OTP verification.
- Your item "${safeItemName}" has been directly marked as Resolved without requiring administrator approval.

Thank you for keeping our college campus community updated!

Best regards,
APSIT Lost & Found Management System`;

  try {
    console.log(`[SMTP] Dispatching owner self-recovery email to: ${ownerEmail}`);
    const info = await mailer.sendMail({
      from: getFromAddress(),
      to: ownerEmail,
      subject,
      text,
    });
    console.log(`[SMTP] Owner self-recovery email sent successfully to: ${ownerEmail} | MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP] Failed to deliver owner self-recovery email to: ${ownerEmail} | Error: ${error.message}`);
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
  sendFinderRejectionNotificationEmail,
  sendOwnerResolutionEmail,
  sendFinderResolutionEmail,
  sendOwnerSelfRecoveryEmail,
};
