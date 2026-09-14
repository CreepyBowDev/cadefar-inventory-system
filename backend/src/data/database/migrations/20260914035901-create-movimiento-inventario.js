'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('movimiento_inventario', {
      id_movimiento: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'usuario',
          key: 'id_usuario'
        }
      },

      id_existencia: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'existencia_medicamento',
          key: 'id_existencia'
        }
      },

      id_detalle_compra: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'detalle_compra',
          key: 'id_detalle_compra'
        }
      },

      id_detalle_venta: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'detalle_venta',
          key: 'id_detalle_venta'
        }
      },

      id_movimiento_original: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'movimiento_inventario',
          key: 'id_movimiento'
        }
      },

      direccion: {
        type: Sequelize.ENUM('ENTRADA', 'SALIDA'),
        allowNull: false
      },

      cantidad: {
        type: Sequelize.INTEGER,
        allowNull: false
      },

      fecha_movimiento: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      motivo: {
        type: Sequelize.STRING(40),
        allowNull: false
      },

      observacion: {
        type: Sequelize.STRING(500),
        allowNull: true
      },

      costo_unitario_aplicado: {
        type: Sequelize.DECIMAL(14, 6),
        allowNull: false
      }
    });


    await queryInterface.addConstraint('movimiento_inventario', {
      fields: ['id_movimiento_original'],
      type: 'unique',
      name: 'uq_movimiento_original'
    });


    await queryInterface.addConstraint('movimiento_inventario', {
      fields: ['cantidad'],
      type: 'check',
      where: {
        cantidad: {
          [Sequelize.Op.gt]: 0
        }
      },
      name: 'chk_movimiento_cantidad'
    });


    await queryInterface.addConstraint('movimiento_inventario', {
      fields: ['costo_unitario_aplicado'],
      type: 'check',
      where: {
        costo_unitario_aplicado: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_movimiento_costo'
    });


    await queryInterface.addConstraint('movimiento_inventario', {
      fields: ['id_detalle_compra', 'id_detalle_venta'],
      type: 'check',
      where: {
        [Sequelize.Op.or]: [
          { id_detalle_compra: null },
          { id_detalle_venta: null }
        ]
      },
      name: 'chk_movimiento_un_solo_origen'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('movimiento_inventario');
  }
};
