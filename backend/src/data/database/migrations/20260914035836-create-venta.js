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
    await queryInterface.createTable('venta', {
      id_venta: {
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

      fecha_venta: {
        type: Sequelize.DATE,
        allowNull: false
      },

      fecha_registro: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      estado_operacion: {
        type: Sequelize.ENUM('CONFIRMADA', 'ANULADA'),
        allowNull: false,
        defaultValue: 'CONFIRMADA'
      },

      clave_operacion: {
        type: Sequelize.STRING(64),
        allowNull: false
      },

      total: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false
      },

      fecha_anulacion: {
        type: Sequelize.DATE,
        allowNull: true
      },

      motivo_anulacion: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      id_usuario_anulador: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'usuario',
          key: 'id_usuario'
        }
      }
    });


    await queryInterface.addConstraint('venta', {
      fields: ['clave_operacion'],
      type: 'unique',
      name: 'uq_venta_clave_operacion'
    });


    await queryInterface.addConstraint('venta', {
      fields: ['total'],
      type: 'check',
      where: {
        total: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_venta_total'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('venta');
  }
};
