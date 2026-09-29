module.exports = (sequelize, DataTypes) => {
  const LeaveRequest = sequelize.define('LeaveRequest', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: 'employee_id' },
    leaveType: {
      type: DataTypes.ENUM('sick', 'vacation', 'personal', 'maternity', 'paternity', 'bereavement', 'other'),
      allowNull: false,
      field: 'leave_type',
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'start_date' },
    endDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'end_date' },
    days: { type: DataTypes.INTEGER, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    isPaid: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_paid' },
    attachment: { type: DataTypes.STRING(255), allowNull: true },
    status: {
      type: DataTypes.ENUM('pending', 'hr-reviewed', 'admin-approved', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    reviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'reviewed_by' },
    reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'approved_by' },
    approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  }, {
    tableName: 'leave_requests',
    underscored: true,
    paranoid: true,
  });

  LeaveRequest.associate = (models) => {
    LeaveRequest.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
  };

  return LeaveRequest;
};
