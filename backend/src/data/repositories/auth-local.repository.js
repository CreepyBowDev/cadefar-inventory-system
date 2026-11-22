import mysql from 'mysql2/promise';
import db from '../models/index.js';
import entorno from '../../shared/utils/pagos-entorno.cjs';

const exigirDestinoLocal = () => {
    if (!entorno.esPruebaLocal() || db.sequelize.config.database !== entorno.BASE_PRUEBAS) {
        throw new Error('Autenticación local no disponible');
    }
};

export class authLocalRepository {
    static async #consultarSoloLectura(sql, parametros = []) {
        exigirDestinoLocal();
        // Conexión breve, sin ORM ni escrituras sobre la identidad original.
        // MySQL impone READ ONLY incluso si se introdujera DML por accidente.
        const connection = await mysql.createConnection({
            host: db.sequelize.config.host, user: db.sequelize.config.username,
            password: db.sequelize.config.password, database: entorno.BASE_IDENTIDAD,
            timezone: '+00:00', connectTimeout: 10000
        });
        try {
            await connection.query('START TRANSACTION READ ONLY');
            const [rows] = await connection.execute(sql, parametros);
            return rows;
        } finally {
            try { await connection.rollback(); } finally { await connection.end(); }
        }
    }

    static async leerCredenciales(nombreUsuario) {
        const rows = await this.#consultarSoloLectura(`SELECT u.id_usuario,u.id_rol,u.nombre_usuario,
            u.password_hash,(u.estado AND r.estado) AS estado,u.version_credenciales,
            u.intentos_fallidos_login,u.bloqueado_hasta
            FROM \`cadefarexamen\`.\`usuario\` u JOIN \`cadefarexamen\`.\`rol\` r ON r.id_rol=u.id_rol
            WHERE u.nombre_usuario=? LIMIT 1`, [nombreUsuario]);
        return rows[0] || null;
    }

    static async findUsuariosPublicos(idUsuario) {
        // Consultar el módulo habitual de Usuarios no implica copiar cuentas ni
        // permitir sus cambios. Nunca seleccionar hashes para estas consultas.
        const rows = await this.#consultarSoloLectura(`SELECT u.id_usuario,u.nombre_usuario,u.correo,u.estado,
            r.id_rol,r.nombre AS rol_nombre,r.descripcion AS rol_descripcion,r.estado AS rol_estado
            FROM \`cadefarexamen\`.\`usuario\` u JOIN \`cadefarexamen\`.\`rol\` r ON r.id_rol=u.id_rol
            ${idUsuario === undefined ? '' : 'WHERE u.id_usuario=?'} ORDER BY u.id_usuario ASC`,
        idUsuario === undefined ? [] : [idUsuario]);
        return rows.map(({ id_rol, rol_nombre, rol_descripcion, rol_estado, ...usuario }) => ({ ...usuario,
            rol: { id_rol, nombre: rol_nombre, descripcion: rol_descripcion, estado: rol_estado } }));
    }

    static async findByNombreUsuario({ nombreUsuario, transaction }) {
        exigirDestinoLocal();
        if (!transaction) throw new Error('La seguridad local requiere una transacción');
        let usuario = await this.leerCredenciales(nombreUsuario);
        if (!usuario || !usuario.estado) return usuario;
        const options = { transaction, logging: false, replacements: {
            id: usuario.id_usuario, version: usuario.version_credenciales
        } };
        // La PK y el bloqueo local serializan intentos concurrentes sin bloquear
        // ni actualizar filas de la base original.
        await db.sequelize.query(`INSERT INTO \`cadefar_pagos_pruebas\`.\`seguridad_login_local\`
            (id_usuario,version_credenciales) VALUES (:id,:version)
            ON DUPLICATE KEY UPDATE id_usuario=id_usuario`, options);
        const [rows] = await db.sequelize.query(`SELECT version_credenciales,intentos_fallidos_login,
            DATE_FORMAT(bloqueado_hasta,'%Y-%m-%dT%H:%i:%s.%fZ') AS bloqueado_hasta
            FROM \`cadefar_pagos_pruebas\`.\`seguridad_login_local\` WHERE id_usuario=:id FOR UPDATE`, options);
        // Releer después de esperar el bloqueo: no autenticar con un hash o
        // estado obtenido antes de otra solicitud concurrente.
        usuario = await this.leerCredenciales(nombreUsuario);
        if (!usuario || usuario.id_usuario !== options.replacements.id) throw new Error('Identidad modificada durante el login');
        const local = rows[0];
        if (local.version_credenciales !== usuario.version_credenciales) {
            await db.sequelize.query(`UPDATE \`cadefar_pagos_pruebas\`.\`seguridad_login_local\`
                SET version_credenciales=:version,intentos_fallidos_login=0,bloqueado_hasta=NULL WHERE id_usuario=:id`,
            { ...options, replacements: { id: usuario.id_usuario, version: usuario.version_credenciales } });
            local.intentos_fallidos_login = 0; local.bloqueado_hasta = null;
        }
        const bloqueoOriginal = usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta);
        const bloqueoLocal = local.bloqueado_hasta && new Date(local.bloqueado_hasta);
        const originalVigente = bloqueoOriginal && bloqueoOriginal > new Date();
        return { ...usuario,
            intentos_fallidos_login: originalVigente ? usuario.intentos_fallidos_login : local.intentos_fallidos_login,
            bloqueado_hasta: originalVigente && (!bloqueoLocal || bloqueoOriginal > bloqueoLocal) ? bloqueoOriginal : bloqueoLocal
        };
    }

    static async updateLoginSecurity({ idUsuario, intentosFallidosLogin, bloqueadoHasta, transaction }) {
        exigirDestinoLocal();
        if (!transaction) throw new Error('La seguridad local requiere una transacción');
        await db.sequelize.query(`UPDATE \`cadefar_pagos_pruebas\`.\`seguridad_login_local\`
            SET intentos_fallidos_login=:intentos,bloqueado_hasta=:hasta WHERE id_usuario=:id`, {
            transaction, logging: false, replacements: { id: idUsuario, intentos: intentosFallidosLogin,
                hasta: bloqueadoHasta ? bloqueadoHasta.toISOString().replace('T', ' ').slice(0, 23) : null }
        });
    }
}
