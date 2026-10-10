'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Sequelize 6 no aplica collation por columna mediante addColumn.
    // Un único ALTER conserva juntos los campos y la unicidad en MySQL.
    await queryInterface.sequelize.query(`
      ALTER TABLE \`usuario\`
        ADD COLUMN \`correo\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
        ADD COLUMN \`version_credenciales\` INT UNSIGNED NOT NULL DEFAULT 0,
        ADD CONSTRAINT \`uq_usuario_correo\` UNIQUE (\`correo\`);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE \`usuario\`
        DROP INDEX \`uq_usuario_correo\`,
        DROP COLUMN \`version_credenciales\`,
        DROP COLUMN \`correo\`;
    `);
  }
};
