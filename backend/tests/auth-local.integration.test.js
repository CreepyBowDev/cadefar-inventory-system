import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { huellaBase } from './helpers/huella-pagos.js';

test('Identidad real solo lectura y seguridad local transaccional en MySQL (sin conocer la contraseña)', {
    skip: process.env.CADEFAR_AUTORIZAR_PAGOS_LOCAL !== '1', timeout: 30000
}, async t => {
    dotenv.config({ quiet: true });
    const { default: entorno } = await import('../src/shared/utils/pagos-entorno.cjs');
    assert.equal(entorno.esPruebaLocal(), true);
    const { default: db } = await import('../src/data/models/index.js');
    assert.equal(db.sequelize.config.database, entorno.BASE_PRUEBAS);
    const [baseActiva] = await db.sequelize.query('SELECT DATABASE() AS nombre');
    assert.equal(baseActiva[0].nombre, entorno.BASE_PRUEBAS);
    const { authLocalRepository } = await import('../src/data/repositories/auth-local.repository.js');
    const c = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.PASSWORD_DB });
    const baseline = await huellaBase(c, entorno.BASE_IDENTIDAD);
    try {
        await t.test('Credenciales originales leídas en backend, rol real y sin cuentas/hashes copiados', async () => {
            const u = await authLocalRepository.leerCredenciales('admin_demo');
            assert.ok(u?.estado); assert.equal(u.id_rol, 1); assert.equal(u.nombre_usuario, 'admin_demo');
            assert.equal(typeof u.password_hash, 'string'); assert.ok(u.password_hash.startsWith('$2'));
            const [users] = await db.sequelize.query('SELECT COUNT(*) AS cantidad FROM usuario');
            const [roles] = await db.sequelize.query('SELECT COUNT(*) AS cantidad FROM rol');
            assert.equal(Number(users[0].cantidad), 0); assert.equal(Number(roles[0].cantidad), 0);
            const [columns] = await db.sequelize.query('SHOW COLUMNS FROM seguridad_login_local');
            assert.deepEqual(columns.map(c => c.Field), ['id_usuario', 'version_credenciales', 'intentos_fallidos_login', 'bloqueado_hasta']);
        });
        await t.test('Contadores se bloquean y actualizan solo en la base aislada; rollback real', async () => {
            const rollback = new Error('Rollback deliberado de la comprobación');
            await assert.rejects(() => db.sequelize.transaction(async transaction => {
                const u = await authLocalRepository.findByNombreUsuario({ nombreUsuario: 'admin_demo', transaction });
                assert.ok(u?.estado);
                const [before] = await db.sequelize.query('SELECT * FROM seguridad_login_local WHERE id_usuario=:id', {
                    replacements: { id: u.id_usuario }, transaction
                });
                assert.equal(before.length, 1);
                await authLocalRepository.updateLoginSecurity({ idUsuario: u.id_usuario, intentosFallidosLogin: 2,
                    bloqueadoHasta: new Date('2099-01-01T00:00:00.123Z'), transaction });
                const [after] = await db.sequelize.query("SELECT intentos_fallidos_login,DATE_FORMAT(bloqueado_hasta,'%Y-%m-%d %H:%i:%s.%f') AS hasta FROM seguridad_login_local WHERE id_usuario=:id", {
                    replacements: { id: u.id_usuario }, transaction
                });
                assert.equal(after[0].intentos_fallidos_login, 2); assert.equal(after[0].hasta, '2099-01-01 00:00:00.123000');
                throw rollback;
            }), error => error === rollback);
        });
        await t.test('La consulta habitual de Usuarios conserva roles públicos y no expone credenciales', async () => {
            const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
            const usuarios = await usuarioRepository.findAllUsuarios();
            const admin = usuarios.find(u => u.nombre_usuario === 'admin_demo');
            assert.ok(admin); assert.equal(admin.rol.id_rol, 1);
            for (const u of usuarios) assert.deepEqual(Object.keys(u).sort(), ['correo', 'estado', 'id_usuario', 'nombre_usuario', 'rol']);
            assert.deepEqual(await usuarioRepository.findById({ idUsuario: admin.id_usuario }), admin);
            assert.equal(await usuarioRepository.findById({ idUsuario: 2147483647 }), null);
        });
        assert.equal(await huellaBase(c, entorno.BASE_IDENTIDAD), baseline);
        t.diagnostic('MySQL real; sin nuevas cuentas ni contraseñas. Huella original intacta. Escritura auxiliar de prueba revertida.');
    } finally { await db.sequelize.close(); await c.end(); }
});
