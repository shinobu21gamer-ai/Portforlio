module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
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
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM('cash', 'gcash', 'maya', 'credit_card', 'debit_card', 'bank_transfer', 'other'),
      allowNull: false,
      field: 'payment_method',
    },
    reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
      defaultValue: 'completed',
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'paid_at',
    },
  }, {
    tableName: 'payments',
    underscored: true,
  });

  Payment.associate = (models) => {
    Payment.belongsTo(models.Sale, { foreignKey: 'sale_id', as: 'sale' });
  };

  return Payment;
};
