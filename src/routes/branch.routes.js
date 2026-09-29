const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const { protect, authorize, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');

router.get('/', protect, branchController.getAll);
router.get('/:id', protect, branchController.getById);
router.get('/:id/stats', protect, authorize('admin', 'manager'), branchController.getStats);
router.post('/', protect, hasPermission('branches.manage'), validate(schemas.createBranch), branchController.create);
router.put('/:id', protect, hasPermission('branches.manage'), validate(schemas.updateBranch), branchController.update);
router.delete('/:id', protect, hasPermission('branches.manage'), branchController.delete);

module.exports = router;
