'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
    await queryInterface.bulkInsert('compra', [
      {
        id_compra: 1,
        id_usuario: 1,
        id_proveedor_laboratorio: 1,
        fecha_compra: '2026-07-07',
        fecha_registro: '2026-07-07 08:00:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-COMPRA-001',
        total: 123,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      },
      {
        id_compra: 2,
        id_usuario: 1,
        id_proveedor_laboratorio: 2,
        fecha_compra: '2026-07-12',
        fecha_registro: '2026-07-12 08:00:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-COMPRA-002',
        total: 154,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      },
      {
        id_compra: 3,
        id_usuario: 1,
        id_proveedor_laboratorio: 3,
        fecha_compra: '2026-07-17',
        fecha_registro: '2026-07-17 08:00:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-COMPRA-003',
        total: 58.8,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      },
      {
        id_compra: 4,
        id_usuario: 1,
        id_proveedor_laboratorio: 1,
        fecha_compra: '2026-08-06',
        fecha_registro: '2026-08-06 08:00:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-COMPRA-004',
        total: 70,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('compra', {
      id_compra: {
        [Sequelize.Op.in]: [1, 2, 3, 4]
      }
    });
  }
};
