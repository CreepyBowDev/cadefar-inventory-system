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
    await queryInterface.createTable('proveedor_laboratorio', {
      id_proveedor_laboratorio: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      telefono: {
        type: Sequelize.STRING(30),
        allowNull: true
      },

      direccion: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      estado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    });

    await queryInterface.addConstraint('proveedor_laboratorio', {
      fields: ['estado'],
      type: 'check',
      where: {
        estado: {
          [Sequelize.Op.in]: [0, 1]
        }
      },
      name: 'chk_proveedor_laboratorio_estado'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('proveedor_laboratorio');
  }
};
