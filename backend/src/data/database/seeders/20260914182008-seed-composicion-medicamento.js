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
    await queryInterface.bulkInsert('composicion_medicamento', [
      {
        id_composicion: 1,
        id_medicamento: 1,
        id_principio_activo: 1,
        cantidad_principio_activo: 500,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'TABLETA'
      },
      {
        id_composicion: 2,
        id_medicamento: 2,
        id_principio_activo: 1,
        cantidad_principio_activo: 500,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'TABLETA'
      },
      {
        id_composicion: 3,
        id_medicamento: 3,
        id_principio_activo: 2,
        cantidad_principio_activo: 400,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'TABLETA'
      },
      {
        id_composicion: 4,
        id_medicamento: 4,
        id_principio_activo: 3,
        cantidad_principio_activo: 500,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'CAPSULA'
      },
      {
        id_composicion: 5,
        id_medicamento: 5,
        id_principio_activo: 4,
        cantidad_principio_activo: 10,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'TABLETA'
      },
      {
        id_composicion: 6,
        id_medicamento: 6,
        id_principio_activo: 1,
        cantidad_principio_activo: 500,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'TABLETA'
      },
      {
        id_composicion: 7,
        id_medicamento: 6,
        id_principio_activo: 5,
        cantidad_principio_activo: 65,
        unidad_principio_activo: 'mg',
        cantidad_referencia: 1,
        unidad_referencia: 'TABLETA'
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
    await queryInterface.bulkDelete('composicion_medicamento', {
      id_composicion: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6, 7]
      }
    });
  }
};
