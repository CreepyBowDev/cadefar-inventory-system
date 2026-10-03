'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DetalleCompra extends Model {
        static associate(models) {
            DetalleCompra.belongsTo(models.Compra, {
                foreignKey: 'id_compra',
                as: 'compra',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            DetalleCompra.belongsTo(models.ExistenciaMedicamento, {
                foreignKey: 'id_existencia',
                as: 'existencia',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            DetalleCompra.hasMany(models.MovimientoInventario, {
                foreignKey: 'id_detalle_compra',
                as: 'movimientosInventario',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    DetalleCompra.init(
        {
            id_detalle_compra: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            id_compra: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'compra', key: 'id_compra' }
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
            costo_unitario: {
                type: DataTypes.DECIMAL(14, 6),
                allowNull: false
            },
            subtotal: {
                type: DataTypes.DECIMAL(14, 2),
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'DetalleCompra',
            tableName: 'detalle_compra',
            timestamps: false
        }
    );

    return DetalleCompra;
};
