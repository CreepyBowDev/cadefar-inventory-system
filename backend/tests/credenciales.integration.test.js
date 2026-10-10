import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
const protectedDatabases = [process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean);
assert.equal(Boolean(testDatabase), true, 'Configurar DB_NAME_TEST');
assert.equal(protectedDatabases.some(name => name.toLowerCase() === testDatabase.toLowerCase()), false, 'Usar una base aislada');
assert.equal(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), true, 'Usar MySQL local');
const temporaryDatabase = `${testDatabase.slice(0, 40)}_jwt_${randomBytes(6).toString('hex')}`;
assert.equal([testDatabase, ...protectedDatabases].some(name => name.toLowerCase() === temporaryDatabase.toLowerCase()), false);
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = temporaryDatabase;
const executeFile = promisify(execFile);
const cliPath = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async (...args) => {
    try {
        await executeFile(process.execPath, [cliPath, ...args, '--env', 'test'], {
            cwd: fileURLToPath(new URL('../', import.meta.url)), env: { ...process.env }, timeout: 60000
        });
    } catch { throw new Error(`Sequelize CLI: ${args[0]} falló en la base temporal`); }
};

test('Credenciales: JWT obligatorio, CU08 atómico y carreras con conexiones independientes', { timeout: 180000 }, async (t) => {
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
        const { generarToken, verificarToken } = await import('../src/shared/utils/jwt.js');
        const { usuarioRepository } = await import('../src/data/repositories/usuario.repository.js');
        const { recuperacionPasswordRepository } = await import('../src/data/repositories/recuperacion-password.repository.js');
        const { AppError } = await import('../src/shared/errors/app-error.js');
        const { ROLES } = await import('../src/shared/constants/roles.js');
        const technicalLogs = [];
        console.error = value => { if (value?.name !== 'AppError') technicalLogs.push(value); };
        const initialPassword = 'Inicial-123!';
        const newPassword = 'Nueva-456!';
        let fixture = 0, requests = 0;
        const makeUsuario = async (idRol = ROLES.VENDEDOR, extra = {}, password = initialPassword) => {
            const row = await db.Usuario.create({ id_rol: idRol, nombre_usuario: `jwt_fixture_${++fixture}`, password_hash: await bcrypt.hash(password, 10), ...extra });
            return { id: row.id_usuario, nombre: row.nombre_usuario, token: generarToken({ idUsuario: row.id_usuario, idRol, versionCredenciales: row.version_credenciales }) };
        };
        const admin = await makeUsuario(ROLES.ADMINISTRADOR);
        const makeRecovery = (usuario) => db.RecuperacionPassword.create({
            id_usuario: usuario.id, codigo_hmac: 'a'.repeat(64), nonce: randomUUID(),
            fecha_solicitud: new Date(Date.now() - 1000), expira_en: new Date(Date.now() + 600000),
            intentos_fallidos: 2
        });
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (token, method, path, expectedStatus, body) => {
            const response = await fetch(`${base}${path}`, {
                method, signal: AbortSignal.timeout(20000),
                headers: { ...(token ? { Cookie: `token=${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {})
            });
            const result = await response.json();
            requests++;
            if (expectedStatus !== null) assert.equal(response.status, expectedStatus, `${method} ${path}: estado esperado`);
            const serialized = JSON.stringify(result);
            assert.equal(/"(?:token|password|password_hash|passwordHash|versionCredenciales|version_credenciales|codigo_hmac|nonce|payload_envio_cifrado)"\s*:/.test(serialized), false, 'No exponer datos privados en JSON');
            for (const value of [body?.password, body?.passwordActual, body?.passwordNueva]) {
                if (value) assert.equal(serialized.includes(value), false, 'No exponer contraseñas');
            }
            const cookie = response.headers.get('set-cookie');
            return { result, status: response.status, cookie, token: cookie?.startsWith('token=') ? cookie.split(';')[0].slice(6) : null };
        };
        const own = (usuario, passwordNueva = newPassword, status = 200, passwordActual = initialPassword) => request(usuario.token, 'PATCH', '/usuarios/me/password', status, { passwordActual, passwordNueva });
        const reset = (usuario, password = newPassword, status = 200, actor = admin) => request(actor.token, 'PATCH', `/usuarios/${usuario.id}/password`, status, { password });
        const me = (token, status = 200) => request(token, 'GET', '/auth/me', status);
        const snapshot = usuario => db.Usuario.findByPk(usuario.id, { raw: true });
        const assertPreserved = async (usuario, before, recovery, beforeRecovery) => {
            const after = await snapshot(usuario);
            for (const field of Object.keys(before)) {
                const actual = after[field] instanceof Date ? after[field].getTime() : after[field];
                const expected = before[field] instanceof Date ? before[field].getTime() : before[field];
                assert.equal(actual === expected, true, `Conservar ${field}`);
            }
            if (recovery) {
                await recovery.reload();
                for (const field of Object.keys(beforeRecovery)) {
                    const actual = recovery[field] instanceof Date ? recovery[field].getTime() : recovery[field];
                    const expected = beforeRecovery[field] instanceof Date ? beforeRecovery[field].getTime() : beforeRecovery[field];
                    assert.equal(actual === expected, true, `Conservar recuperación: ${field}`);
                }
            }
        };
        const assertRecoveryInvalidated = async recovery => {
            await recovery.reload();
            assert.equal(recovery.invalidada_en instanceof Date, true);
            assert.equal(recovery.intentos_fallidos, 2);
        };

        await t.test('Login emite la versión vigente y me no la expone', async () => {
            const usuario = await makeUsuario(ROLES.REGENTE, { version_credenciales: 12 });
            const login = await request(null, 'POST', '/auth/login', 200, { nombreUsuario: usuario.nombre, password: initialPassword });
            assert.equal(verificarToken(login.token).versionCredenciales, 12);
            assert.deepEqual(Object.keys(login.result.data).sort(), ['idRol', 'idUsuario', 'nombreUsuario']);
            assert.equal(login.cookie.includes('HttpOnly'), true);
            assert.equal(login.cookie.includes('SameSite=Lax'), true);
            assert.equal(login.cookie.includes('Max-Age=28800'), true);
            await me(login.token);
        });

        await t.test('JWT antiguos, versiones inválidas/distintas y firma/expiración incorrectas responden 401', async () => {
            const usuario = await makeUsuario();
            const payload = { idUsuario: usuario.id, idRol: 3 };
            for (const versionCredenciales of [undefined, null, '0', -1, 1.5, 4294967296, 1]) {
                const token = jwt.sign({ ...payload, versionCredenciales }, process.env.JWT_SECRET, { expiresIn: '8h' });
                await me(token, 401);
            }
            await me(jwt.sign({ ...payload, versionCredenciales: 0 }, process.env.JWT_SECRET, { expiresIn: -1 }), 401);
            await me(jwt.sign({ ...payload, versionCredenciales: 0 }, 'otra_clave_sintetica'), 401);
            await me(usuario.token);
        });

        await t.test('CU08 propio renueva solo la cookie actual e invalida todos los tokens anteriores y recuperaciones', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, { intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000) });
            const recovery = await makeRecovery(usuario);
            const before = await snapshot(usuario);
            const otherToken = generarToken({ idUsuario: usuario.id, idRol: 3, versionCredenciales: 0 });
            const changed = await own(usuario);
            assert.deepEqual(changed.result, { message: 'Contraseña modificada exitosamente' });
            assert.equal(changed.cookie.includes('HttpOnly'), true);
            assert.equal(changed.cookie.includes('SameSite=Lax'), true);
            assert.equal(changed.cookie.includes('Max-Age=28800'), true);
            assert.equal(verificarToken(changed.token).versionCredenciales, 1);
            await me(changed.token);
            await me(usuario.token, 401);
            await me(otherToken, 401);
            const after = await snapshot(usuario);
            assert.equal(after.version_credenciales, 1);
            assert.equal(await bcrypt.compare(newPassword, after.password_hash), true);
            assert.equal(after.intentos_fallidos_login, 0);
            assert.equal(after.bloqueado_hasta, null);
            assert.equal(after.id_rol, before.id_rol);
            assert.equal(after.estado, before.estado);
            await assertRecoveryInvalidated(recovery);
        });

        await t.test('CU08 administrativo revoca sesiones, limpia bloqueo y conserva la cuenta inactiva', async () => {
            const usuario = await makeUsuario(ROLES.REGENTE, { estado: false, intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000) });
            const recovery = await makeRecovery(usuario);
            const changed = await reset(usuario);
            assert.equal(changed.cookie, null);
            const after = await snapshot(usuario);
            assert.equal(after.version_credenciales, 1);
            assert.equal(Boolean(after.estado), false);
            assert.equal(after.id_rol, ROLES.REGENTE);
            assert.equal(after.intentos_fallidos_login, 0);
            assert.equal(after.bloqueado_hasta, null);
            assert.equal(await bcrypt.compare(newPassword, after.password_hash), true);
            await assertRecoveryInvalidated(recovery);
            await me(usuario.token, 401);
            await request(null, 'POST', '/auth/login', 403, { nombreUsuario: usuario.nombre, password: newPassword });
            const active = await makeUsuario();
            await reset(active);
            await me(active.token, 401);
            const login = await request(null, 'POST', '/auth/login', 200, { nombreUsuario: active.nombre, password: newPassword });
            assert.equal(verificarToken(login.token).versionCredenciales, 1);
            await me(login.token);
        });

        await t.test('Contraseña actual incorrecta y política de 72 bytes no alteran versión ni recuperaciones', async () => {
            const usuario = await makeUsuario();
            const recovery = await makeRecovery(usuario);
            const before = await snapshot(usuario), beforeRecovery = recovery.get({ plain: true });
            const wrong = await own(usuario, newPassword, 401, 'Actual-Incorrecta-123!');
            assert.equal(wrong.cookie, null);
            const invalid = await own(usuario, `Aa1!${'x'.repeat(69)}`, 400);
            assert.equal(invalid.cookie, null);
            await reset(usuario, `Aa1!${'x'.repeat(69)}`, 400);
            await assertPreserved(usuario, before, recovery, beforeRecovery);
            await me(usuario.token);
        });

        await t.test('Ambos tipos de CU08 hacen rollback si falla la invalidación después de guardar contraseña', async () => {
            for (const mode of ['propio', 'administrativo']) {
                const usuario = await makeUsuario();
                const recovery = await makeRecovery(usuario);
                const before = await snapshot(usuario), beforeRecovery = recovery.get({ plain: true });
                const original = recuperacionPasswordRepository.invalidatePendingByUsuario;
                recuperacionPasswordRepository.invalidatePendingByUsuario = async options => {
                    await original.call(recuperacionPasswordRepository, options);
                    throw new AppError('Fallo controlado de prueba', 500);
                };
                let response;
                try { response = mode === 'propio' ? await own(usuario, newPassword, 500) : await reset(usuario, newPassword, 500); }
                finally { recuperacionPasswordRepository.invalidatePendingByUsuario = original; }
                assert.equal(response.cookie, null);
                await assertPreserved(usuario, before, recovery, beforeRecovery);
                await me(usuario.token);
            }
        });

        await t.test('Fallo de firma antes del commit revierte todo y no coloca cookie ni registra datos privados', async () => {
            const usuario = await makeUsuario();
            const recovery = await makeRecovery(usuario);
            const before = await snapshot(usuario), beforeRecovery = recovery.get({ plain: true });
            const original = recuperacionPasswordRepository.invalidatePendingByUsuario;
            const secret = process.env.JWT_SECRET;
            recuperacionPasswordRepository.invalidatePendingByUsuario = async options => {
                await original.call(recuperacionPasswordRepository, options);
                delete process.env.JWT_SECRET;
            };
            try { assert.equal((await own(usuario, newPassword, 500)).cookie, null); }
            finally { process.env.JWT_SECRET = secret; recuperacionPasswordRepository.invalidatePendingByUsuario = original; }
            await assertPreserved(usuario, before, recovery, beforeRecovery);
            await me(usuario.token);
            assert.equal(technicalLogs.length, 1);
            const logged = JSON.stringify(technicalLogs);
            for (const value of [before.password_hash, initialPassword, newPassword, secret, recovery.codigo_hmac]) assert.equal(logged.includes(value), false);
            assert.equal(technicalLogs[0].message, 'Error interno del servidor');
        });

        const withOwnPausedBeforeLock = async (usuario, operation) => {
            const original = usuarioRepository.findByIdWithPassword;
            let reached, release;
            const waiting = new Promise(resolve => { reached = resolve; });
            const gate = new Promise(resolve => { release = resolve; });
            usuarioRepository.findByIdWithPassword = async options => {
                if (options.idUsuario === usuario.id && options.lock) { reached(); await gate; }
                return original.call(usuarioRepository, options);
            };
            const pending = own(usuario, 'Propia-Concurrente-123!', 401);
            try { await waiting; await operation(); release(); assert.equal((await pending).cookie, null); }
            finally { release(); usuarioRepository.findByIdWithPassword = original; await pending.catch(() => {}); }
        };

        await t.test('Restablecimiento administrativo entre comprobación y bloqueo impide que CU08 propio lo sobrescriba', async () => {
            const usuario = await makeUsuario();
            await withOwnPausedBeforeLock(usuario, () => reset(usuario, 'Administrativa-789!'));
            const after = await snapshot(usuario);
            assert.equal(after.version_credenciales, 1);
            assert.equal(await bcrypt.compare('Administrativa-789!', after.password_hash), true);
            await me(usuario.token, 401);
        });

        await t.test('CU08 propio revalida también el estado y el hash comprobado, no solo la versión', async () => {
            for (const field of ['estado', 'password_hash']) {
                const usuario = await makeUsuario();
                const recovery = await makeRecovery(usuario);
                const beforeRecovery = recovery.get({ plain: true });
                const value = field === 'estado' ? false : await bcrypt.hash('Otro-Hash-789!', 10);
                await withOwnPausedBeforeLock(usuario, () => db.Usuario.update({ [field]: value }, { where: { id_usuario: usuario.id }, logging: false }));
                const after = await snapshot(usuario);
                assert.equal(after.version_credenciales, 0);
                assert.equal((field === 'estado' ? Boolean(after[field]) : after[field]) === value, true);
                await recovery.reload();
                assert.equal(recovery.invalidada_en, null);
                assert.equal(recovery.codigo_hmac === beforeRecovery.codigo_hmac, true);
            }
        });

        await t.test('Dos cambios propios con la misma versión: uno 200 y otro 401, usando conexiones independientes', async () => {
            const usuario = await makeUsuario();
            const original = usuarioRepository.findByIdWithPassword;
            let release, releaseLocks, checked = 0, locks = 0;
            const gate = new Promise(resolve => { release = resolve; });
            const lockGate = new Promise(resolve => { releaseLocks = resolve; });
            const connections = new Set();
            usuarioRepository.findByIdWithPassword = async options => {
                if (options.idUsuario === usuario.id && options.lock) {
                    const [connection] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { type: db.Sequelize.QueryTypes.SELECT, transaction: options.transaction });
                    connections.add(connection.id);
                    locks++; if (locks === 2) releaseLocks(); await lockGate;
                }
                const row = await original.call(usuarioRepository, options);
                if (options.idUsuario === usuario.id) {
                    if (!options.lock) { checked++; if (checked === 2) release(); await gate; }
                }
                return row;
            };
            try {
                const responses = await Promise.all([own(usuario, 'Concurrente-A-123!', null), own(usuario, 'Concurrente-B-123!', null)]);
                assert.deepEqual(responses.map(response => response.status).sort(), [200, 401]);
                assert.equal(connections.size, 2);
                assert.equal((await snapshot(usuario)).version_credenciales, 1);
                const success = responses.find(response => response.status === 200);
                await me(success.token);
                assert.equal(responses.find(response => response.status === 401).cookie, null);
                await me(usuario.token, 401);
            } finally { release(); releaseLocks(); usuarioRepository.findByIdWithPassword = original; }
        });

        await t.test('Dos restablecimientos administrativos serializados incrementan dos veces sin perder actualizaciones', async () => {
            const usuario = await makeUsuario();
            const original = usuarioRepository.findByIdForUpdate;
            let release, calls = 0;
            const gate = new Promise(resolve => { release = resolve; });
            const connections = new Set();
            usuarioRepository.findByIdForUpdate = async options => {
                if (options.idUsuario === usuario.id) {
                    const [connection] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { type: db.Sequelize.QueryTypes.SELECT, transaction: options.transaction });
                    connections.add(connection.id);
                    calls++; if (calls === 2) release(); await gate;
                }
                return original.call(usuarioRepository, options);
            };
            try {
                await Promise.all([reset(usuario, 'Administrativa-A-123!'), reset(usuario, 'Administrativa-B-123!')]);
                assert.equal(connections.size, 2);
                assert.equal((await snapshot(usuario)).version_credenciales, 2);
                await me(usuario.token, 401);
            } finally { release(); usuarioRepository.findByIdForUpdate = original; }
        });

        await t.test('Restablecimiento administrativo propio exige nuevo login; roles se leen desde MySQL', async () => {
            const anotherAdmin = await makeUsuario(ROLES.ADMINISTRADOR);
            const response = await reset(anotherAdmin, newPassword, 200, anotherAdmin);
            assert.equal(response.cookie, null);
            await me(anotherAdmin.token, 401);
            const usuario = await makeUsuario(ROLES.ADMINISTRADOR);
            await request(admin.token, 'PATCH', `/usuarios/${usuario.id}`, 200, { idRol: ROLES.VENDEDOR });
            const session = await me(usuario.token);
            assert.equal(session.result.data.idRol, ROLES.VENDEDOR);
            await request(usuario.token, 'POST', '/usuarios', 403, { idRol: 3, nombreUsuario: 'no_autorizado', password: newPassword });
            await request(admin.token, 'POST', '/auth/logout', 200);
        });

        assert.equal(technicalLogs.length, 1, 'Solo se registra el fallo de firma intencional, sanitizado');
        t.diagnostic(`${requests} comprobaciones HTTP; transacciones reales, revocación y carreras en MySQL aislado.`);
    } finally {
        try { if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
        finally {
            console.error = originalConsoleError;
            try { if (db) await db.sequelize.close(); }
            finally { if (databaseCreated) await runCli('db:drop'); }
        }
    }
});
