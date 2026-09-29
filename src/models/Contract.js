module.exports = (sequelize, DataTypes) => {
  const Contract = sequelize.define('Contract', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: 'employee_id' },
    contractType: {
      type: DataTypes.ENUM('regular', 'probationary', 'contract', 'deployment', 'project'),
      allowNull: false,
      field: 'contract_type',
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
    endDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'end_date' },
    salary: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    paymentFrequency: {
      type: DataTypes.ENUM('monthly', 'semi-monthly'),
      allowNull: false,
      defaultValue: 'monthly',
      field: 'payment_frequency',
    },
    terms: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'expired', 'terminated', 'completed', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'approved_by' },
    approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'contracts',
    underscored: true,
    paranoid: true,
  });

  Contract.associate = (models) => {
    Contract.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
  };

  return Contract;
};
