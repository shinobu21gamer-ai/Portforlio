module.exports = (sequelize, DataTypes) => {
  const Sale = sequelize.define('Sale', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoiceNo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'invoice_no',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'customer_id',
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'branch_id',
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'discount_id',
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
    taxAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'tax_amount',
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
    profit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
    },
    paymentStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'refunded', 'partially_refunded', 'cancelled'),
      defaultValue: 'paid',
      field: 'payment_status',
    },
    paymentMethod: {
      // 'split' = sale paid across multiple methods (see payments[]).
      type: DataTypes.ENUM('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer', 'other', 'split'),
      allowNull: false,
      field: 'payment_method',
    },
    paymentReference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'payment_reference',
    },
    cashAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'cash_amount',
    },
    changeAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'change_amount',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    refundedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'refunded_amount',
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'refunded'),
      defaultValue: 'completed',
    },
  }, {
    tableName: 'sales',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['invoice_no'] },
      { fields: ['user_id'] },
      { fields: ['customer_id'] },
      { fields: ['payment_status'] },
      { fields: ['created_at'] },
    ],
  });

  Sale.associate = (models) => {
    Sale.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Sale.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
    Sale.belongsTo(models.Discount, { foreignKey: 'discount_id', as: 'discountCode', required: false });
    Sale.hasMany(models.SaleItem, { foreignKey: 'sale_id', as: 'items' });
    Sale.hasMany(models.Payment, { foreignKey: 'sale_id', as: 'payments' });
  };

  return Sale;
};
