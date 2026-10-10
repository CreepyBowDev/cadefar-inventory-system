'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('limite_recuperacion_ip', {
      ambito: {
        type: Sequelize.STRING(24),
        allowNull: false,
        primaryKey: true
      },
      clave_ip_hmac: {
        type: Sequelize.CHAR(64),
        allowNull: false,
        primaryKey: true
      },
      ventana_hasta: {
        type: Sequelize.DATE(3),
        allowNull: false
      },
      cantidad: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      }
    });

    await queryInterface.addIndex('limite_recuperacion_ip', ['ventana_hasta'], {
      name: 'idx_limite_recuperacion_ventana'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('limite_recuperacion_ip');
  }
};
