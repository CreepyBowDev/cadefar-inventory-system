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
    await queryInterface.createTable('composicion_medicamento', {
      id_composicion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_medicamento: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'medicamento',
          key: 'id_medicamento'
        }
      },

      id_principio_activo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'principio_activo',
          key: 'id_principio_activo'
        }
      },

      cantidad_principio_activo: {
        type: Sequelize.DECIMAL(12, 4),
        allowNull: false
      },

      unidad_principio_activo: {
        type: Sequelize.STRING(30),
        allowNull: false
      },

      cantidad_referencia: {
        type: Sequelize.DECIMAL(12, 4),
        allowNull: false
      },

      unidad_referencia: {
        type: Sequelize.STRING(30),
        allowNull: false
      }
    });


    await queryInterface.addConstraint('composicion_medicamento', {
      fields: ['id_medicamento', 'id_principio_activo'],
      type: 'unique',
      name: 'uq_composicion_medicamento_principio'
    });


    await queryInterface.addConstraint('composicion_medicamento', {
      fields: ['cantidad_principio_activo'],
      type: 'check',
      where: {
        cantidad_principio_activo: {
          [Sequelize.Op.gt]: 0
        }
      },
      name: 'chk_composicion_cantidad_principio'
    });


    await queryInterface.addConstraint('composicion_medicamento', {
      fields: ['cantidad_referencia'],
      type: 'check',
      where: {
        cantidad_referencia: {
          [Sequelize.Op.gt]: 0
        }
      },
      name: 'chk_composicion_cantidad_referencia'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('composicion_medicamento');
  }
};
