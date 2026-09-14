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
    await queryInterface.createTable('rol', {
      id_rol: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      nombre: {
        type: Sequelize.STRING(60),
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

    await queryInterface.addConstraint('rol', {
      fields: ['nombre'],
      type: 'unique',
      name: 'uq_rol_nombre'
    });


    await queryInterface.addConstraint('rol', {
      fields: ['estado'],
      type: 'check',
      where: {
        estado: {
          [Sequelize.Op.in]: [0, 1]
        }
      },
      name: 'chk_rol_estado'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('rol');
  }
};
