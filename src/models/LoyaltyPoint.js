module.exports = (sequelize, DataTypes) => {
  const LoyaltyPoint = sequelize.define('LoyaltyPoint', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'customer_id',
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sale_id',
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('earned', 'redeemed', 'expired', 'adjusted'),
      allowNull: false,
    },
    balanceBefore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'balance_before',
    },
    balanceAfter: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'balance_after',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'loyalty_points',
    underscored: true,
  });

  LoyaltyPoint.associate = (models) => {
    LoyaltyPoint.belongsTo(models.Customer, { foreignKey: 'customer_id', as: 'customer' });
    LoyaltyPoint.belongsTo(models.Sale, { foreignKey: 'sale_id', as: 'sale' });
  };

  return LoyaltyPoint;
};
