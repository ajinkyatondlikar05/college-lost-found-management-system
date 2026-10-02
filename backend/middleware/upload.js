const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Detect Vercel serverless environment
const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);

// In Vercel serverless functions, the root task directory (/var/task) is read-only.
// Only /tmp is writable for temporary file storage during function execution.
// For local and Docker environments, preserve the standard backend/uploads directory.
// NOTE: Files in /tmp on Vercel are temporary and ephemeral; they will NOT persist
// across serverless instance lifecycles. Persistent cloud storage is needed for production.
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../uploads');

// Ensure directory exists safely without crashing module load on read-only filesystems
function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (err) {
      console.warn(`[Uploads] Could not create uploads directory at ${uploadsDir}:`, err.message);
    }
  }
  return uploadsDir;
}

// In local / Docker development, attempt directory creation on load if writable
if (!isVercel) {
  ensureUploadsDir();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const targetDir = ensureUploadsDir();
      cb(null, targetDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const extname = allowed.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowed.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png, webp) are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

module.exports = upload;
