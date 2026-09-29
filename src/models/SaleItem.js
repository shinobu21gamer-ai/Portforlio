module.exports = (sequelize, DataTypes) => {
  const SaleItem = sequelize.define('SaleItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sale_id',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'product_name',
    },
    productSku: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'product_sku',
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'unit_price',
    },
    buyingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'buying_price',
    },
    discountType: {
      type: DataTypes.ENUM('percentage', 'fixed'),
      allowNull: true,
      field: 'discount_type',
    },
    discountValue: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'discount_value',
    },
    discountAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'discount_amount',
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'tax_rate',
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
      field: 'tax_amount',
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
  }, {
    tableName: 'sale_items',
    underscored: true,
  });

  SaleItem.associate = (models) => {
    SaleItem.belongsTo(models.Sale, { foreignKey: 'sale_id', as: 'sale' });
    SaleItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
  };

  return SaleItem;
};
