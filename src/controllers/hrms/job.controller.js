const jobService = require('../../services/hrms/job.service');
const { sendSuccess } = require('../../utils/response');
const path = require('path');
const fs = require('fs');
const ApiError = require('../../utils/ApiError');

class JobController {
  async getAll(req, res, next) { try { sendSuccess(res, await jobService.getAll(req.query)); } catch (e) { next(e); } }
  async getById(req, res, next) { try { sendSuccess(res, await jobService.getById(req.params.id)); } catch (e) { next(e); } }
  async create(req, res, next) { try { sendSuccess(res, await jobService.create({ ...req.body, postedBy: req.user.id }), 'Created', 201); } catch (e) { next(e); } }
  async update(req, res, next) { try { sendSuccess(res, await jobService.update(req.params.id, req.body)); } catch (e) { next(e); } }
  async close(req, res, next) { try { sendSuccess(res, await jobService.close(req.params.id)); } catch (e) { next(e); } }
  async delete(req, res, next) { try { sendSuccess(res, await jobService.delete(req.params.id)); } catch (e) { next(e); } }
  async apply(req, res, next) { try { const data = { ...req.body, jobId: parseInt(req.body.jobId) }; if (req.file) data.resumePath = `/uploads/resumes/${req.file.filename}`; sendSuccess(res, await jobService.apply(data), 'Applied', 201); } catch (e) { next(e); } }
  async approve(req, res, next) { try { sendSuccess(res, await jobService.approve(req.params.id), 'Approved'); } catch (e) { next(e); } }
  async reject(req, res, next) { try { sendSuccess(res, await jobService.reject(req.params.id), 'Rejected'); } catch (e) { next(e); } }
  async getApplications(req, res, next) { try { sendSuccess(res, await jobService.getApplications(req.query)); } catch (e) { next(e); } }
  async updateApplicationStatus(req, res, next) { try { sendSuccess(res, await jobService.updateApplicationStatus(req.params.id, req.body.status, req.body.notes)); } catch (e) { next(e); } }
  async downloadResume(req, res, next) {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.resolve('uploads/resumes', filename);
      if (!fs.existsSync(filePath)) throw ApiError.notFound('Resume not found');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      fs.createReadStream(filePath).pipe(res);
    } catch (e) { next(e); }
  }
  async scheduleInterview(req, res, next) { try { sendSuccess(res, await jobService.scheduleInterview(req.body), 'Interview scheduled', 201); } catch (e) { next(e); } }
  async getInterviews(req, res, next) { try { sendSuccess(res, await jobService.getInterviews(req.query)); } catch (e) { next(e); } }
  async updateInterview(req, res, next) { try { sendSuccess(res, await jobService.updateInterview(req.params.id, req.body)); } catch (e) { next(e); } }
  async updateInterviewResult(req, res, next) { try { sendSuccess(res, await jobService.updateInterviewResult(req.params.id, req.body.result, req.body.feedback)); } catch (e) { next(e); } }
  async deleteInterview(req, res, next) { try { sendSuccess(res, await jobService.deleteInterview(req.params.id)); } catch (e) { next(e); } }
}

module.exports = new JobController();
