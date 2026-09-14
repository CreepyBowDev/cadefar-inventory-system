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
    await queryInterface.createTable('existencia_medicamento', {
      id_existencia: {
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

      codigo_existencia: {
        type: Sequelize.STRING(30),
        allowNull: false
      },

      fecha_vencimiento: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },

      precision_vencimiento: {
        type: Sequelize.ENUM('DIA', 'MES'),
        allowNull: false
      },

      cantidad_fisica: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      costo_unitario_promedio: {
        type: Sequelize.DECIMAL(14, 6),
        allowNull: false,
        defaultValue: 0
      }
    });


    await queryInterface.addConstraint('existencia_medicamento', {
      fields: ['codigo_existencia'],
      type: 'unique',
      name: 'uq_existencia_codigo'
    });


    await queryInterface.addConstraint('existencia_medicamento', {
      fields: [
        'id_medicamento',
        'fecha_vencimiento',
        'precision_vencimiento'
      ],
      type: 'unique',
      name: 'uq_existencia_medicamento_vencimiento_precision'
    });


    await queryInterface.addConstraint('existencia_medicamento', {
      fields: ['cantidad_fisica'],
      type: 'check',
      where: {
        cantidad_fisica: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_existencia_cantidad_fisica'
    });


    await queryInterface.addConstraint('existencia_medicamento', {
      fields: ['costo_unitario_promedio'],
      type: 'check',
      where: {
        costo_unitario_promedio: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_existencia_costo_unitario_promedio'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('existencia_medicamento');
  }
};
