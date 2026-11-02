'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Solo nulabilidad: conservar columna, referencias históricas y demás campos.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`receta\`
        MODIFY COLUMN \`archivo_receta\` VARCHAR(500) NULL,
        ALGORITHM=INPLACE, LOCK=EXCLUSIVE;
    `);
  },

  async down(queryInterface, Sequelize) {
    const [resultado] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS incompatibles FROM `receta` WHERE `archivo_receta` IS NULL;',
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (Number(resultado.incompatibles) > 0) {
      throw new Error('No se puede revertir: existen recetas sin archivo. No se modificarán ni eliminarán esos registros.');
    }
    // INPLACE exige modo estricto para pasar a NOT NULL: si aparece un NULL
    // concurrente, fallar en lugar de convertirlo silenciosamente a texto vacío.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`receta\`
        MODIFY COLUMN \`archivo_receta\` VARCHAR(500) NOT NULL,
        ALGORITHM=INPLACE, LOCK=EXCLUSIVE;
    `);
  }
};
