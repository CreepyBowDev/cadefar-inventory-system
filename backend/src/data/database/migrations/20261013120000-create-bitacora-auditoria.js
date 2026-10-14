'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Un único CREATE evita una tabla parcialmente definida si falla un índice
    // o CHECK. DATETIME contiene texto UTC, no depende de @@session.time_zone.
    // Referencias lógicas sin FK/cascadas; no se reconstruyen eventos antiguos.
    await queryInterface.sequelize.query(`
      CREATE TABLE \`bitacora_auditoria\` (
        \`id_evento\` INT NOT NULL AUTO_INCREMENT,
        \`tipo_evento\` VARCHAR(80) NOT NULL,
        \`modulo\` VARCHAR(32) NOT NULL,
        \`accion\` VARCHAR(60) NOT NULL,
        \`resultado\` VARCHAR(12) NOT NULL,
        \`causa\` VARCHAR(64) NULL,
        \`fecha_registro\` DATETIME(3) NOT NULL,
        \`fecha_evento\` DATETIME(3) NOT NULL,
        \`id_usuario_responsable\` INT NULL,
        \`nombre_usuario_responsable\` VARCHAR(60) NULL,
        \`id_rol_responsable\` INT NULL,
        \`id_usuario_objetivo\` INT NULL,
        \`nombre_usuario_objetivo\` VARCHAR(60) NULL,
        \`id_rol_objetivo\` INT NULL,
        \`nombre_ingresado\` VARCHAR(60) NULL,
        \`direccion_ip\` VARCHAR(45) NULL,
        \`procedencia_ip\` VARCHAR(24) NOT NULL,
        \`tipo_registro\` VARCHAR(32) NULL,
        \`id_registro\` INT NULL,
        \`correlacion\` CHAR(32) NOT NULL,
        \`id_evento_relacionado\` INT NULL,
        \`version_formato\` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
        \`antes\` JSON NULL,
        \`despues\` JSON NULL,
        \`metadatos\` JSON NULL,
        \`referencias\` JSON NULL,
        PRIMARY KEY (\`id_evento\`),
        KEY \`idx_bitacora_fecha\` (\`fecha_registro\`, \`id_evento\`),
        KEY \`idx_bitacora_responsable\` (\`id_usuario_responsable\`, \`fecha_registro\`, \`id_evento\`),
        KEY \`idx_bitacora_objetivo\` (\`id_usuario_objetivo\`, \`fecha_registro\`, \`id_evento\`),
        KEY \`idx_bitacora_modulo_accion\` (\`modulo\`, \`accion\`, \`fecha_registro\`, \`id_evento\`),
        KEY \`idx_bitacora_resultado\` (\`resultado\`, \`fecha_registro\`, \`id_evento\`),
        KEY \`idx_bitacora_registro\` (\`tipo_registro\`, \`id_registro\`, \`fecha_registro\`, \`id_evento\`),
        UNIQUE KEY \`uq_bitacora_solicitud_tipo\` (\`correlacion\`, \`tipo_evento\`),
        CONSTRAINT \`chk_bitacora_resultado\` CHECK (\`resultado\` IN ('EXITO', 'RECHAZADO', 'FALLO')),
        CONSTRAINT \`chk_bitacora_registro\` CHECK (
          (\`tipo_registro\` IS NULL AND \`id_registro\` IS NULL) OR
          (\`tipo_registro\` IS NOT NULL AND \`id_registro\` IS NOT NULL AND \`id_registro\` > 0)
        ),
        CONSTRAINT \`chk_bitacora_responsable\` CHECK (
          (\`id_usuario_responsable\` IS NULL AND \`nombre_usuario_responsable\` IS NULL AND \`id_rol_responsable\` IS NULL) OR
          (\`id_usuario_responsable\` IS NOT NULL AND \`id_usuario_responsable\` > 0 AND
           \`nombre_usuario_responsable\` IS NOT NULL AND \`id_rol_responsable\` IS NOT NULL AND \`id_rol_responsable\` IN (1, 2, 3))
        ),
        CONSTRAINT \`chk_bitacora_objetivo\` CHECK (
          (\`id_usuario_objetivo\` IS NULL AND \`nombre_usuario_objetivo\` IS NULL AND \`id_rol_objetivo\` IS NULL) OR
          (\`id_usuario_objetivo\` IS NOT NULL AND \`id_usuario_objetivo\` > 0 AND
           \`nombre_usuario_objetivo\` IS NOT NULL AND \`id_rol_objetivo\` IS NOT NULL AND \`id_rol_objetivo\` IN (1, 2, 3))
        ),
        CONSTRAINT \`chk_bitacora_ip\` CHECK (
          (\`procedencia_ip\` = 'NO_DISPONIBLE' AND \`direccion_ip\` IS NULL) OR
          (\`procedencia_ip\` = 'SOCKET_PEER' AND \`direccion_ip\` IS NOT NULL)
        ),
        CONSTRAINT \`chk_bitacora_referencia\` CHECK (\`id_evento_relacionado\` IS NULL OR \`id_evento_relacionado\` > 0),
        CONSTRAINT \`chk_bitacora_version\` CHECK (\`version_formato\` > 0)
      ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    `);
  },

  async down() {
    // Un SELECT de tabla vacía seguido de DROP tendría una carrera con INSERT.
    // No se ofrece borrado automático ni siquiera mediante db:migrate:undo.
    throw new Error('La Bitácora no admite reversión destructiva automática. Su conservación mínima es de 60 meses; cualquier retiro del esquema requiere un procedimiento extraordinario aprobado.');
  }
};
