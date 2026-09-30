module.exports = (sequelize, DataTypes) => {
  const BlacklistedToken = sequelize.define('BlacklistedToken', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    token: { type: DataTypes.TEXT, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  }, {
    tableName: 'blacklisted_tokens',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['expires_at'] },
    ],
  });

  return BlacklistedToken;
};
