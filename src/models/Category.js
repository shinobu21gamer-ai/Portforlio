module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'parent_id',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'categories',
    underscored: true,
    paranoid: true,
  });

  Category.associate = (models) => {
    Category.hasMany(models.Category, { foreignKey: 'parent_id', as: 'children', onDelete: 'SET NULL' });
    Category.belongsTo(models.Category, { foreignKey: 'parent_id', as: 'parent', onDelete: 'SET NULL' });
    Category.hasMany(models.Product, { foreignKey: 'category_id', as: 'products', onDelete: 'SET NULL' });
  };

  return Category;
};
