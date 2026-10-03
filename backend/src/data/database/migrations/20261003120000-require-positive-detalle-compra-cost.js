'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Sustituir el CHECK en un único ALTER. Si existen costos cero,
    // la BD rechaza el cambio sin corregir ni eliminar datos históricos.
    // Sequelize 6 en MySQL trata removeConstraint como DROP INDEX para
    // restricciones que no son FK. Un CHECK requiere DROP CHECK.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`detalle_compra\`
        DROP CHECK \`chk_detalle_compra_costo_unitario\`,
        ADD CONSTRAINT \`chk_detalle_compra_costo_positivo\`
          CHECK (\`costo_unitario\` > 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE \`detalle_compra\`
        DROP CHECK \`chk_detalle_compra_costo_positivo\`,
        ADD CONSTRAINT \`chk_detalle_compra_costo_unitario\`
          CHECK (\`costo_unitario\` >= 0);
    `);
  }
};
