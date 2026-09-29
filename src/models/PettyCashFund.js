module.exports = (sequelize, DataTypes) => {
  const PettyCashFund = sequelize.define('PettyCashFund', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    initialBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'initial_balance',
    },
    currentBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'current_balance',
    },
    status: {
      type: DataTypes.ENUM('active', 'closed'),
      allowNull: false,
      defaultValue: 'active',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  }, {
    tableName: 'petty_cash_funds',
    underscored: true,
    paranoid: true,
  });

  PettyCashFund.associate = (models) => {
    PettyCashFund.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    PettyCashFund.hasMany(models.PettyCashTransaction, { foreignKey: 'fund_id', as: 'transactions' });
  };

  return PettyCashFund;
};
