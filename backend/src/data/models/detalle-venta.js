'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DetalleVenta extends Model {
        static associate(models) {
            DetalleVenta.belongsTo(models.Venta, {
                foreignKey: 'id_venta',
                as: 'venta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            DetalleVenta.belongsTo(models.Receta, {
                foreignKey: 'id_receta',
                as: 'receta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            DetalleVenta.belongsTo(models.ExistenciaMedicamento, {
                foreignKey: 'id_existencia',
                as: 'existencia',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            DetalleVenta.hasMany(models.MovimientoInventario, {
                foreignKey: 'id_detalle_venta',
                as: 'movimientosInventario',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    DetalleVenta.init(
        {
            id_detalle_venta: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            id_venta: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'venta', key: 'id_venta' }
            },
            id_receta: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'receta', key: 'id_receta' }
            },
            id_existencia: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'existencia_medicamento', key: 'id_existencia' }
            },
            cantidad: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            precio_unitario: {
                type: DataTypes.DECIMAL(14, 2),
                allowNull: false
            },
            subtotal: {
                type: DataTypes.DECIMAL(14, 2),
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'DetalleVenta',
            tableName: 'detalle_venta',
            timestamps: false
        }
    );

    return DetalleVenta;
};
