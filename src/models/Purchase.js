module.exports = (sequelize, DataTypes) => {
  const Purchase = sequelize.define('Purchase', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'order_no',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'supplier_id',
    },
    orderDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'order_date',
    },
    expectedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'expected_date',
    },
    status: {
      type: DataTypes.ENUM('pending', 'ordered', 'partial', 'received', 'cancelled'),
      defaultValue: 'pending',
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'partial', 'paid'),
      defaultValue: 'pending',
      field: 'payment_status',
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    shippingFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'shipping_fee',
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'paid_amount',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'purchases',
    underscored: true,
    paranoid: true,
  });

  Purchase.associate = (models) => {
    Purchase.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Purchase.belongsTo(models.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
    Purchase.hasMany(models.PurchaseItem, { foreignKey: 'purchase_id', as: 'items' });
  };

  return Purchase;
};
