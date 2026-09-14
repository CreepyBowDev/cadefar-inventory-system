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
    await queryInterface.createTable('detalle_compra', {
      id_detalle_compra: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_compra: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'compra',
          key: 'id_compra'
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

      costo_unitario: {
        type: Sequelize.DECIMAL(14, 6),
        allowNull: false
      },

      subtotal: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      }
    });


    await queryInterface.addConstraint('detalle_compra', {
      fields: ['cantidad'],
      type: 'check',
      where: {
        cantidad: {
          [Sequelize.Op.gt]: 0
        }
      },
      name: 'chk_detalle_compra_cantidad'
    });


    await queryInterface.addConstraint('detalle_compra', {
      fields: ['costo_unitario'],
      type: 'check',
      where: {
        costo_unitario: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_detalle_compra_costo_unitario'
    });


    await queryInterface.addConstraint('detalle_compra', {
      fields: ['subtotal'],
      type: 'check',
      where: {
        subtotal: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_detalle_compra_subtotal'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('detalle_compra');
  }
};
