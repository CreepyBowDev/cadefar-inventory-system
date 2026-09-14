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
    await queryInterface.bulkInsert('receta', [
      {
        id_receta: 1,
        id_venta: 2,
        id_usuario_validador: 2,
        numero_receta: 'DEMO-RX-001',
        fecha_receta: '2026-09-04',
        nombre_paciente: 'Paciente de prueba',
        documento_paciente: 'DEMO-PAC-001',
        nombre_medico: 'Profesional de prueba',
        archivo_receta: 'demo/receta_001.pdf',
        modalidad: 'RECETA_MEDICA',
        resultado_revision: 'APROBADA',
        fecha_validacion: '2026-09-05 09:55:00',
        fecha_registro: '2026-09-05 09:50:00',
        observacion: 'Registro ficticio. La ruta no corresponde a un archivo adjunto real.'
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
    await queryInterface.bulkDelete('receta', {
      id_receta: {
        [Sequelize.Op.in]: [1]
      }
    });
  }
};
