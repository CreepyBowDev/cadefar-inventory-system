'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');

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
    const password = process.env.SEED_USERS_PASSWORD;

    const cumplePolitica =
      password &&
      password.length >= 8 &&
      password.length <= 100 &&
      /\p{Lu}/u.test(password) &&
      /\p{Ll}/u.test(password) &&
      /\p{N}/u.test(password) &&
      /[\p{P}\p{S}]/u.test(password);

    if (!cumplePolitica) {
      throw new Error(
        'SEED_USERS_PASSWORD debe tener entre 8 y 100 caracteres e incluir mayúscula, minúscula, número y carácter especial'
      );
    }

    const passwordHashes = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(password, 10),
      bcrypt.hash(password, 10)
    ]);

    await queryInterface.bulkInsert('usuario', [
      {
        id_usuario: 1,
        id_rol: 1,
        nombre_usuario: 'admin_demo',
        password_hash: passwordHashes[0],
        estado: true
      },
      {
        id_usuario: 2,
        id_rol: 2,
        nombre_usuario: 'farmaceutico_demo',
        password_hash: passwordHashes[1],
        estado: true
      },
      {
        id_usuario: 3,
        id_rol: 3,
        nombre_usuario: 'cajero_demo',
        password_hash: passwordHashes[2],
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
    await queryInterface.bulkDelete('usuario', {
      id_usuario: {
        [Sequelize.Op.in]: [1, 2, 3]
      }
    });
  }
};
