'use strict';

/** Conservar las migraciones históricas. Ejecutar con el backend detenido y
 * autorización del responsable: MySQL DDL hace commit implícito. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [row] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) AS cantidad FROM recuperacion_password
      WHERE payload_envio_cifrado IS NOT NULL OR envio_intentos <> 0
         OR envio_proximo_en IS NOT NULL OR envio_bloqueado_hasta IS NOT NULL
    `, { type: Sequelize.QueryTypes.SELECT, logging: false });
    if (Number(row.cantidad) > 0) {
      throw new Error('Simplificación detenida: existen datos de envío. Revisar y autorizar su tratamiento antes de continuar.');
    }
    // Un solo ALTER evita un esquema intermedio entre cuatro removeColumn.
    // Conserva las filas, los nueve atributos funcionales y SequelizeMeta.
    await queryInterface.sequelize.query(`ALTER TABLE recuperacion_password
      DROP INDEX idx_recuperacion_envio_proximo,
      DROP COLUMN payload_envio_cifrado,
      DROP COLUMN envio_intentos,
      DROP COLUMN envio_proximo_en,
      DROP COLUMN envio_bloqueado_hasta`, { logging: false });
  },

  async down() {
    throw new Error('Sin rollback automático: restaurar columnas no recupera mensajes ni habilita el procesador retirado. Requiere un plan explícito.');
  }
};
