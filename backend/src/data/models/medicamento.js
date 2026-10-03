'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Medicamento extends Model {
        static associate(models) {
            Medicamento.belongsTo(models.ProveedorLaboratorio, {
                foreignKey: 'id_proveedor_laboratorio',
                as: 'proveedorLaboratorio',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Medicamento.hasMany(models.ExistenciaMedicamento, {
                foreignKey: 'id_medicamento',
                as: 'existencias',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Medicamento.hasMany(models.ComposicionMedicamento, {
                foreignKey: 'id_medicamento',
                as: 'composiciones',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    Medicamento.init(
        {
            id_medicamento: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            id_proveedor_laboratorio: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'proveedor_laboratorio',
                    key: 'id_proveedor_laboratorio'
                }
            },
            codigo_medicamento: {
                type: DataTypes.STRING(20),
                allowNull: false,
                unique: 'uq_medicamento_codigo'
            },
            nombre_comercial: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            forma_farmaceutica: {
                type: DataTypes.STRING(80),
                allowNull: false
            },
            presentacion: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            unidad_inventario: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            stock_minimo: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0
            },
            condicion_venta: {
                type: DataTypes.STRING(40),
                allowNull: false
            },
            via_administracion: {
                type: DataTypes.STRING(80),
                allowNull: false
            },
            tipo_liberacion: {
                type: DataTypes.STRING(80),
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
            modelName: 'Medicamento',
            tableName: 'medicamento',
            timestamps: false
        }
    );

    return Medicamento;
};
