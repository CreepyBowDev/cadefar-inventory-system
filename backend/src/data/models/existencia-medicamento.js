'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ExistenciaMedicamento extends Model {
        static associate(models) {
            ExistenciaMedicamento.belongsTo(models.Medicamento, {
                foreignKey: 'id_medicamento',
                as: 'medicamento',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            ExistenciaMedicamento.hasMany(models.DetalleCompra, {
                foreignKey: 'id_existencia',
                as: 'detallesCompra',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            ExistenciaMedicamento.hasMany(models.DetalleVenta, {
                foreignKey: 'id_existencia',
                as: 'detallesVenta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            ExistenciaMedicamento.hasMany(models.MovimientoInventario, {
                foreignKey: 'id_existencia',
                as: 'movimientosInventario',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    ExistenciaMedicamento.init(
        {
            id_existencia: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            id_medicamento: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'medicamento', key: 'id_medicamento' }
            },
            codigo_existencia: {
                type: DataTypes.STRING(30),
                allowNull: false,
                unique: 'uq_existencia_codigo'
            },
            fecha_vencimiento: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            precision_vencimiento: {
                type: DataTypes.ENUM('DIA', 'MES'),
                allowNull: false
            },
            cantidad_fisica: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            costo_unitario_promedio: {
                type: DataTypes.DECIMAL(14, 6),
                allowNull: false,
                defaultValue: 0
            }
        },
        {
            sequelize,
            modelName: 'ExistenciaMedicamento',
            tableName: 'existencia_medicamento',
            timestamps: false,
            indexes: [
                {
                    name: 'uq_existencia_medicamento_vencimiento_precision',
                    unique: true,
                    fields: ['id_medicamento', 'fecha_vencimiento', 'precision_vencimiento']
                }
            ]
        }
    );

    return ExistenciaMedicamento;
};
