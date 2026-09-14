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
    await queryInterface.bulkInsert('principio_activo', [
      {
        id_principio_activo: 1,
        nombre: 'Paracetamol',
        descripcion: 'Catalogo de demostracion',
        estado: true
      },
      {
        id_principio_activo: 2,
        nombre: 'Ibuprofeno',
        descripcion: 'Catalogo de demostracion',
        estado: true
      },
      {
        id_principio_activo: 3,
        nombre: 'Amoxicilina',
        descripcion: 'Catalogo de demostracion',
        estado: true
      },
      {
        id_principio_activo: 4,
        nombre: 'Loratadina',
        descripcion: 'Catalogo de demostracion',
        estado: true
      },
      {
        id_principio_activo: 5,
        nombre: 'Cafeina',
        descripcion: 'Catalogo de demostracion',
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
    await queryInterface.bulkDelete('principio_activo', {
      id_principio_activo: {
        [Sequelize.Op.in]: [1, 2, 3, 4, 5]
      }
    });
  }
};
