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
    await queryInterface.createTable('receta', {
      id_receta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      id_venta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'venta',
          key: 'id_venta'
        }
      },

      id_usuario_validador: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'usuario',
          key: 'id_usuario'
        }
      },

      numero_receta: {
        type: Sequelize.STRING(80),
        allowNull: true
      },

      fecha_receta: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },

      nombre_paciente: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      documento_paciente: {
        type: Sequelize.STRING(40),
        allowNull: false
      },

      nombre_medico: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      archivo_receta: {
        type: Sequelize.STRING(500),
        allowNull: false
      },

      modalidad: {
        type: Sequelize.STRING(50),
        allowNull: false
      },

      resultado_revision: {
        type: Sequelize.ENUM('APROBADA', 'RECHAZADA'),
        allowNull: true
      },

      fecha_validacion: {
        type: Sequelize.DATE,
        allowNull: true
      },

      fecha_registro: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      observacion: {
        type: Sequelize.STRING(500),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('receta');
  }
};
