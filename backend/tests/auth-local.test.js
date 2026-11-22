import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

Object.assign(process.env, { NODE_ENV: 'development', PAGOS_MODO: 'PRUEBA_LOCAL',
    DB_NAME: 'cadefarexamen', DB_NAME_PAGOS_PRUEBAS: 'cadefar_pagos_pruebas', PAGOS_SESION_EXISTENTE: 'true',
    DB_HOST: '127.0.0.1', PORT: '3000', FRONTEND_URL: 'http://localhost:5173', PAGOS_MONEDA_COMPRAS: 'BOB',
    PAGOS_REALES_HABILITADOS: 'false', PAGOS_PROVEEDORES_JSON: '{}', PAGOS_PAYPAL_PAYER_ID: '', RECOVERY_ENABLED: 'false',
    JWT_SECRET: 'clave_sintetica_unitaria_no_operativa' });
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken, verificarToken } = await import('../src/shared/utils/jwt.js');
const { default: migracion } = await import('../src/data/database/migrations-pagos-pruebas/20261122090000-create-seguridad-login-local.cjs');

test('Login local reutiliza bcrypt/HTTP/JWT/auditoría sin escribir identidades originales (SQL simulado)', async t => {
    // Fixture exclusivamente en memoria: no se crea ninguna cuenta ni contraseña en MySQL.
    const password = 'Fixture_123!solo_memoria';
    const hash = await bcrypt.hash(password, 4);
    const inicial = { id_usuario: 7777, id_rol: 1, nombre_usuario: 'admin_demo', password_hash: hash,
        estado: true, version_credenciales: 1, intentos_fallidos_login: 0, bloqueado_hasta: null };
    let original, estado, falloAuditoria, falloLectura, falloCommit;
    let lecturas, comparaciones, conexionesAbiertas, conexionesCerradas;
    const pendientes = new Map(), escrituras = [];
    const reset = () => {
        original = structuredClone(inicial); estado = { seguridad: null, eventos: [] };
        pendientes.clear(); escrituras.length = 0;
        falloAuditoria = false; falloLectura = false; falloCommit = false;
        lecturas = 0; comparaciones = 0; conexionesAbiertas = 0; conexionesCerradas = 0;
    };
    reset();
    const compareOriginal = bcrypt.compare;
    t.mock.method(bcrypt, 'compare', (...args) => { comparaciones++; return compareOriginal(...args); });
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(mysql, 'createConnection', async options => {
        assert.equal(options.database, 'cadefarexamen'); conexionesAbiertas++;
        let readOnly = false, rolledBack = false;
        return {
            query: async sql => { assert.equal(sql, 'START TRANSACTION READ ONLY'); readOnly = true; },
            execute: async (sql, values) => {
                assert.equal(readOnly, true); assert.match(sql, /^SELECT /); assert.doesNotMatch(sql, /FOR UPDATE|UPDATE |INSERT |DELETE /);
                if (falloLectura) throw new Error('Error de lectura sintético');
                lecturas++;
                return [[original && values[0] === original.nombre_usuario ? structuredClone(original) : null].filter(Boolean)];
            },
            rollback: async () => { rolledBack = true; },
            end: async () => { assert.equal(rolledBack, true); conexionesCerradas++; }
        };
    });
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => ({}));
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query;
        const tx = options.transaction?.id;
        if (/^SET /.test(sql)) return [];
        if (/^START TRANSACTION/.test(sql)) { pendientes.set(tx, structuredClone(estado)); return []; }
        if (/^COMMIT/.test(sql)) {
            if (falloCommit) { pendientes.delete(tx); throw new Error('Commit sintético incierto'); }
            estado = pendientes.get(tx); pendientes.delete(tx); return [];
        }
        if (/^ROLLBACK/.test(sql)) { pendientes.delete(tx); return []; }
        const actual = tx ? pendientes.get(tx) : estado;
        if (options.type === db.Sequelize.QueryTypes.SELECT && options.model === db.Usuario) {
            assert.match(sql, /usuario_sesion_local/);
            return original ? db.Usuario.build(original, { raw: true, isNewRecord: false }) : null;
        }
        if (/^SELECT DATABASE/.test(sql)) return [[{ nombre: 'cadefar_pagos_pruebas' }]];
        if (/^CREATE TABLE/.test(sql)) { escrituras.push(sql); return []; }
        if (/^INSERT INTO `cadefar_pagos_pruebas`.`seguridad_login_local`/.test(sql)) {
            assert.ok(tx); escrituras.push(sql);
            actual.seguridad ??= { version_credenciales: options.replacements.version, intentos_fallidos_login: 0, bloqueado_hasta: null };
            return [];
        }
        if (/FROM `cadefar_pagos_pruebas`.`seguridad_login_local`/.test(sql)) {
            assert.ok(tx); assert.match(sql, /FOR UPDATE/); return [[structuredClone(actual.seguridad)]];
        }
        if (/^UPDATE `cadefar_pagos_pruebas`.`seguridad_login_local`/.test(sql)) {
            assert.ok(tx); escrituras.push(sql);
            const r = options.replacements;
            if (r.version !== undefined) actual.seguridad = { version_credenciales: r.version, intentos_fallidos_login: 0, bloqueado_hasta: null };
            else Object.assign(actual.seguridad, { intentos_fallidos_login: r.intentos, bloqueado_hasta: r.hasta ? `${r.hasta.replace(' ', 'T')}Z` : null });
            return [];
        }
        assert.equal(options.instance?.constructor, db.BitacoraAuditoria);
        assert.ok(tx); assert.doesNotMatch(sql, /cadefarexamen/);
        if (falloAuditoria && options.instance.tipo_evento === 'LOGIN_EXITO') throw new Error('Auditoría sintética no disponible');
        const fila = options.instance.get({ plain: true }); actual.eventos.push(fila);
        options.instance.setDataValue('id_evento', actual.eventos.length);
        return [options.instance, 1];
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, { body, cookie, origin = 'http://localhost:5173' } = {}) => {
        const r = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: {
            Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {})
        }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie') };
    };
    const login = (entrada = password, origin) => request('/auth/login', { body: { nombreUsuario: 'admin_demo', password: entrada }, origin });
    try {
        await t.test('Formulario/API aceptan login directo y cookie HttpOnly; /me conserva sesión sin hashes', async () => {
            reset(); const r = await login();
            assert.equal(r.status, 200); assert.match(r.cookie, /HttpOnly/); assert.match(r.cookie, /SameSite=Lax/);
            assert.deepEqual(r.data.data, { idUsuario: 7777, idRol: 1, nombreUsuario: 'admin_demo', esPrueba: true });
            assert.equal(estado.eventos.filter(e => e.tipo_evento === 'LOGIN_EXITO').length, 1);
            assert.equal((await request('/auth/me', { cookie: r.cookie.split(';')[0] })).status, 200);
            assert.deepEqual(original, inicial); assert.equal(comparaciones, 1); assert.equal(lecturas, 2);
            assert.equal(conexionesAbiertas, conexionesCerradas);
            assert.equal(JSON.stringify(estado).includes(hash), false); assert.equal(JSON.stringify(estado).includes(password), false);
        });
        await t.test('Tres fallos bloquean solo el entorno local; otro intento no compara ni extiende el bloqueo', async () => {
            reset();
            for (const status of [401, 401, 423]) assert.equal((await login('incorrecta_sintetica')).status, status);
            const hasta = estado.seguridad.bloqueado_hasta;
            assert.equal(estado.seguridad.intentos_fallidos_login, 3);
            assert.equal((await login()).status, 423); assert.equal(comparaciones, 3);
            assert.equal(estado.seguridad.bloqueado_hasta, hasta); assert.deepEqual(original, inicial);
            assert.equal(estado.eventos.filter(e => e.tipo_evento === 'LOGIN_PASSWORD_INCORRECTA').length, 3);
            assert.equal(estado.eventos.filter(e => e.tipo_evento === 'LOGIN_BLOQUEO_GENERADO').length, 1);
        });
        await t.test('Bloqueo vencido permite contraseña correcta y reinicia solo el contador local', async () => {
            reset(); estado.seguridad = { version_credenciales: 1, intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() - 10000).toISOString() };
            assert.equal((await login()).status, 200);
            assert.equal(estado.seguridad.intentos_fallidos_login, 0); assert.equal(estado.seguridad.bloqueado_hasta, null);
            assert.deepEqual(original, inicial);
        });
        await t.test('No se eluden bloqueos originales, cuentas inactivas ni contraseñas vacías', async () => {
            reset(); original.bloqueado_hasta = new Date(Date.now() + 600000); original.intentos_fallidos_login = 3;
            assert.equal((await login()).status, 423); assert.equal(comparaciones, 0);
            reset(); original.estado = false; assert.equal((await login()).status, 403); assert.equal(comparaciones, 0);
            reset(); assert.equal((await login('')).status, 400); assert.equal(lecturas, 0);
            original = null; assert.equal((await login()).status, 401); assert.equal(comparaciones, 0);
        });
        await t.test('Cambiar versión original reinicia el estado auxiliar obsoleto sin copiar credenciales', async () => {
            reset(); estado.seguridad = { version_credenciales: 0, intentos_fallidos_login: 3, bloqueado_hasta: new Date(Date.now() + 600000).toISOString() };
            assert.equal((await login()).status, 200); assert.equal(estado.seguridad.version_credenciales, 1);
            assert.equal(estado.seguridad.intentos_fallidos_login, 0); assert.equal(estado.seguridad.bloqueado_hasta, null);
        });
        await t.test('Fallo de auditoría obligatoria, lectura o commit nunca entrega cookie', async () => {
            reset(); falloAuditoria = true;
            const audit = await login(); assert.equal(audit.status, 503); assert.equal(audit.cookie, null);
            assert.equal(estado.seguridad, null); assert.equal(estado.eventos.some(e => e.tipo_evento === 'LOGIN_EXITO'), false);
            reset(); falloLectura = true; const lectura = await login(); assert.equal(lectura.status, 500); assert.equal(lectura.cookie, null);
            assert.equal(conexionesAbiertas, conexionesCerradas);
            reset(); falloCommit = true; const commit = await login(); assert.equal(commit.status, 500); assert.equal(commit.cookie, null);
        });
        await t.test('CSRF de login, modificaciones de cuenta y recuperación siguen bloqueados', async () => {
            reset(); for (const origin of ['', 'http://otro.invalid', 'http://127.0.0.1:5173']) {
                assert.equal((await login(password, origin)).status, 403);
            }
            assert.equal(lecturas, 0);
            assert.equal((await request('/usuarios', { body: {} })).status, 409);
            assert.equal((await request('/auth/recuperacion/solicitar', { body: {} })).status, 409);
        });
        await t.test('Firmas de JWT separadas: tokens locales rechazados en el modo habitual y viceversa', () => {
            reset(); const payload = { idUsuario: 7777, idRol: 1, versionCredenciales: 1 };
            const local = generarToken(payload); assert.equal(verificarToken(local).idUsuario, 7777);
            process.env.PAGOS_MODO = 'PRODUCCION';
            try {
                assert.throws(() => verificarToken(local));
                const habitual = generarToken(payload); assert.equal(verificarToken(habitual).idUsuario, 7777);
                process.env.PAGOS_MODO = 'PRUEBA_LOCAL'; assert.throws(() => verificarToken(habitual));
            } finally { process.env.PAGOS_MODO = 'PRUEBA_LOCAL'; }
        });
        await t.test('Migración y acceso de credenciales fallan cerrados fuera del modo local', async () => {
            reset(); await migracion.up(db.sequelize.getQueryInterface());
            assert.ok(escrituras.every(sql => sql.includes('`cadefar_pagos_pruebas`')));
            process.env.NODE_ENV = 'production';
            try {
                const { authLocalRepository } = await import('../src/data/repositories/auth-local.repository.js');
                await assert.rejects(() => authLocalRepository.leerCredenciales('admin_demo'));
                await assert.rejects(() => migracion.up(db.sequelize.getQueryInterface()));
            } finally { process.env.NODE_ENV = 'development'; }
            assert.equal(conexionesAbiertas, 0);
        });
    } finally { await new Promise(resolve => server.close(resolve)); await db.sequelize.close(); }
});
