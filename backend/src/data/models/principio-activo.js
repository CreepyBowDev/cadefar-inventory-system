'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class PrincipioActivo extends Model {
        static associate(models) {
            PrincipioActivo.hasMany(models.ComposicionMedicamento, {
                foreignKey: 'id_principio_activo',
                as: 'composiciones',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    PrincipioActivo.init(
        {
            id_principio_activo: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            nombre: {
                type: DataTypes.STRING(150),
                allowNull: false,
                unique: 'uq_principio_activo_nombre'
            },
            descripcion: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            estado: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            }
        },
        {
            sequelize,
            modelName: 'PrincipioActivo',
            tableName: 'principio_activo',
            timestamps: false
        }
    );

    return PrincipioActivo;
};
