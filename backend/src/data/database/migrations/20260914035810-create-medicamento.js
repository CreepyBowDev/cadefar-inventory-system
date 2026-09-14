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
    await queryInterface.createTable('medicamento', {
      id_medicamento: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_proveedor_laboratorio: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'proveedor_laboratorio',
          key: 'id_proveedor_laboratorio'
        }
      },

      codigo_medicamento: {
        type: Sequelize.STRING(20),
        allowNull: false
      },

      nombre_comercial: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      forma_farmaceutica: {
        type: Sequelize.STRING(80),
        allowNull: false
      },

      presentacion: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      unidad_inventario: {
        type: Sequelize.STRING(50),
        allowNull: false
      },

      stock_minimo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      condicion_venta: {
        type: Sequelize.STRING(40),
        allowNull: false
      },

      via_administracion: {
        type: Sequelize.STRING(80),
        allowNull: false
      },

      tipo_liberacion: {
        type: Sequelize.STRING(80),
        allowNull: false
      },

      estado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    });


    await queryInterface.addConstraint('medicamento', {
      fields: ['codigo_medicamento'],
      type: 'unique',
      name: 'uq_medicamento_codigo'
    });


    await queryInterface.addConstraint('medicamento', {
      fields: ['stock_minimo'],
      type: 'check',
      where: {
        stock_minimo: {
          [Sequelize.Op.gte]: 0
        }
      },
      name: 'chk_medicamento_stock_minimo'
    });


    await queryInterface.addConstraint('medicamento', {
      fields: ['estado'],
      type: 'check',
      where: {
        estado: {
          [Sequelize.Op.in]: [0, 1]
        }
      },
      name: 'chk_medicamento_estado'
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('medicamento');
  }
};
