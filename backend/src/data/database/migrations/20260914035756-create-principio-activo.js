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
    await queryInterface.createTable('principio_activo', {
      id_principio_activo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      nombre: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      descripcion: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      estado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    });

    await queryInterface.addConstraint('principio_activo', {
      fields: ['nombre'],
      type: 'unique',
      name: 'uq_principio_activo_nombre'
    });

    await queryInterface.addConstraint('principio_activo', {
      fields: ['estado'],
      type: 'check',
      where: {
        estado: {
          [Sequelize.Op.in]: [0, 1]
        }
      },
      name: 'chk_principio_activo_estado'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('principio_activo');
  }
};
