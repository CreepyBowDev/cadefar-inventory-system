'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LimiteRecuperacionIp extends Model {}

  LimiteRecuperacionIp.init(
    {
      ambito: {
        type: DataTypes.STRING(24),
        allowNull: false,
        primaryKey: true
      },
      clave_ip_hmac: {
        type: DataTypes.CHAR(64),
        allowNull: false,
        primaryKey: true
      },
      ventana_hasta: {
        type: DataTypes.DATE(3),
        allowNull: false
      },
      cantidad: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'LimiteRecuperacionIp',
      tableName: 'limite_recuperacion_ip',
      timestamps: false,
      indexes: [
        { name: 'idx_limite_recuperacion_ventana', fields: ['ventana_hasta'] }
      ]
    }
  );

  return LimiteRecuperacionIp;
};
