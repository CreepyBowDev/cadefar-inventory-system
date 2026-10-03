'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Compra extends Model {
        static associate(models) {
            Compra.belongsTo(models.Usuario, {
                foreignKey: 'id_usuario',
                as: 'usuarioRegistrador',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Compra.belongsTo(models.Usuario, {
                foreignKey: 'id_usuario_anulador',
                as: 'usuarioAnulador',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Compra.belongsTo(models.ProveedorLaboratorio, {
                foreignKey: 'id_proveedor_laboratorio',
                as: 'proveedorLaboratorio',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
            Compra.hasMany(models.DetalleCompra, {
                foreignKey: 'id_compra',
                as: 'detallesCompra',
                onDelete: 'RESTRICT',
                onUpdate: 'RESTRICT'
            });
        }
    }

    Compra.init(
        {
            id_compra: {
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
            id_proveedor_laboratorio: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'proveedor_laboratorio', key: 'id_proveedor_laboratorio' }
            },
            fecha_compra: {
                type: DataTypes.DATEONLY,
                allowNull: false
            },
            fecha_registro: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
            },
            estado_operacion: {
                type: DataTypes.ENUM('CONFIRMADA', 'ANULADA'),
                allowNull: false,
                defaultValue: 'CONFIRMADA'
            },
            clave_operacion: {
                type: DataTypes.STRING(64),
                allowNull: false,
                unique: 'uq_compra_clave_operacion'
            },
            total: {
                type: DataTypes.DECIMAL(14, 2),
                allowNull: false
            },
            fecha_anulacion: {
                type: DataTypes.DATE,
                allowNull: true
            },
            motivo_anulacion: {
                type: DataTypes.STRING(255),
                allowNull: true
            },
            id_usuario_anulador: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'usuario', key: 'id_usuario' }
            }
        },
        {
            sequelize,
            modelName: 'Compra',
            tableName: 'compra',
            timestamps: false
        }
    );

    return Compra;
};
