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
    await queryInterface.createTable('usuario', {
      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_rol: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'rol',
          key: 'id_rol'
        }
      },

      nombre_usuario: {
        type: Sequelize.STRING(60),
        allowNull: false
      },

      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      estado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    });


    await queryInterface.addConstraint('usuario', {
      fields: ['nombre_usuario'],
      type: 'unique',
      name: 'uq_usuario_nombre_usuario'
    });


    await queryInterface.addConstraint('usuario', {
      fields: ['estado'],
      type: 'check',
      where: {
        estado: {
          [Sequelize.Op.in]: [0, 1]
        }
      },
      name: 'chk_usuario_estado'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('usuario');
  }
};
