module.exports = (sequelize, DataTypes) => {
  const LeaveBalance = sequelize.define('LeaveBalance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: 'employee_id' },
    leaveType: { type: DataTypes.STRING(30), allowNull: false, field: 'leave_type' },
    year: { type: DataTypes.INTEGER, allowNull: false },
    totalDays: { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_days' },
    usedDays: { type: DataTypes.INTEGER, defaultValue: 0, field: 'used_days' },
  }, {
    tableName: 'leave_balances',
    underscored: true,
    indexes: [
      { fields: ['employee_id', 'leave_type', 'year'], unique: true },
    ],
  });

  LeaveBalance.associate = (models) => {
    LeaveBalance.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
  };

  return LeaveBalance;
};
