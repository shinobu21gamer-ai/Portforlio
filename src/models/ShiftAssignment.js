module.exports = (sequelize, DataTypes) => {
  const ShiftAssignment = sequelize.define('ShiftAssignment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employeeId: { type: DataTypes.INTEGER, allowNull: false, field: 'employee_id' },
    scheduleId: { type: DataTypes.INTEGER, allowNull: false, field: 'schedule_id' },
    date: { type: DataTypes.DATEONLY, allowNull: false },
  }, {
    tableName: 'shift_assignments',
    underscored: true,
    paranoid: true,
    indexes: [
      { fields: ['employee_id', 'date'], unique: true },
    ],
  });

  ShiftAssignment.associate = (models) => {
    ShiftAssignment.belongsTo(models.Employee, { foreignKey: 'employee_id', as: 'employee' });
    ShiftAssignment.belongsTo(models.Schedule, { foreignKey: 'schedule_id', as: 'schedule' });
  };

  return ShiftAssignment;
};
