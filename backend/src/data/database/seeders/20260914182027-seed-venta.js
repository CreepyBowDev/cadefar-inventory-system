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
    await queryInterface.bulkInsert('venta', [
      {
        id_venta: 1,
        id_usuario: 3,
        fecha_venta: '2026-09-05 09:00:00',
        fecha_registro: '2026-09-05 08:59:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-VENTA-001',
        total: 31,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      },
      {
        id_venta: 2,
        id_usuario: 3,
        fecha_venta: '2026-09-05 10:00:00',
        fecha_registro: '2026-09-05 09:49:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-VENTA-002',
        total: 15.2,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      },
      {
        id_venta: 3,
        id_usuario: 3,
        fecha_venta: '2026-09-05 11:00:00',
        fecha_registro: '2026-09-05 10:59:00',
        estado_operacion: 'CONFIRMADA',
        clave_operacion: 'DEMO-VENTA-003',
        total: 6,
        fecha_anulacion: null,
        motivo_anulacion: null,
        id_usuario_anulador: null
      },
      {
        id_venta: 4,
        id_usuario: 3,
        fecha_venta: '2026-09-05 12:00:00',
        fecha_registro: '2026-09-05 11:59:00',
        estado_operacion: 'ANULADA',
        clave_operacion: 'DEMO-VENTA-004',
        total: 2.4,
        fecha_anulacion: '2026-09-05 12:05:00',
        motivo_anulacion: 'Cancelada antes de entregar los productos',
        id_usuario_anulador: 1
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
    await queryInterface.bulkDelete('venta', {
      id_venta: {
        [Sequelize.Op.in]: [1, 2, 3, 4]
      }
    });
  }
};
