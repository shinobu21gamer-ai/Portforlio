module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'departments',
    underscored: true,
    paranoid: true,
  });

  Department.associate = (models) => {
    Department.hasMany(models.Position, { foreignKey: 'department_id', as: 'positions' });
    Department.hasMany(models.Employee, { foreignKey: 'department_id', as: 'employees' });
  };

  return Department;
};
