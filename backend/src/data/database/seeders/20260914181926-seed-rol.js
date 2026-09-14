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
    await queryInterface.bulkInsert('rol', [
      {
        id_rol: 1,
        nombre: 'Administrador',
        descripcion: 'Gestion y autorizaciones',
        estado: true
      },
      {
        id_rol: 2,
        nombre: 'Regente',
        descripcion: 'Revision de recetas e inventario',
        estado: true
      },
      {
        id_rol: 3,
        nombre: 'Vendedor',
        descripcion: 'Registro de ventas',
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
    await queryInterface.bulkDelete('rol', {
      id_rol: {
        [Sequelize.Op.in]: [1, 2, 3]
      }
    });
  }
};
