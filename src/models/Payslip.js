module.exports = (sequelize, DataTypes) => {
  const Payslip = sequelize.define('Payslip', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    payrollId: { type: DataTypes.INTEGER, allowNull: false, field: 'payroll_id' },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: 'employee_id' },
    basicSalary: { type: DataTypes.DECIMAL(15, 2), allowNull: false, field: 'basic_salary' },
    daysWorked: { type: DataTypes.INTEGER, defaultValue: 0, field: 'days_worked' },
    absentDays: { type: DataTypes.INTEGER, defaultValue: 0, field: 'absent_days' },
    absentDeduction: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'absent_deduction' },
    overtimePay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'overtime_pay' },
    nightDiffPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'night_diff_pay' },
    holidayPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'holiday_pay' },
    restDayPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'rest_day_pay' },
    thirteenthMonthPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'thirteenth_month_pay' },
    bonusPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'bonus_pay' },
    grossPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'gross_pay' },
    sssDeduction: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'sss_deduction' },
    philhealthDeduction: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'philhealth_deduction' },
    pagibigDeduction: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'pagibig_deduction' },
    taxDeduction: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'tax_deduction' },
    otherDeductions: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'other_deductions' },
    totalDeductions: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'total_deductions' },
    netPay: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'net_pay' },
    status: {
      type: DataTypes.ENUM('draft', 'processed', 'paid'),
      allowNull: false,
      defaultValue: 'draft',
    },
    paidDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'paid_date' },
  }, {
    tableName: 'payslips',
    underscored: true,
    paranoid: true,
  });

  Payslip.associate = (models) => {
    Payslip.belongsTo(models.Payroll, { foreignKey: 'payroll_id', as: 'payroll' });
    Payslip.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
  };

  return Payslip;
};
