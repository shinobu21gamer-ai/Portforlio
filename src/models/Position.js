module.exports = (sequelize, DataTypes) => {
  const Position = sequelize.define('Position', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(100), allowNull: false },
    departmentId: { type: DataTypes.INTEGER, allowNull: false, field: 'department_id' },
    roleSlug: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'employee', field: 'role_slug', comment: 'System role assigned when hiring for this position (employee, cashier, manager, inventory_staff)' },
    minSalary: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'min_salary' },
    maxSalary: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0, field: 'max_salary' },
    description: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'positions',
    underscored: true,
    paranoid: true,
  });

  Position.associate = (models) => {
    Position.belongsTo(models.Department, { foreignKey: 'department_id', as: 'department' });
    Position.hasMany(models.Employee, { foreignKey: 'position_id', as: 'employees' });
  };

  return Position;
};
