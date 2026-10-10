import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Seleccionar y comprobar el entorno ANTES de importar Sequelize y la app.
dotenv.config({ quiet: true });
const testDatabase = process.env.DB_NAME_TEST;
assert.equal(Boolean(testDatabase), true, 'Configurar DB_NAME_TEST para ejecutar integración');
assert.equal([process.env.DB_NAME, process.env.DB_NAME_PRODUCTION].filter(Boolean).some(
    name => name.toLowerCase() === testDatabase.toLowerCase()
), false, 'La base de pruebas debe ser distinta de desarrollo y producción');
process.env.NODE_ENV = 'test';

const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { ROLES } = await import('../src/shared/constants/roles.js');

const password72 = `Aa1!${'x'.repeat(68)}`;
const password73 = `${password72}x`;
const historicalPassword = `${password72}histórica`;
const byteMessage = 'La contraseña no puede superar los 72 bytes en UTF-8';

// Mismo aislamiento transaccional que la suite de catálogo: rollback exterior
// y savepoints para login. Estas pruebas son funcionales, no de concurrencia.
test('Contraseñas: CU03, CU08 y regresión de autenticación con MySQL aislado', { timeout: 120000 }, async (t) => {
    const prefix = `PW${randomBytes(5).toString('hex')}`;
    const originalQuery = db.sequelize.query.bind(db.sequelize);
    const originalTransaction = db.sequelize.transaction.bind(db.sequelize);
    const originalConsoleError = console.error;
    const originalLogging = db.sequelize.options.logging;
    const createdIds = [];
    let transaction, server, requests = 0, fixtureNumber = 0;

    try {
        db.sequelize.options.logging = false;
        assert.equal(db.sequelize.config.database === testDatabase, true, 'Sequelize debe usar DB_NAME_TEST');
        transaction = await originalTransaction();
        db.sequelize.query = (sql, options = {}) => originalQuery(sql, {
            ...options, transaction: options.transaction ?? transaction
        });
        db.sequelize.transaction = (options, callback) => originalTransaction(
            { transaction }, typeof options === 'function' ? options : callback
        );
        // Los errores esperados se comprueban mediante HTTP; no imprimir datos
        // de validación ni SQL/valores de credenciales durante las pruebas.
        const loggedErrors = [];
        console.error = (error) => {
            if (error?.name !== 'AppError') loggedErrors.push(error?.name || 'Error');
        };

        const makeUsuario = async (idRol = ROLES.VENDEDOR, password = historicalPassword, extra = {}) => {
            const usuario = await db.Usuario.create({
                id_rol: idRol,
                nombre_usuario: `${prefix}_${++fixtureNumber}`,
                password_hash: await bcrypt.hash(password, 10),
                ...extra
            });
            createdIds.push(usuario.id_usuario);
            return {
                id: usuario.id_usuario,
                nombre: usuario.nombre_usuario,
                token: generarToken({ idUsuario: usuario.id_usuario, idRol, versionCredenciales: usuario.version_credenciales })
            };
        };
        const admin = await makeUsuario(ROLES.ADMINISTRADOR);
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        const base = `http://127.0.0.1:${server.address().port}/api`;
        const request = async (token, method, path, status, body) => {
            const response = await fetch(`${base}${path}`, {
                method,
                headers: {
                    ...(token ? { Cookie: `token=${token}` } : {}),
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {})
            });
            const result = await response.json();
            requests++;
            assert.equal(response.status, status, `${method} ${path}: estado HTTP esperado`);
            const serialized = JSON.stringify(result);
            assert.equal(/"(?:password|passwordActual|passwordNueva|password_hash|passwordHash|token)"\s*:/.test(serialized), false, 'La respuesta no debe exponer credenciales');
            for (const password of [body?.password, body?.passwordActual, body?.passwordNueva]) {
                if (password) assert.equal(serialized.includes(password), false, 'No devolver el valor de la contraseña');
            }
            return { result, cookie: response.headers.get('set-cookie') };
        };
        const snapshot = async (usuario) => db.Usuario.findByPk(usuario.id, { raw: true });
        const assertUnchanged = async (usuario, before) => {
            const after = await snapshot(usuario);
            assert.equal(after.password_hash === before.password_hash, true, 'Conservar el hash si se rechaza la operación');
            assert.equal(after.version_credenciales, before.version_credenciales);
            assert.equal(after.intentos_fallidos_login, before.intentos_fallidos_login);
            assert.equal(after.bloqueado_hasta?.getTime(), before.bloqueado_hasta?.getTime());
            assert.equal(after.id_rol, before.id_rol);
            assert.equal(after.estado, before.estado);
        };
        const assertChanged = async (usuario, before, password) => {
            const after = await snapshot(usuario);
            assert.equal(after.password_hash !== before.password_hash, true, 'Guardar un hash nuevo');
            assert.equal(after.version_credenciales, before.version_credenciales + 1);
            assert.equal(await bcrypt.compare(password, after.password_hash), true);
            assert.equal(after.intentos_fallidos_login, 0);
            assert.equal(after.bloqueado_hasta, null);
            assert.equal(after.id_rol, before.id_rol);
            assert.equal(after.estado, before.estado);
        };
        const assertByteError = (result, field) => {
            assert.equal(result.message, 'Datos inválidos');
            assert.equal(result.errors.some(issue => issue.message === byteMessage && issue.path[0] === field), true);
        };
        const login = (usuario, password, status = 200) => request(null, 'POST', '/auth/login', status, {
            nombreUsuario: usuario.nombre, password
        });

        await t.test('Login histórico >72 bytes conserva hash, sesión y cookie y reinicia intentos', async () => {
            const usuario = await makeUsuario(ROLES.REGENTE, historicalPassword, { intentos_fallidos_login: 2 });
            const before = await snapshot(usuario);
            const { result, cookie } = await login(usuario, historicalPassword);
            assert.equal(result.message, 'Inicio de sesión exitoso');
            assert.deepEqual(Object.keys(result.data).sort(), ['idRol', 'idUsuario', 'nombreUsuario']);
            assert.equal(result.data.idRol, ROLES.REGENTE);
            assert.equal(cookie.includes('HttpOnly'), true);
            assert.equal(cookie.includes('SameSite=Lax'), true);
            assert.equal(cookie.includes('Max-Age=28800'), true);
            const after = await snapshot(usuario);
            assert.equal(after.password_hash === before.password_hash, true);
            assert.equal(after.intentos_fallidos_login, 0);
            const token = cookie.split(';')[0].slice('token='.length);
            const me = await request(token, 'GET', '/auth/me', 200);
            assert.deepEqual(me.result.data, result.data);
        });

        await t.test('CU03 acepta 72 bytes, almacena bcrypt y conserva la respuesta pública', async () => {
            const nombre = `${prefix}_creado`;
            const { result } = await request(admin.token, 'POST', '/usuarios', 201, {
                idRol: ROLES.VENDEDOR, nombreUsuario: nombre, password: password72
            });
            createdIds.push(result.data.idUsuario);
            assert.equal(result.message, 'Usuario creado exitosamente');
            assert.deepEqual(Object.keys(result.data).sort(), ['correo', 'estado', 'idUsuario', 'nombreUsuario', 'rol']);
            assert.equal(result.data.correo, null);
            assert.equal(result.data.estado, true);
            assert.equal(result.data.rol.idRol, ROLES.VENDEDOR);
            const usuario = { id: result.data.idUsuario, nombre };
            const stored = await snapshot(usuario);
            assert.equal(stored.password_hash.startsWith('$2b$10$'), true);
            assert.equal(await bcrypt.compare(password72, stored.password_hash), true);
            await login(usuario, password72);
        });

        await t.test('CU03 rechaza 73 bytes y Unicode sin crear ninguna cuenta', async () => {
            const beforeCount = await db.Usuario.count();
            for (const password of [password73, `Aa1!${'é'.repeat(35)}`]) {
                const { result } = await request(admin.token, 'POST', '/usuarios', 400, {
                    idRol: ROLES.VENDEDOR, nombreUsuario: `${prefix}_rechazado`, password
                });
                assertByteError(result, 'password');
            }
            assert.equal(await db.Usuario.count(), beforeCount);
        });

        await t.test('CU08 propio verifica passwordActual histórica y limpia bloqueo al cambiar', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, historicalPassword, {
                intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000)
            });
            const before = await snapshot(usuario);
            const { result, cookie } = await request(usuario.token, 'PATCH', '/usuarios/me/password', 200, {
                passwordActual: historicalPassword, passwordNueva: password72
            });
            assert.equal(result.message, 'Contraseña modificada exitosamente');
            assert.equal(Boolean(cookie?.includes('HttpOnly')), true, 'CU08 propio renueva la cookie');
            await assertChanged(usuario, before, password72);
            await login(usuario, password72);
        });

        await t.test('CU08 propio rechaza exceso de bytes antes de modificar hash o bloqueo', async () => {
            const usuario = await makeUsuario(ROLES.REGENTE, historicalPassword, {
                intentos_fallidos_login: 2, bloqueado_hasta: new Date(Date.now() + 600000)
            });
            const before = await snapshot(usuario);
            for (const passwordNueva of [password73, `Aa1!${'🔐'.repeat(18)}`]) {
                const { result } = await request(usuario.token, 'PATCH', '/usuarios/me/password', 400, {
                    passwordActual: historicalPassword, passwordNueva
                });
                assertByteError(result, 'passwordNueva');
                await assertUnchanged(usuario, before);
            }
        });

        await t.test('CU08 propio rechaza contraseña actual incorrecta y admite una histórica sin complejidad', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, 'antigua');
            const before = await snapshot(usuario);
            await request(usuario.token, 'PATCH', '/usuarios/me/password', 401, {
                passwordActual: 'Error-Actual-456', passwordNueva: 'Segura-123'
            });
            await assertUnchanged(usuario, before);
            await request(usuario.token, 'PATCH', '/usuarios/me/password', 200, {
                passwordActual: 'antigua', passwordNueva: 'Segura-123'
            });
            await assertChanged(usuario, before, 'Segura-123');
            await login(usuario, 'antigua', 401);
            await login(usuario, 'Segura-123');
        });

        await t.test('CU08 administrativo acepta 72 bytes, limpia bloqueo y no activa cuenta inactiva', async () => {
            const usuario = await makeUsuario(ROLES.REGENTE, historicalPassword, {
                estado: false, intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000)
            });
            const before = await snapshot(usuario);
            const { result } = await request(admin.token, 'PATCH', `/usuarios/${usuario.id}/password`, 200, { password: password72 });
            assert.equal(result.message, 'Contraseña modificada exitosamente');
            await assertChanged(usuario, before, password72);
            await login(usuario, password72, 403);
            await request(usuario.token, 'GET', '/auth/me', 401);
        });

        await t.test('CU08 administrativo rechaza exceso de bytes sin alterar credenciales ni seguridad', async () => {
            const usuario = await makeUsuario(ROLES.VENDEDOR, historicalPassword, {
                intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000)
            });
            const before = await snapshot(usuario);
            for (const password of [password73, `Aa1!${'é'.repeat(35)}`]) {
                const { result } = await request(admin.token, 'PATCH', `/usuarios/${usuario.id}/password`, 400, { password });
                assertByteError(result, 'password');
                await assertUnchanged(usuario, before);
            }
        });

        await t.test('Roles: solo Administrador crea/restablece; los tres roles pueden cambiar su contraseña', async () => {
            for (const idRol of Object.values(ROLES)) {
                const usuario = await makeUsuario(idRol);
                if (idRol !== ROLES.ADMINISTRADOR) {
                    await request(usuario.token, 'POST', '/usuarios', 403, {
                        idRol: ROLES.VENDEDOR, nombreUsuario: `${prefix}_prohibido`, password: 'Segura-123'
                    });
                    await request(usuario.token, 'PATCH', `/usuarios/${admin.id}/password`, 403, { password: 'Segura-123' });
                }
                await request(usuario.token, 'PATCH', '/usuarios/me/password', 200, {
                    passwordActual: historicalPassword, passwordNueva: 'Segura-123'
                });
            }
            await request(null, 'POST', '/usuarios', 401, { idRol: 3, nombreUsuario: `${prefix}_sinSesion`, password: 'Segura-123' });
            await request(null, 'PATCH', '/usuarios/me/password', 401, { passwordActual: historicalPassword, passwordNueva: 'Segura-123' });
            await request(null, 'PATCH', `/usuarios/${admin.id}/password`, 401, { password: 'Segura-123' });
        });

        await t.test('Bloqueo: tercer fallo bloquea diez minutos, no se extiende y expira sin cambiar estado', async () => {
            const usuario = await makeUsuario();
            await login(usuario, 'incorrecta', 401);
            await login(usuario, 'incorrecta', 401);
            const start = Date.now();
            await login(usuario, 'incorrecta', 423);
            const blocked = await snapshot(usuario);
            assert.equal(blocked.intentos_fallidos_login, 3);
            assert.equal(Boolean(blocked.estado), true);
            assert.equal(blocked.bloqueado_hasta.getTime() >= start + 600000 - 1000, true);
            assert.equal(blocked.bloqueado_hasta.getTime() <= Date.now() + 600000, true);
            await login(usuario, historicalPassword, 423);
            await assertUnchanged(usuario, blocked);
            await request(usuario.token, 'GET', '/auth/me', 200);
            await db.Usuario.update({ bloqueado_hasta: new Date(Date.now() - 1000) }, { where: { id_usuario: usuario.id } });
            await login(usuario, 'incorrecta', 401);
            const restarted = await snapshot(usuario);
            assert.equal(restarted.intentos_fallidos_login, 1);
            assert.equal(restarted.bloqueado_hasta, null);
            await login(usuario, historicalPassword);
            assert.equal((await snapshot(usuario)).intentos_fallidos_login, 0);
        });

        await t.test('Logout elimina cookie y conserva respuesta; JWT inválido sigue rechazado', async () => {
            const { result, cookie } = await request(admin.token, 'POST', '/auth/logout', 200);
            assert.equal(result.message, 'Sesión cerrada correctamente');
            assert.equal(cookie.startsWith('token=;'), true);
            assert.equal(cookie.includes('Expires=Thu, 01 Jan 1970'), true);
            assert.equal(cookie.includes('HttpOnly'), true);
            assert.equal(cookie.includes('SameSite=Lax'), true);
            await request(null, 'POST', '/auth/logout', 401);
            await request('invalid', 'GET', '/auth/me', 401);
        });

        await t.test('Regresión HTTP: complejidad, mínimo, máximo y campos extra conservan errores 400', async () => {
            const usuario = await makeUsuario();
            const before = await snapshot(usuario);
            for (const password of ['segura123', 'Aa1!xxx', `Aa1!${'x'.repeat(97)}`]) {
                await request(admin.token, 'POST', '/usuarios', 400, { idRol: 3, nombreUsuario: `${prefix}_invalido`, password });
                await request(admin.token, 'PATCH', `/usuarios/${usuario.id}/password`, 400, { password });
                await request(usuario.token, 'PATCH', '/usuarios/me/password', 400, {
                    passwordActual: historicalPassword, passwordNueva: password
                });
            }
            await request(admin.token, 'PATCH', `/usuarios/${usuario.id}/password`, 400, { password: 'Segura-123', idRol: 1 });
            await assertUnchanged(usuario, before);
        });

        assert.equal(loggedErrors.length, 0, 'No deben producirse errores internos durante la integración');
        t.diagnostic(`${requests} comprobaciones HTTP con MySQL, JWT, bcrypt y autenticación reales; fixtures revertidos.`);
    } finally {
        try {
            if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        } finally {
            db.sequelize.query = originalQuery;
            db.sequelize.transaction = originalTransaction;
            console.error = originalConsoleError;
            try {
                if (transaction && !transaction.finished) await transaction.rollback();
                if (createdIds.length) {
                    assert.equal(await db.Usuario.count({ where: { id_usuario: createdIds }, logging: false }), 0, 'Todos los usuarios de prueba deben revertirse');
                }
            } finally {
                db.sequelize.options.logging = originalLogging;
                await db.sequelize.close();
            }
        }
    }
});
