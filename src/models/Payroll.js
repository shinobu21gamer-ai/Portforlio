module.exports = (sequelize, DataTypes) => {
  const Payroll = sequelize.define('Payroll', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    period: { type: DataTypes.STRING(20), allowNull: false },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
    endDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'end_date' },
    status: {
      type: DataTypes.ENUM('draft', 'processed', 'paid'),
      allowNull: false,
      defaultValue: 'draft',
    },
    totalEmployees: { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_employees' },
    totalGrossPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'total_gross_pay' },
    totalDeductions: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'total_deductions' },
    totalNetPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'total_net_pay' },
    paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
  }, {
    tableName: 'payrolls',
    underscored: true,
    paranoid: true,
  });

  Payroll.associate = (models) => {
    Payroll.hasMany(models.Payslip, { foreignKey: 'payroll_id', as: 'payslips' });
  };

  return Payroll;
};
