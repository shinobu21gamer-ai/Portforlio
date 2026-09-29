module.exports = (sequelize, DataTypes) => {
  const BlacklistedToken = sequelize.define('BlacklistedToken', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    token: { type: DataTypes.TEXT, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  }, {
    tableName: 'blacklisted_tokens',
    underscored: true,
  });

  return BlacklistedToken;
};
