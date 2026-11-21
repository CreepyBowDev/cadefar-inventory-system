'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PagoCompra extends Model {
        static associate(models) {
            PagoCompra.belongsTo(models.Compra, { foreignKey: 'id_compra', as: 'compra', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' });
            PagoCompra.belongsTo(models.Usuario, { foreignKey: 'id_usuario', as: 'administrador', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' });
        }
    }
    PagoCompra.init({
        id_pago: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        id_compra: { type: DataTypes.INTEGER, allowNull: false },
        id_usuario: { type: DataTypes.INTEGER, allowNull: false },
        clave_operacion: { type: DataTypes.STRING(64), allowNull: false, unique: 'uq_pago_clave' },
        metodo: { type: DataTypes.ENUM('TARJETA', 'PAYPAL'), allowNull: false },
        importe: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
        moneda: { type: DataTypes.STRING(3), allowNull: false },
        importe_pasarela: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
        moneda_pasarela: { type: DataTypes.STRING(3), allowNull: false },
        referencia_cotizacion: { type: DataTypes.STRING(100), allowNull: true },
        cuenta_destino: { type: DataTypes.STRING(100), allowNull: false },
        estado: { type: DataTypes.ENUM('PENDIENTE', 'PROCESANDO', 'CONFIRMADO', 'RECHAZADO'), allowNull: false },
        id_externo: { type: DataTypes.STRING(100), allowNull: true },
        referencia_externa: { type: DataTypes.STRING(100), allowNull: true },
        url_pago: { type: DataTypes.STRING(2048), allowNull: true },
        url_comprobante: { type: DataTypes.STRING(2048), allowNull: true },
        resultado_proveedor: { type: DataTypes.STRING(60), allowNull: true },
        fecha_registro: { type: DataTypes.DATE, allowNull: false },
        fecha_verificacion: { type: DataTypes.DATE, allowNull: true },
        fecha_confirmacion: { type: DataTypes.DATE, allowNull: true }
    }, { sequelize, modelName: 'PagoCompra', tableName: 'pago_compra', timestamps: false,
        indexes: [
            { unique: true, name: 'uq_pago_externo', fields: ['metodo', 'cuenta_destino', 'id_externo'] },
            { unique: true, name: 'uq_pago_referencia', fields: ['metodo', 'cuenta_destino', 'referencia_externa'] },
            { name: 'ix_pago_compra_estado', fields: ['id_compra', 'estado'] }
        ] });
    return PagoCompra;
};
