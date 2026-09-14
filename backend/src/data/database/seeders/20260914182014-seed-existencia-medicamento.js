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
    await queryInterface.bulkInsert('existencia_medicamento', [
      {
        id_existencia: 1,
        id_medicamento: 1,
        codigo_existencia: 'PAR001-001',
        fecha_vencimiento: '2027-03-04',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 195,
        costo_unitario_promedio: 0.6
      },
      {
        id_existencia: 2,
        id_medicamento: 1,
        codigo_existencia: 'PAR001-002',
        fecha_vencimiento: '2026-09-04',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 0,
        costo_unitario_promedio: 0.4
      },
      {
        id_existencia: 3,
        id_medicamento: 2,
        codigo_existencia: 'PAR002-001',
        fecha_vencimiento: '2027-09-05',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 75,
        costo_unitario_promedio: 0.8
      },
      {
        id_existencia: 4,
        id_medicamento: 3,
        codigo_existencia: 'IBU001-001',
        fecha_vencimiento: '2027-03-24',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 48,
        costo_unitario_promedio: 1
      },
      {
        id_existencia: 5,
        id_medicamento: 4,
        codigo_existencia: 'AMO001-001',
        fecha_vencimiento: '2027-07-02',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 54,
        costo_unitario_promedio: 1.5
      },
      {
        id_existencia: 6,
        id_medicamento: 5,
        codigo_existencia: 'LOR001-001',
        fecha_vencimiento: '2026-09-25',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 8,
        costo_unitario_promedio: 0.9
      },
      {
        id_existencia: 7,
        id_medicamento: 6,
        codigo_existencia: 'COM001-001',
        fecha_vencimiento: '2027-03-04',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 38,
        costo_unitario_promedio: 1.2
      },
      {
        id_existencia: 8,
        id_medicamento: 1,
        codigo_existencia: 'PAR001-003',
        fecha_vencimiento: '2026-10-05',
        precision_vencimiento: 'DIA',
        cantidad_fisica: 0,
        costo_unitario_promedio: 0.55
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
    await queryInterface.bulkDelete('existencia_medicamento', {
      id_existencia: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6, 7, 8]
      }
    });
  }
};
