import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const configuredTestDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.equal(Boolean(configuredTestDatabase), true, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.equal(protectedDatabases.some(name => name.toLowerCase() === configuredTestDatabase.toLowerCase()), false, 'Usar una base distinta de desarrollo y producción');
assert.equal(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), true, 'Las pruebas requieren MySQL local');
const temporaryDatabase = `${configuredTestDatabase.slice(0, 40)}_correo_${randomBytes(6).toString('hex')}`;
assert.equal([configuredTestDatabase, ...protectedDatabases].some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;

const executeFile = promisify(execFile);
const backendPath = fileURLToPath(new URL('../', import.meta.url));
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async (...args) => {
    try {
        await executeFile(process.execPath, [cliPath, ...args, '--env', 'test'], {
            cwd: backendPath, env: { ...process.env }, timeout: 30000
        });
    } catch {
        throw new Error(`Sequelize CLI: ${args[0]} falló en la base temporal de pruebas`);
    }
};

// Base temporal exclusiva y commits reales: las carreras no se ejecutan
// dentro de una transacción exterior ni mediante savepoints compartidos.
test('Usuario: correo administrativo, invalidación atómica y carreras reales', { timeout: 120000 }, async (t) => {
    let databaseCreated = false, db, server;
    const originalConsoleError = console.error;
    try {
        await runCli('db:create');
        databaseCreated = true;
        await runCli('db:migrate');
        await runCli('db:seed', '--seed', '20260914181926-seed-rol.js');
        ({ default: db } = await import('../src/data/models/index.js'));
        db.sequelize.options.logging = false;
        const { app } = await import('../src/app.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        const { AppError } = await import('../src/shared/errors/app-error.js');
        const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
        const { recuperacionPasswordRepository } = await import('../src/data/repositories/recuperacion-password.repository.js');
        const unexpectedErrors = [];
        console.error = (error) => {
            if (error?.name !== 'AppError') unexpectedErrors.push(error?.name || 'Error');
        };
        assert.equal(db.sequelize.config.database === temporaryDatabase, true);
        const hash = await bcrypt.hash('Segura-123', 10);
        let fixture = 0, requests = 0;
        const makeUsuario = async (idRol = ROLES.VENDEDOR, extra = {}) => {
            const usuario = await db.Usuario.create({
                id_rol: idRol, nombre_usuario: `correo_fixture_${++fixture}`, password_hash: hash, ...extra
            });
            return { id: usuario.id_usuario, nombre: usuario.nombre_usuario, token: generarToken({ idUsuario: usuario.id_usuario, idRol, versionCredenciales: usuario.version_credenciales }) };
        };
        const admin = await makeUsuario(ROLES.ADMINISTRADOR);
        const makeRecovery = async (usuario, extra = {}) => db.RecuperacionPassword.create({
            id_usuario: usuario.id,
            codigo_hmac: 'a'.repeat(64), nonce: randomUUID(),
            fecha_solicitud: new Date(Date.now() - 10000), expira_en: new Date(Date.now() + 600000),
            intentos_fallidos: 2, ...extra
        });
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (token, method, path, status, body) => {
            const response = await fetch(`${base}${path}`, {
                method, signal: AbortSignal.timeout(15000),
                headers: {
                    ...(token ? { Cookie: `token=${token}` } : {}),
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {})
            });
            const result = await response.json();
            requests++;
            if (status !== null) assert.equal(response.status, status, `${method} ${path}: estado HTTP esperado`);
            const serialized = JSON.stringify(result);
            assert.equal(/"(?:password|password_hash|passwordHash|version_credenciales|versionCredenciales|codigo_hmac|nonce|payload_envio_cifrado|recuperacionesPassword)"\s*:/.test(serialized), false, 'No exponer credenciales ni recuperaciones');
            if (body?.password) assert.equal(serialized.includes(body.password), false, 'No devolver la contraseña');
            return { status: response.status, result };
        };
        const create = (nombreUsuario, correo, status = 201) => request(admin.token, 'POST', '/usuarios', status, {
            idRol: ROLES.VENDEDOR, nombreUsuario, password: 'Segura-123', ...(correo !== undefined ? { correo } : {})
        });
        const patch = (usuario, body, status = 200) => request(admin.token, 'PATCH', `/usuarios/${usuario.id}`, status, body);
        const snapshot = (usuario) => db.Usuario.findByPk(usuario.id, { raw: true });
        const recoverySnapshot = (recovery) => db.RecuperacionPassword.findByPk(recovery.id_recuperacion, { raw: true });
        const assertSameRecovery = async (recovery, before) => {
            const after = await recoverySnapshot(recovery);
            for (const field of Object.keys(before)) {
                const actual = after[field] instanceof Date ? after[field].getTime() : after[field];
                const expected = before[field] instanceof Date ? before[field].getTime() : before[field];
                assert.equal(actual === expected, true, `Conservar ${field} de la recuperación`);
            }
        };
        const assertSecurityUnchanged = async (usuario, before) => {
            const after = await snapshot(usuario);
            assert.equal(after.password_hash === before.password_hash, true);
            assert.equal(after.estado, before.estado);
            assert.equal(after.id_rol, before.id_rol);
            assert.equal(after.version_credenciales, before.version_credenciales);
            assert.equal(after.intentos_fallidos_login, before.intentos_fallidos_login);
            assert.equal(after.bloqueado_hasta?.getTime(), before.bloqueado_hasta?.getTime());
        };
        const assertInvalidated = async (recovery, before) => {
            const after = await recoverySnapshot(recovery);
            assert.equal(after.invalidada_en instanceof Date, true);
            for (const field of ['intentos_fallidos', 'codigo_hmac', 'nonce']) assert.equal(after[field] === before[field], true, `Conservar ${field}`);
            assert.equal(after.fecha_solicitud.getTime(), before.fecha_solicitud.getTime());
            assert.equal(after.expira_en.getTime(), before.expira_en.getTime());
        };

        await t.test('CU03 admite correo omitido/null y correo normalizado sin cambiar el contrato anterior', async () => {
            for (const [name, correo] of [['creado_sin_correo', undefined], ['creado_correo_null', null]]) {
                const { result } = await create(name, correo);
                assert.equal(result.data.correo, null);
                assert.equal(result.message, 'Usuario creado exitosamente');
            }
            const { result } = await create('creado_con_correo', '  Persona.Nombre+CADEFAR@Example.TEST  ');
            assert.equal(result.data.correo, 'persona.nombre+cadefar@example.test');
            const saved = await db.Usuario.findByPk(result.data.idUsuario);
            assert.equal(saved.correo, result.data.correo);
            assert.equal(saved.version_credenciales, 0);
            assert.equal(await bcrypt.compare('Segura-123', saved.password_hash), true);
            const detail = await request(admin.token, 'GET', `/usuarios/${saved.id_usuario}`, 200);
            assert.equal(detail.result.data.correo, saved.correo);
            const list = await request(admin.token, 'GET', '/usuarios', 200);
            assert.equal(list.result.data.some(usuario => usuario.idUsuario === saved.id_usuario && usuario.correo === saved.correo), true);
        });

        await t.test('Correo inválido produce 400; versión interna y atributos de verificación son rechazados', async () => {
            const usuario = await makeUsuario();
            const before = await snapshot(usuario);
            for (const correo of ['', '   ', 'sin-formato', 'persona @example.test', 123, true, 'a'.repeat(256)]) {
                await create('correo_invalido', correo, 400);
                await patch(usuario, { correo }, 400);
            }
            for (const field of ['version_credenciales', 'versionCredenciales', 'correo_verificado', 'correoVerificado']) {
                await patch(usuario, { correo: 'nuevo@example.test', [field]: 1 }, 400);
            }
            assert.equal((await snapshot(usuario)).correo, before.correo);
            await assertSecurityUnchanged(usuario, before);
        });

        await t.test('Unicidad incluye cuentas inactivas y distingue conflicto de nombre de conflicto de correo', async () => {
            const owner = await makeUsuario(ROLES.REGENTE, { correo: 'ocupado@example.test', estado: false });
            const target = await makeUsuario();
            const duplicate = await create('nombre_disponible', ' OCUPADO@EXAMPLE.TEST ', 409);
            assert.equal(duplicate.result.message, 'El correo ya está en uso');
            const repeatedName = await create(owner.nombre, 'disponible@example.test', 409);
            assert.equal(repeatedName.result.message, 'El nombre de usuario ya está en uso');
            const edited = await patch(target, { correo: 'ocupado@example.test' }, 409);
            assert.equal(edited.result.message, 'El correo ya está en uso');
            const same = await patch(owner, { correo: ' OCUPADO@EXAMPLE.TEST ' });
            assert.equal(same.result.data.correo, 'ocupado@example.test');
            await patch(target, { nombreUsuario: owner.nombre }, 409);
            await patch(target, { correo: 'nuevo@example.test', idRol: 2147483647 }, 404);
            await request(admin.token, 'PATCH', '/usuarios/2147483647', 404, { correo: 'nuevo@example.test' });
            assert.equal((await snapshot(target)).correo, null);
        });

        await t.test('Omitir correo o enviar el mismo normalizado conserva recuperaciones pendientes', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, { correo: 'original+prueba@example.test' });
            const recovery = await makeRecovery(usuario);
            const before = await recoverySnapshot(recovery);
            const first = await patch(usuario, { nombreUsuario: 'nombre_editado_sin_correo' });
            assert.equal(first.result.data.correo, 'original+prueba@example.test');
            await assertSameRecovery(recovery, before);
            await patch(usuario, { correo: '  ORIGINAL+PRUEBA@EXAMPLE.TEST  ' });
            await assertSameRecovery(recovery, before);
        });

        await t.test('Cambio efectivo invalida todos los pendientes sin reiniciar cuotas', async () => {
            const usuario = await makeUsuario(ROLES.REGENTE, {
                correo: 'anterior@example.test', estado: false, version_credenciales: 7,
                intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000)
            });
            const beforeUser = await snapshot(usuario);
            const pending = await makeRecovery(usuario);
            const expired = await makeRecovery(usuario, { expira_en: new Date(Date.now() - 1000) });
            const consumed = await makeRecovery(usuario, {
                consumida_en: new Date(Date.now() - 1000)
            });
            const invalid = await makeRecovery(usuario, {
                invalidada_en: new Date(Date.now() - 1000)
            });
            const before = await Promise.all([pending, expired, consumed, invalid].map(recoverySnapshot));
            const ipLimit = await db.LimiteRecuperacionIp.create({
                ambito: 'solicitud', clave_ip_hmac: 'b'.repeat(64), ventana_hasta: new Date(Date.now() + 900000), cantidad: 20
            });
            const other = await makeUsuario();
            const otherRecovery = await makeRecovery(other);
            const otherBefore = await recoverySnapshot(otherRecovery);
            const { result } = await patch(usuario, { correo: ' NUEVO.Nombre+Farmacia@EXAMPLE.TEST ' });
            assert.equal(result.data.correo, 'nuevo.nombre+farmacia@example.test');
            await assertInvalidated(pending, before[0]);
            await assertInvalidated(expired, before[1]);
            await assertSameRecovery(consumed, before[2]);
            await assertSameRecovery(invalid, before[3]);
            await assertSameRecovery(otherRecovery, otherBefore);
            await assertSecurityUnchanged(usuario, beforeUser);
            assert.equal(await db.RecuperacionPassword.count({ where: { id_usuario: usuario.id } }), 4);
            await ipLimit.reload();
            assert.equal(ipLimit.cantidad, 20);
        });

        await t.test('null retira correo, invalida pendientes y permite reasignarlo a otra cuenta', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, { correo: 'retirado@example.test' });
            const recovery = await makeRecovery(usuario);
            const before = await recoverySnapshot(recovery);
            const removed = await patch(usuario, { correo: null });
            assert.equal(removed.result.data.correo, null);
            await assertInvalidated(recovery, before);
            const invalidated = await recoverySnapshot(recovery);
            await patch(usuario, { correo: null });
            await assertSameRecovery(recovery, invalidated);
            const reused = await create('correo_reasignado', 'RETIRADO@EXAMPLE.TEST');
            assert.equal(reused.result.data.correo, 'retirado@example.test');
        });

        await t.test('Fallo tras actualizar e invalidar hace rollback de correo, nombre y recuperaciones', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, { correo: 'rollback@example.test' });
            const recovery = await makeRecovery(usuario);
            const beforeUser = await snapshot(usuario);
            const beforeRecovery = await recoverySnapshot(recovery);
            const original = recuperacionPasswordRepository.invalidatePendingByUsuario;
            recuperacionPasswordRepository.invalidatePendingByUsuario = async (options) => {
                await original.call(recuperacionPasswordRepository, options);
                throw new AppError('Fallo controlado de prueba', 500);
            };
            try {
                await patch(usuario, { correo: 'rollback_nuevo@example.test', nombreUsuario: 'rollback_nombre_nuevo' }, 500);
            } finally {
                recuperacionPasswordRepository.invalidatePendingByUsuario = original;
            }
            const after = await snapshot(usuario);
            assert.equal(after.correo, beforeUser.correo);
            assert.equal(after.nombre_usuario, beforeUser.nombre_usuario);
            await assertSecurityUnchanged(usuario, beforeUser);
            await assertSameRecovery(recovery, beforeRecovery);
        });

        await t.test('Solo Administrador asigna/retira/consulta correo; sesión pública conserva su contrato', async () => {
            const target = await makeUsuario();
            for (const idRol of [ROLES.REGENTE, ROLES.VENDEDOR]) {
                const usuario = await makeUsuario(idRol);
                await request(usuario.token, 'POST', '/usuarios', 403, {
                    idRol: 3, nombreUsuario: 'no_autorizado', password: 'Segura-123', correo: 'no_autorizado@example.test'
                });
                await request(usuario.token, 'PATCH', `/usuarios/${target.id}`, 403, { correo: 'no_autorizado@example.test' });
                await request(usuario.token, 'PATCH', `/usuarios/${usuario.id}`, 403, { correo: null });
                await request(usuario.token, 'GET', `/usuarios/${target.id}`, 403);
                await request(usuario.token, 'GET', '/usuarios', 403);
            }
            await request(null, 'PATCH', `/usuarios/${target.id}`, 401, { correo: 'sin_sesion@example.test' });
            await patch(target, { correo: 'sesion@example.test' });
            const me = await request(target.token, 'GET', '/auth/me', 200);
            assert.deepEqual(Object.keys(me.result.data).sort(), ['idRol', 'idUsuario', 'nombreUsuario']);
            await request(null, 'POST', '/auth/login', 200, { nombreUsuario: target.nombre, password: 'Segura-123' });
            const loginWithoutMail = await makeUsuario();
            await request(null, 'POST', '/auth/login', 200, { nombreUsuario: loginWithoutMail.nombre, password: 'Segura-123' });
        });

        // Sincronizar dos comprobaciones REALES que observan correo libre. La
        // escritura posterior demuestra que UNIQUE sigue siendo la barrera final.
        const withConcurrentChecks = async (correo, operation) => {
            const original = usuarioRepository.findByCorreo;
            let release, checks = 0;
            const gate = new Promise(resolve => { release = resolve; });
            usuarioRepository.findByCorreo = async (options) => {
                const result = await original.call(usuarioRepository, options);
                if (options.correo === correo) {
                    checks++;
                    if (checks === 2) release();
                    await gate;
                }
                return result;
            };
            try {
                await operation();
                assert.equal(checks, 2);
            } finally {
                release();
                usuarioRepository.findByCorreo = original;
            }
        };

        await t.test('Dos creaciones concurrentes del mismo correo: una 201 y otra 409 por UNIQUE real', async () => {
            const correo = 'carrera_creacion@example.test';
            await withConcurrentChecks(correo, async () => {
                const responses = await Promise.all([
                    create('carrera_creacion_a', correo, null), create('carrera_creacion_b', correo, null)
                ]);
                assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
                assert.equal(responses.find(response => response.status === 409).result.message, 'El correo ya está en uso');
                assert.equal(await db.Usuario.count({ where: { correo } }), 1);
            });
        });

        await t.test('Dos ediciones concurrentes usan conexiones independientes y el perdedor conserva sus pendientes', async () => {
            const first = await makeUsuario();
            const second = await makeUsuario();
            const recoveries = await Promise.all([makeRecovery(first), makeRecovery(second)]);
            const before = await Promise.all(recoveries.map(recoverySnapshot));
            const connections = new Set();
            const original = usuarioRepository.findByIdForUpdate;
            usuarioRepository.findByIdForUpdate = async (options) => {
                const result = await original.call(usuarioRepository, options);
                const [connection] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', {
                    type: db.Sequelize.QueryTypes.SELECT, transaction: options.transaction
                });
                connections.add(connection.id);
                return result;
            };
            try {
                await withConcurrentChecks('carrera_edicion@example.test', async () => {
                    const responses = await Promise.all([
                        patch(first, { correo: 'carrera_edicion@example.test' }, null),
                        patch(second, { correo: 'carrera_edicion@example.test' }, null)
                    ]);
                    assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
                    assert.equal(connections.size, 2, 'Las transacciones usan conexiones MySQL distintas');
                    assert.equal(responses.find(response => response.status === 409).result.message, 'El correo ya está en uso');
                    for (let index = 0; index < responses.length; index++) {
                        if (responses[index].status === 200) await assertInvalidated(recoveries[index], before[index]);
                        else await assertSameRecovery(recoveries[index], before[index]);
                    }
                    assert.equal(await db.Usuario.count({ where: { correo: 'carrera_edicion@example.test' } }), 1);
                });
            } finally {
                usuarioRepository.findByIdForUpdate = original;
            }
        });

        assert.equal(unexpectedErrors.length, 0, 'No deben producirse errores internos inesperados');
        t.diagnostic(`${requests} comprobaciones HTTP; rollback real y carreras con commits y conexiones independientes.`);
    } finally {
        try {
            if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        } finally {
            console.error = originalConsoleError;
            try {
                if (db) await db.sequelize.close();
            } finally {
                if (databaseCreated) await runCli('db:drop');
            }
        }
    }
});
