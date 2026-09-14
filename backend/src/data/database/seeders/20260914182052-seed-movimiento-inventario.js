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
    await queryInterface.bulkInsert('movimiento_inventario', [
      {
        id_movimiento: 1,
        id_usuario: 1,
        id_existencia: 1,
        id_detalle_compra: 1,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 100,
        fecha_movimiento: '2026-07-07 08:01:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 0.5
      },
      {
        id_movimiento: 2,
        id_usuario: 1,
        id_existencia: 2,
        id_detalle_compra: 2,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 30,
        fecha_movimiento: '2026-07-07 08:02:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 0.4
      },
      {
        id_movimiento: 3,
        id_usuario: 1,
        id_existencia: 4,
        id_detalle_compra: 3,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 50,
        fecha_movimiento: '2026-07-07 08:03:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 1
      },
      {
        id_movimiento: 4,
        id_usuario: 1,
        id_existencia: 8,
        id_detalle_compra: 4,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 20,
        fecha_movimiento: '2026-07-07 08:04:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 0.55
      },
      {
        id_movimiento: 5,
        id_usuario: 1,
        id_existencia: 3,
        id_detalle_compra: 5,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 80,
        fecha_movimiento: '2026-07-12 08:05:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 0.8
      },
      {
        id_movimiento: 6,
        id_usuario: 1,
        id_existencia: 5,
        id_detalle_compra: 6,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 60,
        fecha_movimiento: '2026-07-12 08:06:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 1.5
      },
      {
        id_movimiento: 7,
        id_usuario: 1,
        id_existencia: 6,
        id_detalle_compra: 7,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 12,
        fecha_movimiento: '2026-07-17 08:07:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 0.9
      },
      {
        id_movimiento: 8,
        id_usuario: 1,
        id_existencia: 7,
        id_detalle_compra: 8,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 40,
        fecha_movimiento: '2026-07-17 08:08:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 1.2
      },
      {
        id_movimiento: 9,
        id_usuario: 1,
        id_existencia: 1,
        id_detalle_compra: 9,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'ENTRADA',
        cantidad: 100,
        fecha_movimiento: '2026-08-06 08:09:00',
        motivo: 'COMPRA',
        observacion: null,
        costo_unitario_aplicado: 0.7
      },
      {
        id_movimiento: 10,
        id_usuario: 2,
        id_existencia: 2,
        id_detalle_compra: null,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 30,
        fecha_movimiento: '2026-09-05 08:00:00',
        motivo: 'VENCIMIENTO',
        observacion: 'Retiro fisico completo por vencimiento',
        costo_unitario_aplicado: 0.4
      },
      {
        id_movimiento: 11,
        id_usuario: 2,
        id_existencia: 7,
        id_detalle_compra: null,
        id_detalle_venta: null,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 2,
        fecha_movimiento: '2026-09-05 08:05:00',
        motivo: 'DAÑO',
        observacion: 'Unidades danadas retiradas del inventario',
        costo_unitario_aplicado: 1.2
      },
      {
        id_movimiento: 12,
        id_usuario: 3,
        id_existencia: 8,
        id_detalle_compra: null,
        id_detalle_venta: 1,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 20,
        fecha_movimiento: '2026-09-05 09:01:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 0.55
      },
      {
        id_movimiento: 13,
        id_usuario: 3,
        id_existencia: 1,
        id_detalle_compra: null,
        id_detalle_venta: 2,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 5,
        fecha_movimiento: '2026-09-05 09:02:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 0.6
      },
      {
        id_movimiento: 14,
        id_usuario: 3,
        id_existencia: 3,
        id_detalle_compra: null,
        id_detalle_venta: 3,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 5,
        fecha_movimiento: '2026-09-05 09:03:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 0.8
      },
      {
        id_movimiento: 15,
        id_usuario: 3,
        id_existencia: 4,
        id_detalle_compra: null,
        id_detalle_venta: 4,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 2,
        fecha_movimiento: '2026-09-05 10:04:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 1
      },
      {
        id_movimiento: 16,
        id_usuario: 3,
        id_existencia: 5,
        id_detalle_compra: null,
        id_detalle_venta: 5,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 6,
        fecha_movimiento: '2026-09-05 10:05:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 1.5
      },
      {
        id_movimiento: 17,
        id_usuario: 3,
        id_existencia: 6,
        id_detalle_compra: null,
        id_detalle_venta: 6,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 4,
        fecha_movimiento: '2026-09-05 11:06:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 0.9
      },
      {
        id_movimiento: 18,
        id_usuario: 3,
        id_existencia: 3,
        id_detalle_compra: null,
        id_detalle_venta: 7,
        id_movimiento_original: null,
        direccion: 'SALIDA',
        cantidad: 2,
        fecha_movimiento: '2026-09-05 12:00:00',
        motivo: 'VENTA',
        observacion: null,
        costo_unitario_aplicado: 0.8
      },
      {
        id_movimiento: 19,
        id_usuario: 1,
        id_existencia: 3,
        id_detalle_compra: null,
        id_detalle_venta: 7,
        id_movimiento_original: 18,
        direccion: 'ENTRADA',
        cantidad: 2,
        fecha_movimiento: '2026-09-05 12:05:00',
        motivo: 'ANULACION_VENTA',
        observacion: 'Reversion del movimiento 18',
        costo_unitario_aplicado: 0.8
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
    await queryInterface.bulkDelete('movimiento_inventario', {
      id_movimiento: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
      }
    });
  }
};
