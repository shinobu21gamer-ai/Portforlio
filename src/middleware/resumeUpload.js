const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { ensureDir } = require('../utils/storage');
const { validateFileSignature } = require('../utils/fileType');

// Derived from the boot-verified uploads base (src/utils/storage.js) and created
// best-effort: this module is loaded during server boot, so a throwing mkdir on
// an unwritable volume would take the whole deploy down (it did: EACCES on
// /data/uploads/products for Render instances without a persistent disk).
const resumeDir = path.join(path.resolve(config.upload.base), 'resumes');
if (!fs.existsSync(resumeDir) && !ensureDir(resumeDir)) {
  console.warn(
    `[STORAGE] Resume directory ${resumeDir} could not be created. ` +
    'Job-application uploads will fail until that volume is writable.'
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumeDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, DOCX, JPEG, PNG files are allowed'), false);
  }
};

const resumeUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const validateResumeSignature = (req, res, next) => {
  if (!req.file) return next();
  try {
    const buffer = fs.readFileSync(req.file.path);
    if (!validateFileSignature(buffer, req.file.mimetype)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: 'Invalid resume file. File content does not match its declared type.' });
    }
  } catch {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ success: false, message: 'Could not validate uploaded file.' });
  }
  next();
};

module.exports = resumeUpload;
module.exports.validateResumeSignature = validateResumeSignature;
