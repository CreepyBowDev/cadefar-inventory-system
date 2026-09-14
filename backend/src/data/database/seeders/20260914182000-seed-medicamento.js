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
    await queryInterface.bulkInsert('medicamento', [
      {
        id_medicamento: 1,
        id_proveedor_laboratorio: 1,
        codigo_medicamento: 'PAR001',
        nombre_comercial: 'Paracetamol Demo A',
        forma_farmaceutica: 'TABLETA',
        presentacion: 'TABLETAS',
        unidad_inventario: 'TABLETA',
        stock_minimo: 10,
        condicion_venta: 'LIBRE',
        via_administracion: 'ORAL',
        tipo_liberacion: 'INMEDIATA',
        estado: true
      },
      {
        id_medicamento: 2,
        id_proveedor_laboratorio: 2,
        codigo_medicamento: 'PAR002',
        nombre_comercial: 'Paracetamol Demo B',
        forma_farmaceutica: 'TABLETA',
        presentacion: 'TABLETAS',
        unidad_inventario: 'TABLETA',
        stock_minimo: 10,
        condicion_venta: 'LIBRE',
        via_administracion: 'ORAL',
        tipo_liberacion: 'INMEDIATA',
        estado: true
      },
      {
        id_medicamento: 3,
        id_proveedor_laboratorio: 1,
        codigo_medicamento: 'IBU001',
        nombre_comercial: 'Ibuprofeno Demo A',
        forma_farmaceutica: 'TABLETA',
        presentacion: 'TABLETAS',
        unidad_inventario: 'TABLETA',
        stock_minimo: 10,
        condicion_venta: 'RECETA_MEDICA',
        via_administracion: 'ORAL',
        tipo_liberacion: 'INMEDIATA',
        estado: true
      },
      {
        id_medicamento: 4,
        id_proveedor_laboratorio: 2,
        codigo_medicamento: 'AMO001',
        nombre_comercial: 'Amoxicilina Demo A',
        forma_farmaceutica: 'CAPSULA',
        presentacion: 'CAPSULAS',
        unidad_inventario: 'CAPSULA',
        stock_minimo: 10,
        condicion_venta: 'RECETA_MEDICA',
        via_administracion: 'ORAL',
        tipo_liberacion: 'INMEDIATA',
        estado: true
      },
      {
        id_medicamento: 5,
        id_proveedor_laboratorio: 3,
        codigo_medicamento: 'LOR001',
        nombre_comercial: 'Loratadina Demo A',
        forma_farmaceutica: 'TABLETA',
        presentacion: 'TABLETAS',
        unidad_inventario: 'TABLETA',
        stock_minimo: 10,
        condicion_venta: 'LIBRE',
        via_administracion: 'ORAL',
        tipo_liberacion: 'INMEDIATA',
        estado: true
      },
      {
        id_medicamento: 6,
        id_proveedor_laboratorio: 3,
        codigo_medicamento: 'COM001',
        nombre_comercial: 'Combinado Demo A',
        forma_farmaceutica: 'TABLETA',
        presentacion: 'TABLETAS',
        unidad_inventario: 'TABLETA',
        stock_minimo: 10,
        condicion_venta: 'RECETA_MEDICA',
        via_administracion: 'ORAL',
        tipo_liberacion: 'INMEDIATA',
        estado: true
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
    await queryInterface.bulkDelete('medicamento', {
      id_medicamento: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5, 6]
      }
    });
  }
};
