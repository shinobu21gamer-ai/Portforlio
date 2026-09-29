module.exports = (sequelize, DataTypes) => {
  const PettyCashTransaction = sequelize.define('PettyCashTransaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fundId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'fund_id',
    },
    type: {
      type: DataTypes.ENUM('deposit', 'withdrawal'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'balance_after',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'reference_type',
    },
    referenceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reference_id',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
  }, {
    tableName: 'petty_cash_transactions',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['fund_id'] },
      { fields: ['user_id'] },
      { fields: ['reference_type', 'reference_id'] },
    ],
  });

  PettyCashTransaction.associate = (models) => {
    PettyCashTransaction.belongsTo(models.PettyCashFund, { foreignKey: 'fund_id', as: 'fund' });
    PettyCashTransaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return PettyCashTransaction;
};
