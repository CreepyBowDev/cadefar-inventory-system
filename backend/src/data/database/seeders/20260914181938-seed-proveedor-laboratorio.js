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
    await queryInterface.bulkInsert('proveedor_laboratorio', [
      {
        id_proveedor_laboratorio: 1,
        nombre: 'Laboratorio Demo Uno',
        telefono: '00000001',
        direccion: 'Direccion ficticia A',
        estado: true
      },
      {
        id_proveedor_laboratorio: 2,
        nombre: 'Laboratorio Demo Dos',
        telefono: '00000002',
        direccion: 'Direccion ficticia B',
        estado: true
      },
      {
        id_proveedor_laboratorio: 3,
        nombre: 'Laboratorio Demo Tres',
        telefono: '00000003',
        direccion: 'Direccion ficticia C',
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
    await queryInterface.bulkDelete('proveedor_laboratorio', {
      id_proveedor_laboratorio: {
        [Sequelize.Op.in]: [1, 2, 3]
      }
    });
  }
};
