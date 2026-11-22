'use strict';

const entorno = require('../../../shared/utils/pagos-entorno.cjs');

module.exports = {
    async up(queryInterface) {
        if (!entorno.esPruebaLocal()) throw new Error('Migración exclusiva del entorno local');
        const [rows] = await queryInterface.sequelize.query('SELECT DATABASE() AS nombre', { logging: false });
        if (rows[0]?.nombre !== entorno.BASE_PRUEBAS) throw new Error('Destino de autenticación local incorrecto');
        // Solo estado de seguridad. No contiene cuentas, contraseñas, hashes ni JWT.
        await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS \`cadefar_pagos_pruebas\`.\`seguridad_login_local\` (
            id_usuario INT NOT NULL PRIMARY KEY,
            version_credenciales INT UNSIGNED NOT NULL,
            intentos_fallidos_login INT UNSIGNED NOT NULL DEFAULT 0,
            bloqueado_hasta DATETIME(3) NULL
        ) ENGINE=InnoDB`, { logging: false });
    },
    async down() {
        throw new Error('No se elimina automáticamente el estado de seguridad local');
    }
};
