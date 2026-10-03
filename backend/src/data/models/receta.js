'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Receta extends Model {
        static associate(models) {
            Receta.belongsTo(models.Venta, {
                foreignKey: 'id_venta',
                as: 'venta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Receta.belongsTo(models.Usuario, {
                foreignKey: 'id_usuario_validador',
                as: 'usuarioValidador',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Receta.hasMany(models.DetalleVenta, {
                foreignKey: 'id_receta',
                as: 'detallesVenta',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    Receta.init(
        {
            id_receta: {
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
            id_usuario_validador: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'usuario', key: 'id_usuario' }
            },
            numero_receta: {
                type: DataTypes.STRING(80),
                allowNull: true
            },
            fecha_receta: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            nombre_paciente: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            documento_paciente: {
                type: DataTypes.STRING(40),
                allowNull: false
            },
            nombre_medico: {
                type: DataTypes.STRING(150),
                allowNull: false
            },
            archivo_receta: {
                type: DataTypes.STRING(500),
                allowNull: false
            },
            modalidad: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            resultado_revision: {
                type: DataTypes.ENUM('APROBADA', 'RECHAZADA'),
                allowNull: true
            },
            fecha_validacion: {
                type: DataTypes.DATE,
                allowNull: true
            },
            fecha_registro: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            },
            observacion: {
                type: DataTypes.STRING(500),
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: 'Receta',
            tableName: 'receta',
            timestamps: false
        }
    );

    return Receta;
};
