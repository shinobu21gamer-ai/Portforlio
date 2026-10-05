module.exports = (sequelize, DataTypes) => {
  const bcrypt = require('bcryptjs');
  const config = require('../config');

  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'last_name',
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'role_id',
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'branch_id',
    },
    reportsToId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reports_to_id',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login',
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_changed_at',
    },
    passwordResetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_reset_token',
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_reset_expires',
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'failed_login_attempts',
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'locked_until',
    },
    // Set on first-run/seeded accounts: the user may only call
    // /auth/change-password (and /auth/logout) until they pick their own
    // password. Cleared by changePassword()/resetPassword().
    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'must_change_password',
    },
  }, {
    tableName: 'users',
    underscored: true,
    paranoid: true,
    defaultScope: {
      attributes: { exclude: ['password', 'passwordResetToken', 'passwordResetExpires'] },
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password', 'passwordResetToken', 'passwordResetExpires'] },
      },
    },
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(config.bcrypt.saltRounds);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(config.bcrypt.saltRounds);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  });

  User.associate = (models) => {
    User.belongsTo(models.Role, { foreignKey: 'role_id', as: 'role', onDelete: 'SET NULL' });
    User.belongsTo(models.User, { foreignKey: 'reports_to_id', as: 'reportsTo', onDelete: 'SET NULL' });
    // branch_id existed as a column with no association, so nothing could join
    // a user to their branch. Needed for attendance geofencing, which resolves
    // the employee's branch from the linked user account.
    User.belongsTo(models.Branch, { foreignKey: 'branch_id', as: 'branch', onDelete: 'SET NULL' });
    User.hasMany(models.User, { foreignKey: 'reports_to_id', as: 'directReports' });
    User.hasOne(models.Employee, { foreignKey: 'user_id', as: 'employee', onDelete: 'SET NULL' });
    User.hasMany(models.ActivityLog, { foreignKey: 'user_id', as: 'activityLogs', onDelete: 'CASCADE' });
    User.hasMany(models.Sale, { foreignKey: 'user_id', as: 'sales', onDelete: 'SET NULL' });
    User.hasMany(models.Purchase, { foreignKey: 'user_id', as: 'purchases', onDelete: 'SET NULL' });
    User.hasMany(models.Inventory, { foreignKey: 'user_id', as: 'inventories', onDelete: 'SET NULL' });
    User.hasMany(models.StockMovement, { foreignKey: 'user_id', as: 'stockMovements', onDelete: 'SET NULL' });
  };

  return User;
};
