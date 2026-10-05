module.exports = (sequelize, DataTypes) => {
  const Shift = sequelize.define('Shift', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    status: {
      type: DataTypes.ENUM('open', 'closed'),
      defaultValue: 'open',
    },
    openedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'opened_at',
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closed_at',
    },
    openingFloat: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'opening_float',
    },
    // Cash actually handed over: cash sales attributed to this shift, minus
    // cash refunds voided during it (tracked by the sale/refund services).
    cashSalesTotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'cash_sales_total',
    },
    voidedTotal: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'voided_total',
    },
    // Filled at close: expectedCash = openingFloat + cashSalesTotal - voidedTotal.
    expectedCash: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      field: 'expected_cash',
    },
    countedCash: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'counted_cash',
    },
    cashDifference: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'cash_difference',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'shifts',
    underscored: true,
    indexes: [
      { fields: ['user_id', 'status'] },
      { fields: ['opened_at'] },
    ],
  });

  Shift.associate = (models) => {
    Shift.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return Shift;
};
