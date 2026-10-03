'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Un único ALTER evita dejar estados y fecha parcialmente modificados.
    // PENDIENTE se agrega al final del ENUM para conservar el orden previo.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`venta\`
        MODIFY COLUMN \`estado_operacion\` ENUM('CONFIRMADA', 'ANULADA', 'PENDIENTE') NOT NULL DEFAULT 'PENDIENTE',
        MODIFY COLUMN \`fecha_venta\` DATETIME NULL,
        ADD CONSTRAINT \`chk_venta_fecha_confirmacion\`
          CHECK (\`estado_operacion\` <> 'CONFIRMADA' OR \`fecha_venta\` IS NOT NULL);
    `);
  },

  async down(queryInterface, Sequelize) {
    const [resultado] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS incompatibles FROM `venta` WHERE `estado_operacion` = 'PENDIENTE' OR `fecha_venta` IS NULL;",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (Number(resultado.incompatibles) > 0) {
      throw new Error(
        'No se puede revertir: existen ventas pendientes o sin fecha de venta. No se modificarán ni eliminarán esos registros.'
      );
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE \`venta\`
        DROP CHECK \`chk_venta_fecha_confirmacion\`,
        MODIFY COLUMN \`estado_operacion\` ENUM('CONFIRMADA', 'ANULADA') NOT NULL DEFAULT 'CONFIRMADA',
        MODIFY COLUMN \`fecha_venta\` DATETIME NOT NULL;
    `);
  }
};
