'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

    class Rol extends Model {

        static associate(models) {
            Rol.hasMany(models.Usuario, {
                foreignKey: 'id_rol',
                as: 'usuarios'
            });
        }

    }

    Rol.init(
        {
            id_rol: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            nombre: {
                type: DataTypes.STRING(60),
                allowNull: false,
                unique: true
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
            modelName: 'Rol',
            tableName: 'rol',
            timestamps: false
        }
    );

    return Rol;
};