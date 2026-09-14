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
    await queryInterface.bulkInsert('detalle_compra', [
      { id_detalle_compra: 1, id_compra: 1, id_existencia: 1, cantidad: 100, costo_unitario: 0.5, subtotal: 50.00 },
      { id_detalle_compra: 2, id_compra: 1, id_existencia: 2, cantidad: 30, costo_unitario: 0.4, subtotal: 12.00 },
      { id_detalle_compra: 3, id_compra: 1, id_existencia: 4, cantidad: 50, costo_unitario: 1, subtotal: 50.00 },
      { id_detalle_compra: 4, id_compra: 1, id_existencia: 8, cantidad: 20, costo_unitario: 0.55, subtotal: 11.00 },
      { id_detalle_compra: 5, id_compra: 2, id_existencia: 3, cantidad: 80, costo_unitario: 0.8, subtotal: 64.00 },
      { id_detalle_compra: 6, id_compra: 2, id_existencia: 5, cantidad: 60, costo_unitario: 1.5, subtotal: 90.00 },
      { id_detalle_compra: 7, id_compra: 3, id_existencia: 6, cantidad: 12, costo_unitario: 0.9, subtotal: 10.80 },
      { id_detalle_compra: 8, id_compra: 3, id_existencia: 7, cantidad: 40, costo_unitario: 1.2, subtotal: 48.00 },
      { id_detalle_compra: 9, id_compra: 4, id_existencia: 1, cantidad: 100, costo_unitario: 0.7, subtotal: 70.00 }
    ]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('detalle_compra', {
      id_detalle_compra: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6, 7, 8, 9]
      }
    });
  }
};
