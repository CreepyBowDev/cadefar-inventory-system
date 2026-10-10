'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RecuperacionPassword extends Model {
    static associate(models) {
      RecuperacionPassword.belongsTo(models.Usuario, {
        foreignKey: 'id_usuario',
        as: 'usuario',
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT'
      });
    }
  }

  RecuperacionPassword.init(
    {
      id_recuperacion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'usuario', key: 'id_usuario' }
      },
      codigo_hmac: {
        type: DataTypes.CHAR(64),
        allowNull: false
      },
      nonce: {
        type: DataTypes.CHAR(36),
        allowNull: false
      },
      fecha_solicitud: {
        type: DataTypes.DATE(3),
        allowNull: false
      },
      expira_en: {
        type: DataTypes.DATE(3),
        allowNull: false
      },
      intentos_fallidos: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      consumida_en: {
        type: DataTypes.DATE(3),
        allowNull: true
      },
      invalidada_en: {
        type: DataTypes.DATE(3),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'RecuperacionPassword',
      tableName: 'recuperacion_password',
      timestamps: false,
      indexes: [
        { name: 'uq_recuperacion_nonce', unique: true, fields: ['nonce'] },
        { name: 'idx_recuperacion_usuario_solicitud', fields: ['id_usuario', 'fecha_solicitud', 'id_recuperacion'] },
        { name: 'idx_recuperacion_expira', fields: ['expira_en'] }
      ]
    }
  );

  return RecuperacionPassword;
};
