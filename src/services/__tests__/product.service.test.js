const { Product, Category } = require('../../models');
const ProductService = require('../product.service');

jest.mock('../../models', () => ({
  Product: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
  Category: {
    findByPk: jest.fn(),
  },
  StockMovement: {},
  SaleItem: {},
  sequelize: {
    where: (col, value) => ({ column: col, value }),
    fn: (fnName, col) => ({ fnName, col }),
    col: (name) => ({ columnName: name }),
  },
}));

describe('ProductService duplicate checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('detects duplicate products by normalized name and barcode before creating', async () => {
    Product.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 });
    Category.findByPk.mockResolvedValue({ id: 1, name: 'Drinks' });

    await expect(ProductService.create({
      name: 'Coke Zero',
      categoryId: 1,
      buyingPrice: 10,
      sellingPrice: 20,
      barcode: 'ABC123',
      sku: 'SKU-1',
    })).rejects.toMatchObject({ message: 'Barcode already exists' });
  });
});
