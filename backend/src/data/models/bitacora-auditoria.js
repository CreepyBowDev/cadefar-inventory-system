'use strict';

const { Model } = require('sequelize');

const impedirModificacion = () => {
  throw new Error('Los eventos de Bitácora no admiten modificación ni eliminación ordinaria');
};

module.exports = (sequelize, DataTypes) => {
  class BitacoraAuditoria extends Model {}

  BitacoraAuditoria.init({
    id_evento: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
    tipo_evento: { type: DataTypes.STRING(80), allowNull: false },
    modulo: { type: DataTypes.STRING(32), allowNull: false },
    accion: { type: DataTypes.STRING(60), allowNull: false },
    resultado: { type: DataTypes.STRING(12), allowNull: false },
    causa: { type: DataTypes.STRING(64), allowNull: true },
    fecha_registro: { type: DataTypes.DATE(3), allowNull: false },
    fecha_evento: { type: DataTypes.DATE(3), allowNull: false },
    id_usuario_responsable: { type: DataTypes.INTEGER, allowNull: true },
    nombre_usuario_responsable: { type: DataTypes.STRING(60), allowNull: true },
    id_rol_responsable: { type: DataTypes.INTEGER, allowNull: true },
    id_usuario_objetivo: { type: DataTypes.INTEGER, allowNull: true },
    nombre_usuario_objetivo: { type: DataTypes.STRING(60), allowNull: true },
    id_rol_objetivo: { type: DataTypes.INTEGER, allowNull: true },
    nombre_ingresado: { type: DataTypes.STRING(60), allowNull: true },
    direccion_ip: { type: DataTypes.STRING(45), allowNull: true },
    procedencia_ip: { type: DataTypes.STRING(24), allowNull: false },
    tipo_registro: { type: DataTypes.STRING(32), allowNull: true },
    id_registro: { type: DataTypes.INTEGER, allowNull: true },
    correlacion: { type: DataTypes.CHAR(32), allowNull: false },
    id_evento_relacionado: { type: DataTypes.INTEGER, allowNull: true },
    version_formato: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 1 },
    antes: { type: DataTypes.JSON, allowNull: true },
    despues: { type: DataTypes.JSON, allowNull: true },
    metadatos: { type: DataTypes.JSON, allowNull: true },
    referencias: { type: DataTypes.JSON, allowNull: true }
  }, {
    sequelize, modelName: 'BitacoraAuditoria', tableName: 'bitacora_auditoria', timestamps: false,
    indexes: [
      { name: 'idx_bitacora_fecha', fields: ['fecha_registro', 'id_evento'] },
      { name: 'idx_bitacora_responsable', fields: ['id_usuario_responsable', 'fecha_registro', 'id_evento'] },
      { name: 'idx_bitacora_objetivo', fields: ['id_usuario_objetivo', 'fecha_registro', 'id_evento'] },
      { name: 'idx_bitacora_modulo_accion', fields: ['modulo', 'accion', 'fecha_registro', 'id_evento'] },
      { name: 'idx_bitacora_resultado', fields: ['resultado', 'fecha_registro', 'id_evento'] },
      { name: 'idx_bitacora_registro', fields: ['tipo_registro', 'id_registro', 'fecha_registro', 'id_evento'] },
      { name: 'uq_bitacora_solicitud_tipo', unique: true, fields: ['correlacion', 'tipo_evento'] }
    ],
    // Defensa ante DML accidental por Sequelize. hooks:false/SQL directo pueden
    // omitirla: la protección efectiva también requiere privilegios MySQL.
    hooks: {
      beforeUpdate: impedirModificacion, beforeBulkUpdate: impedirModificacion,
      beforeDestroy: impedirModificacion, beforeBulkDestroy: impedirModificacion,
      beforeUpsert: impedirModificacion
    }
  });

  return BitacoraAuditoria;
};
