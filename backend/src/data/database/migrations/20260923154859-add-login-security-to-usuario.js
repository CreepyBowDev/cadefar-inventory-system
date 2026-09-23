'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('usuario', 'intentos_fallidos_login', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn('usuario', 'bloqueado_hasta', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('usuario', 'bloqueado_hasta');
    await queryInterface.removeColumn('usuario', 'intentos_fallidos_login');
  }
};
