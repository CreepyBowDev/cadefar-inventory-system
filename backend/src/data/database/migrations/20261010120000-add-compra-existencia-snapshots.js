'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Un único ALTER mantiene juntas las columnas y su restricción en MySQL.
    // NULL representa información histórica no disponible; no hay backfill.
    // IS NOT NULL evita que un par incompleto pase el CHECK como UNKNOWN.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`detalle_compra\`
        ADD COLUMN \`saldo_anterior\` INT NULL,
        ADD COLUMN \`costo_promedio_anterior\` DECIMAL(14,6) NULL,
        ADD CONSTRAINT \`chk_detalle_compra_estado_anterior\`
          CHECK (
            (\`saldo_anterior\` IS NULL AND \`costo_promedio_anterior\` IS NULL)
            OR (
              \`saldo_anterior\` IS NOT NULL
              AND \`costo_promedio_anterior\` IS NOT NULL
              AND \`saldo_anterior\` >= 0
              AND \`costo_promedio_anterior\` >= 0
            )
          );
    `);
  },

  async down(queryInterface, Sequelize) {
    const [resultado] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS con_estado_anterior FROM `detalle_compra` WHERE `saldo_anterior` IS NOT NULL OR `costo_promedio_anterior` IS NOT NULL;',
      { type: Sequelize.QueryTypes.SELECT }
    );
    if (Number(resultado.con_estado_anterior) > 0) {
      throw new Error('No se puede revertir: existen detalles de compra con estado anterior. Se debe conservar esa información histórica.');
    }

    // Los CHECK requieren DROP CHECK: removeConstraint de Sequelize 6 en MySQL
    // trata las restricciones que no son FK como índices.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`detalle_compra\`
        DROP CHECK \`chk_detalle_compra_estado_anterior\`,
        DROP COLUMN \`saldo_anterior\`,
        DROP COLUMN \`costo_promedio_anterior\`;
    `);
  }
};
