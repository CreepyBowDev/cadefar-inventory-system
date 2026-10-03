'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ComposicionMedicamento extends Model {
        static associate(models) {
            ComposicionMedicamento.belongsTo(models.Medicamento, {
                foreignKey: 'id_medicamento',
                as: 'medicamento',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            ComposicionMedicamento.belongsTo(models.PrincipioActivo, {
                foreignKey: 'id_principio_activo',
                as: 'principioActivo',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    ComposicionMedicamento.init(
        {
            id_composicion: {
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
            id_principio_activo: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'principio_activo', key: 'id_principio_activo' }
            },
            cantidad_principio_activo: {
                type: DataTypes.DECIMAL(12, 4),
                allowNull: false
            },
            unidad_principio_activo: {
                type: DataTypes.STRING(30),
                allowNull: false
            },
            cantidad_referencia: {
                type: DataTypes.DECIMAL(12, 4),
                allowNull: false
            },
            unidad_referencia: {
                type: DataTypes.STRING(30),
                allowNull: false
            }
        },
        {
            sequelize,
            modelName: 'ComposicionMedicamento',
            tableName: 'composicion_medicamento',
            timestamps: false,
            indexes: [
                {
                    name: 'uq_composicion_medicamento_principio',
                    unique: true,
                    fields: ['id_medicamento', 'id_principio_activo']
                }
            ]
        }
    );

    return ComposicionMedicamento;
};
