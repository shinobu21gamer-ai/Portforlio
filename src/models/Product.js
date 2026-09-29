module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    barcode: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'category_id',
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pcs',
    },
    buyingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'buying_price',
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'selling_price',
    },
    wholesalePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'wholesale_price',
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'stock_quantity',
    },
    minStockLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: 'min_stock_level',
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      field: 'tax_rate',
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'expiry_date',
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'branch_id',
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'supplier_id',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    isTrackable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_trackable',
    },
  }, {
    tableName: 'products',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['sku'] },
      { fields: ['barcode'] },
      { fields: ['category_id'] },
      { fields: ['supplier_id'] },
      { fields: ['is_active'] },
    ],
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category', onDelete: 'SET NULL' });
    Product.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier', onDelete: 'SET NULL' });
    Product.hasMany(models.SaleItem, { foreignKey: 'product_id', as: 'saleItems', onDelete: 'CASCADE' });
    Product.hasMany(models.PurchaseItem, { foreignKey: 'product_id', as: 'purchaseItems', onDelete: 'CASCADE' });
    Product.hasMany(models.StockMovement, { foreignKey: 'product_id', as: 'stockMovements', onDelete: 'SET NULL' });
    Product.hasMany(models.Inventory, { foreignKey: 'product_id', as: 'inventories', onDelete: 'SET NULL' });
  };

  return Product;
};
