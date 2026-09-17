'use strict';

const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {

  class Usuario extends Model {

    static associate(models) {

      Usuario.belongsTo(models.Rol, {
        foreignKey: 'id_rol',
        as: 'rol'
      });

    }
  }

  Usuario.init(
    {
      id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },

      id_rol: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      nombre_usuario: {
        type: DataTypes.STRING(60),
        allowNull: false,
        unique: true
      },

      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
      },

      estado: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      sequelize,
      modelName: 'Usuario',
      tableName: 'usuario',
      timestamps: false
    }
  );

  return Usuario;
};