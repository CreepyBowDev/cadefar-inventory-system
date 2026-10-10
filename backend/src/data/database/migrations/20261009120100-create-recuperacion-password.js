'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('recuperacion_password', {
      id_recuperacion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
      },
      id_usuario: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'usuario', key: 'id_usuario' },
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT'
      },
      codigo_hmac: {
        type: Sequelize.CHAR(64),
        allowNull: false
      },
      nonce: {
        type: Sequelize.CHAR(36),
        allowNull: false
      },
      fecha_solicitud: {
        type: Sequelize.DATE(3),
        allowNull: false
      },
      expira_en: {
        type: Sequelize.DATE(3),
        allowNull: false
      },
      intentos_fallidos: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      consumida_en: {
        type: Sequelize.DATE(3),
        allowNull: true
      },
      invalidada_en: {
        type: Sequelize.DATE(3),
        allowNull: true
      },
      payload_envio_cifrado: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      envio_intentos: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },
      envio_proximo_en: {
        type: Sequelize.DATE(3),
        allowNull: true
      },
      envio_bloqueado_hasta: {
        type: Sequelize.DATE(3),
        allowNull: true
      }
    });

    await queryInterface.addIndex('recuperacion_password', ['nonce'], {
      name: 'uq_recuperacion_nonce', unique: true
    });
    await queryInterface.addIndex('recuperacion_password', ['id_usuario', 'fecha_solicitud', 'id_recuperacion'], {
      name: 'idx_recuperacion_usuario_solicitud'
    });
    await queryInterface.addIndex('recuperacion_password', ['envio_proximo_en'], {
      name: 'idx_recuperacion_envio_proximo'
    });
    await queryInterface.addIndex('recuperacion_password', ['expira_en'], {
      name: 'idx_recuperacion_expira'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recuperacion_password');
  }
};
