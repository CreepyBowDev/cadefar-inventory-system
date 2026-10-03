'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Venta extends Model {
        static associate(models) {
            Venta.belongsTo(models.Usuario, {
                foreignKey: 'id_usuario',
                as: 'usuarioRegistrador',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Venta.belongsTo(models.Usuario, {
                foreignKey: 'id_usuario_anulador',
                as: 'usuarioAnulador',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Venta.hasMany(models.DetalleVenta, {
                foreignKey: 'id_venta',
                as: 'detallesVenta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Venta.hasMany(models.Receta, {
                foreignKey: 'id_venta',
                as: 'recetas',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    Venta.init(
        {
            id_venta: {
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
            fecha_venta: {
                type: DataTypes.DATE,
                allowNull: true
            },
            fecha_registro: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            },
            estado_operacion: {
                type: DataTypes.ENUM('CONFIRMADA', 'ANULADA', 'PENDIENTE'),
                allowNull: false,
                defaultValue: 'PENDIENTE'
            },
            clave_operacion: {
                type: DataTypes.STRING(64),
                allowNull: false,
                unique: 'uq_venta_clave_operacion'
            },
            total: {
                type: DataTypes.DECIMAL(14, 2),
                allowNull: false
            },
            fecha_anulacion: {
                type: DataTypes.DATE,
                allowNull: true
            },
            motivo_anulacion: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            id_usuario_anulador: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'usuario', key: 'id_usuario' }
            }
        },
        {
            sequelize,
            modelName: 'Venta',
            tableName: 'venta',
            timestamps: false
        }
    );

    return Venta;
};
