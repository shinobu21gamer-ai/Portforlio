const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { JobPosting, JobApplication, Notification, User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const resumeUpload = require('../../middleware/resumeUpload');
const { validateResumeSignature } = resumeUpload;
const { sanitizeObject, escapeLike } = require('../../utils/helpers');

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many applications, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/v1/public/settings - Brand-safe store info for the public landing
// page (name, contact, currency). Deliberately does NOT expose payment
// numbers, tax rate, thresholds or any other operational fields.
router.get('/settings', async (req, res, next) => {
  try {
    const settingService = require('../../services/setting.service');
    const s = await settingService.get();
    res.json({
      success: true,
      data: {
        storeName: s.storeName || 'MiniMart',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        currency: s.currency || 'PHP',
      },
    });
  } catch (e) { next(e); }
});

// GET /api/v1/public/jobs - Get all open job postings (public)
router.get('/jobs', async (req, res, next) => {
  try {
    const { Op } = require('sequelize');
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = { status: 'open' };
    if (search) {
      where.title = { [Op.like]: `%${escapeLike(search)}%` };
    }

    const { rows, count } = await JobPosting.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'position', attributes: ['id', 'title'] },
      ],
    });

    res.json({
      success: true,
      data: {
        jobs: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (e) { next(e); }
});

// GET /api/v1/public/jobs/:id - Get single job posting (public)
router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await JobPosting.findByPk(req.params.id, {
      include: [
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'position', attributes: ['id', 'title'] },
      ],
    });
    if (!job) throw ApiError.notFound('Job posting not found');
    if (job.status !== 'open') throw ApiError.badRequest('Job posting is not accepting applications');
    res.json({ success: true, data: job });
  } catch (e) { next(e); }
});

// POST /api/v1/public/jobs/apply - Apply for a job (public)
router.post('/jobs/apply', applyLimiter, resumeUpload.single('resume'), validateResumeSignature, async (req, res, next) => {
  try {
    const { jobId, firstName, lastName, email, phone, coverLetter } = sanitizeObject(req.body);

    if (!jobId || !firstName || !lastName || !email) {
      throw ApiError.badRequest('Missing required fields: jobId, firstName, lastName, email');
    }

    const job = await JobPosting.findByPk(parseInt(jobId));
    if (!job) throw ApiError.notFound('Job posting not found');
    if (job.status !== 'open') throw ApiError.badRequest('Job posting is not accepting applications');

    // Check for duplicate application
    const existing = await JobApplication.findOne({ where: { jobId: parseInt(jobId), email } });
    if (existing) throw ApiError.badRequest('You have already applied for this position');

    const applicationData = {
      jobId: parseInt(jobId),
      firstName,
      lastName,
      email,
      phone: phone || null,
      coverLetter: coverLetter || null,
      status: 'pending',
    };
    if (req.file) {
      applicationData.resumePath = `/uploads/resumes/${req.file.filename}`;
    }

    const application = await JobApplication.create(applicationData);

    // Notify HR users about new application
    const hrUsers = await User.findAll({
      include: [{
        model: require('../../models').Role,
        as: 'role',
        where: { slug: { [require('sequelize').Op.in]: ['admin', 'hr'] } },
      }],
    });

    const notifications = hrUsers.map(user => ({
      userId: user.id,
      title: 'New Job Application',
      message: `${firstName} ${lastName} applied for ${job.title}`,
      type: 'hrms_application_status',
    }));

    if (notifications.length > 0) {
      await Notification.bulkCreate(notifications);
    }

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { id: application.id },
    });
  } catch (e) { next(e); }
});

module.exports = router;
