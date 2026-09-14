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
    await queryInterface.createTable('detalle_venta', {
      id_detalle_venta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_venta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'venta',
          key: 'id_venta'
        }
      },

      id_receta: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'receta',
          key: 'id_receta'
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

      cantidad: {
        type: Sequelize.INTEGER,
        allowNull: false
      },

      precio_unitario: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },

      subtotal: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      }
    });

    // CHECK (cantidad > 0)
    await queryInterface.addConstraint('detalle_venta', {
      fields: ['cantidad'],
      type: 'check',
      where: {
        cantidad: {
          [Sequelize.Op.gt]: 0
        }
      },
      name: 'chk_detalle_venta_cantidad'
    });


    await queryInterface.addConstraint('detalle_venta', {
      fields: ['precio_unitario'],
      type: 'check',
      where: {
        precio_unitario: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_detalle_venta_precio_unitario'
    });


    await queryInterface.addConstraint('detalle_venta', {
      fields: ['subtotal'],
      type: 'check',
      where: {
        subtotal: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_detalle_venta_subtotal'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('detalle_venta');
  }
};
