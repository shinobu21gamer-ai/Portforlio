module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'roles',
    underscored: true,
    paranoid: true,
  });

  Role.associate = (models) => {
    Role.hasMany(models.User, { foreignKey: 'role_id', as: 'users' });
    Role.belongsToMany(models.Permission, {
      through: 'role_permissions',
      foreignKey: 'role_id',
      otherKey: 'permission_id',
      as: 'permissions',
    });
  };

  return Role;
};
