const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { validateFileSignature } = require('../utils/fileType');

const uploadDir = path.resolve(config.upload.path);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg', 'image/png',
];

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(uploadDir, '..', 'documents');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: config.upload.maxFileSize },
});

const uploadDocument = multer({
  storage: docStorage,
  fileFilter: (req, file, cb) => {
    cb(null, DOCUMENT_MIMES.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const validateMagicNumber = (req, res, next) => {
  if (!req.file) return next();
  try {
    const buffer = fs.readFileSync(req.file.path);
    if (!validateFileSignature(buffer, req.file.mimetype)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: 'Invalid image file. File content does not match its type.' });
    }
  } catch {
    return res.status(400).json({ success: false, message: 'Could not validate uploaded file.' });
  }
  next();
};

const validateDocumentSignature = (req, res, next) => {
  if (!req.file) return next();
  try {
    const buffer = fs.readFileSync(req.file.path);
    if (!validateFileSignature(buffer, req.file.mimetype)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: 'Invalid document file. File content does not match its declared type.' });
    }
  } catch {
    try { if (req.file && req.file.path) fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ success: false, message: 'Could not validate uploaded file.' });
  }
  next();
};

module.exports = upload;
module.exports.uploadDocument = uploadDocument;
module.exports.validateMagicNumber = validateMagicNumber;
module.exports.validateDocumentSignature = validateDocumentSignature;
