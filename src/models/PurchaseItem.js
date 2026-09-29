module.exports = (sequelize, DataTypes) => {
  const PurchaseItem = sequelize.define('PurchaseItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    purchaseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'purchase_id',
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
    receivedQuantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'received_quantity',
    },
    unitCost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'unit_cost',
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
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
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'expiry_date',
    },
  }, {
    tableName: 'purchase_items',
    underscored: true,
  });

  PurchaseItem.associate = (models) => {
    PurchaseItem.belongsTo(models.Purchase, { foreignKey: 'purchase_id', as: 'purchase' });
    PurchaseItem.belongsTo(models.Product, { foreignKey: 'product_id', as: 'product' });
  };

  return PurchaseItem;
};
