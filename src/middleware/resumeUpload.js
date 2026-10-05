const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { validateFileSignature } = require('../utils/fileType');

const resumeDir = path.join(path.resolve(config.upload.base), 'resumes');
if (!fs.existsSync(resumeDir)) {
  fs.mkdirSync(resumeDir, { recursive: true });
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
