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
    await queryInterface.bulkInsert('detalle_venta', [
      { id_detalle_venta: 1, id_venta: 1, id_receta: null, id_existencia: 8, cantidad: 20, precio_unitario: 1, subtotal: 20.00 },
      { id_detalle_venta: 2, id_venta: 1, id_receta: null, id_existencia: 1, cantidad: 5, precio_unitario: 1, subtotal: 5.00 },
      { id_detalle_venta: 3, id_venta: 1, id_receta: null, id_existencia: 3, cantidad: 5, precio_unitario: 1.2, subtotal: 6.00 },
      { id_detalle_venta: 4, id_venta: 2, id_receta: 1, id_existencia: 4, cantidad: 2, precio_unitario: 1.6, subtotal: 3.20 },
      { id_detalle_venta: 5, id_venta: 2, id_receta: 1, id_existencia: 5, cantidad: 6, precio_unitario: 2, subtotal: 12.00 },
      { id_detalle_venta: 6, id_venta: 3, id_receta: null, id_existencia: 6, cantidad: 4, precio_unitario: 1.5, subtotal: 6.00 },
      { id_detalle_venta: 7, id_venta: 4, id_receta: null, id_existencia: 3, cantidad: 2, precio_unitario: 1.2, subtotal: 2.40 }
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('detalle_venta', {
      id_detalle_venta: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6, 7]
      }
    });
  }
};
