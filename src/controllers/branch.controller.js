const branchService = require('../services/branch.service');

class BranchController {
  async getAll(req, res) {
    try {
      const result = await branchService.getAll(req.query);
      res.json({ data: result });
    } catch {
      res.status(500).json({ message: 'Failed to fetch branches' });
    }
  }

  async getById(req, res) {
    try {
      const branch = await branchService.getById(req.params.id);
      if (!branch) return res.status(404).json({ message: 'Branch not found' });
      res.json({ data: branch });
    } catch {
      res.status(500).json({ message: 'Failed to fetch branch' });
    }
  }

  async create(req, res) {
    try {
      const branch = await branchService.create(req.body);
      res.status(201).json({ data: branch });
    } catch (err) {
      res.status(400).json({ message: err.message || 'Failed to create branch' });
    }
  }

  async update(req, res) {
    try {
      const branch = await branchService.update(req.params.id, req.body);
      res.json({ data: branch });
    } catch (err) {
      res.status(400).json({ message: err.message || 'Failed to update branch' });
    }
  }

  async delete(req, res) {
    try {
      await branchService.delete(req.params.id);
      res.json({ message: 'Branch deleted' });
    } catch (err) {
      res.status(400).json({ message: err.message || 'Failed to delete branch' });
    }
  }

  async getStats(req, res) {
    try {
      const stats = await branchService.getStats(req.params.id);
      res.json({ data: stats });
    } catch {
      res.status(500).json({ message: 'Failed to fetch branch stats' });
    }
  }
}

module.exports = new BranchController();
