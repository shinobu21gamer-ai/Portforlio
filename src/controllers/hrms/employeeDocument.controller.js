const path = require('path');
const fs = require('fs');
const db = require('../../models');
const { sendSuccess } = require('../../utils/response');
const ApiError = require('../../utils/ApiError');
const config = require('../../config');

const resolveDocumentFile = (doc) => {
  const candidates = [
    path.resolve(config.upload.path, '..', 'documents', doc.filename),
    path.resolve(config.upload.path, 'resumes', doc.filename),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
};

class EmployeeDocumentController {
  async list(req, res, next) {
    try {
      const { employeeId } = req.params;
      const where = { employeeId };
      if (req.query.type) where.type = req.query.type;
      const docs = await db.EmployeeDocument.findAll({
        where,
        include: [{ model: db.User, as: 'uploader', attributes: ['id', 'firstName', 'lastName'] }],
        order: [['createdAt', 'DESC']],
      });
      sendSuccess(res, docs);
    } catch (e) { next(e); }
  }

  async upload(req, res, next) {
    try {
      if (!req.file) throw ApiError.badRequest('No file uploaded');
      const doc = await db.EmployeeDocument.create({
        employeeId: req.params.employeeId,
        type: req.body.type || 'other',
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user.id,
        notes: req.body.notes || null,
      });
      sendSuccess(res, doc, 'Uploaded', 201);
    } catch (e) {
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
      next(e);
    }
  }

  async download(req, res, next) {
    try {
      const doc = await db.EmployeeDocument.findByPk(req.params.id);
      if (!doc) throw ApiError.notFound('Document not found');
      const filePath = resolveDocumentFile(doc);
      if (!filePath) throw ApiError.notFound('File not found on disk');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName}"`);
      res.setHeader('Content-Type', doc.mimeType);
      fs.createReadStream(filePath).pipe(res);
    } catch (e) { next(e); }
  }

  async delete(req, res, next) {
    try {
      const doc = await db.EmployeeDocument.findByPk(req.params.id);
      if (!doc) throw ApiError.notFound('Document not found');
      const filePath = resolveDocumentFile(doc);
      try { if (filePath) fs.unlinkSync(filePath); } catch {}
      await doc.destroy();
      sendSuccess(res, null, 'Deleted');
    } catch (e) { next(e); }
  }
}

module.exports = new EmployeeDocumentController();
