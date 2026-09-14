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
    await queryInterface.bulkInsert('usuario', [
      {
        id_usuario: 1,
        id_rol: 1,
        nombre_usuario: 'admin_demo',
        password_hash: '$argon2id$v=19$m=19456,t=2,p=1$I2nB2716AiX0xR3Ecqdekw$8b2gH2y4refRjdmFNXb7B77L4gQ9S6UwAk8gR0pgBeg',
        estado: true
      },
      {
        id_usuario: 2,
        id_rol: 2,
        nombre_usuario: 'farmaceutico_demo',
        password_hash: '$argon2id$v=19$m=19456,t=2,p=1$e3byF23wv5BfTXC86ozs6w$bl50wNkPzwUmg3Wber5OBFN3TF/3dsdnL2xKr1BTz74',
        estado: true
      },
      {
        id_usuario: 3,
        id_rol: 3,
        nombre_usuario: 'cajero_demo',
        password_hash: '$argon2id$v=19$m=19456,t=2,p=1$I91+O7sp+WYwHHyC1j8sVQ$MbgCId8bi8jVayUJ3MJjKQXVzcJVmPZ11ZXU5QAycZg',
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
