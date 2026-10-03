'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MovimientoInventario extends Model {
        static associate(models) {
            MovimientoInventario.belongsTo(models.Usuario, {
                foreignKey: 'id_usuario',
                as: 'usuario',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            MovimientoInventario.belongsTo(models.ExistenciaMedicamento, {
                foreignKey: 'id_existencia',
                as: 'existencia',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            MovimientoInventario.belongsTo(models.DetalleCompra, {
                foreignKey: 'id_detalle_compra',
                as: 'detalleCompra',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            MovimientoInventario.belongsTo(models.DetalleVenta, {
                foreignKey: 'id_detalle_venta',
                as: 'detalleVenta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            MovimientoInventario.belongsTo(models.MovimientoInventario, {
                foreignKey: 'id_movimiento_original',
                as: 'movimientoOriginal',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            MovimientoInventario.hasOne(models.MovimientoInventario, {
                foreignKey: 'id_movimiento_original',
                as: 'movimientoReversion',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    MovimientoInventario.init(
        {
            id_movimiento: {
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
            id_existencia: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'existencia_medicamento', key: 'id_existencia' }
            },
            id_detalle_compra: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'detalle_compra', key: 'id_detalle_compra' }
            },
            id_detalle_venta: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'detalle_venta', key: 'id_detalle_venta' }
            },
            id_movimiento_original: {
                type: DataTypes.INTEGER,
                allowNull: true,
                unique: 'uq_movimiento_original',
                references: { model: 'movimiento_inventario', key: 'id_movimiento' }
            },
            direccion: {
                type: DataTypes.ENUM('ENTRADA', 'SALIDA'),
                allowNull: false
            },
            cantidad: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            fecha_movimiento: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            },
            motivo: {
                type: DataTypes.STRING(40),
                allowNull: false
            },
            observacion: {
                type: DataTypes.STRING(500),
                allowNull: true
            },
            costo_unitario_aplicado: {
                type: DataTypes.DECIMAL(14, 6),
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'MovimientoInventario',
            tableName: 'movimiento_inventario',
            timestamps: false
        }
    );

    return MovimientoInventario;
};
