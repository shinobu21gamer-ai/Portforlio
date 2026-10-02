const router = require('express').Router();
const productController = require('../controllers/product.controller');
const { protect, hasPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../validators');
const upload = require('../middleware/upload');
const { validateMagicNumber } = require('../middleware/upload');
const ApiError = require('../utils/ApiError');

router.get('/', protect, productController.getAll);
router.get('/low-stock', protect, productController.getLowStock);
router.get('/expiring', protect, productController.getExpiring);
router.get('/best-sellers', protect, productController.getBestSellers);
router.get('/barcode/:barcode', protect, productController.getByBarcode);
router.get('/:id', protect, productController.getById);
router.post('/', protect, hasPermission('products.create'), upload.single('image'), validateMagicNumber, (req, res, next) => {
  if (!req.file) return next(ApiError.badRequest('Product image is required'));
  next();
}, validate(schemas.createProduct), productController.create);
router.put('/:id', protect, hasPermission('products.update'), upload.single('image'), validateMagicNumber, validate(schemas.updateProduct), productController.update);
router.delete('/:id', protect, hasPermission('products.delete'), productController.delete);

module.exports = router;
