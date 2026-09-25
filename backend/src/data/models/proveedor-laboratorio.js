'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ProveedorLaboratorio extends Model {}

    ProveedorLaboratorio.init(
        {
            id_proveedor_laboratorio: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
            },
            nombre: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            telefono: {
                type: DataTypes.STRING(30),
                allowNull: true
            },
            direccion: {
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
            modelName: 'ProveedorLaboratorio',
            tableName: 'proveedor_laboratorio',
            timestamps: false
        }
    );

    return ProveedorLaboratorio;
};
