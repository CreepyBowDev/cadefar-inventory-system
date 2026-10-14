import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Express, validación, bcrypt, JWT, capas y transacciones Sequelize reales.
// Solo transporte SQL y estado transaccional simulados, sin conexiones MySQL.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'auditoria_auth_fase2_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exclusiva_auditoria_fase2';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { generarToken, verificarToken } = await import('../src/shared/utils/jwt.js');
const { anotarErrorAuditoria, obtenerErrorAuditoria } = await import('../src/shared/utils/auditoria-error.js');
const { errorHandler } = await import('../src/presentation/middlewares/error.middleware.js');

test('Auditoría Fase 2: login, bloqueos, logout y fallos HTTP con SQL simulado', async t => {
    const password = 'Credencial_sintetica_123!';
    const privada = 'dato_sintetico_privado_no_registrar';
    const hash = await bcrypt.hash(password, 4);
    const inicial = { usuarios: [1, 2, 3].map(id => ({ id_usuario: id, id_rol: id,
        nombre_usuario: `cuenta${id}`, password_hash: hash, estado: true,
        version_credenciales: 0, intentos_fallidos_login: 0, bloqueado_hasta: null })), eventos: [] };
    let estado, idEvento = 1, falloSql, falloConexion = false, falloCookie, falloJson;
    let despuesCommit;
    const pendientes = new Map(), consultas = [], logs = [], avisos = [], respuestas = [];
    const reset = () => {
        estado = structuredClone(inicial); pendientes.clear(); consultas.length = 0;
        logs.length = 0; avisos.length = 0; respuestas.length = 0;
        falloSql = undefined; falloConexion = false; falloCookie = undefined;
        falloJson = undefined; despuesCommit = undefined;
    };
    reset();
    const errorTecnico = () => {
        const error = new Error(privada);
        error.name = 'SequelizeDatabaseError'; error.sql = privada;
        error.parameters = { password, hash, token: privada };
        return error;
    };
    t.mock.method(console, 'error', value => logs.push(value));
    t.mock.method(console, 'warn', value => avisos.push(value));
    t.mock.method(db.sequelize.connectionManager, 'getConnection', async () => {
        if (falloConexion) {
            const error = new Error('Conexión sintética no disponible');
            error.name = 'SequelizeConnectionRefusedError';
            throw error;
        }
        return { uuid: 'conexion_sintetica' };
    });
    t.mock.method(db.sequelize.connectionManager, 'releaseConnection', async () => {});
    t.mock.method(db.sequelize.connectionManager, 'destroyConnection', async () => {});
    t.mock.method(db.sequelize, 'query', async (input, options = {}) => {
        const sql = typeof input === 'string' ? input : input.query;
        const bind = typeof input === 'string' ? options.bind : input.bind;
        options = { ...options, model: options.model ?? options.instance?.constructor };
        consultas.push({ sql, bind, options });
        const tx = options.transaction?.id;
        if (/^SET /.test(sql)) return [];
        if (/^START TRANSACTION/.test(sql)) {
            assert.equal(pendientes.has(tx), false);
            pendientes.set(tx, structuredClone(estado)); return [];
        }
        if (/^COMMIT/.test(sql)) {
            estado = pendientes.get(tx); pendientes.delete(tx);
            if (despuesCommit) await despuesCommit({ tx, sql });
            return [];
        }
        if (/^ROLLBACK/.test(sql)) { pendientes.delete(tx); return []; }
        const actual = tx ? pendientes.get(tx) : estado;
        assert.ok(actual, 'Toda escritura debe quedar dentro de START/COMMIT');
        if (falloSql) await falloSql({ sql, options });
        if (options.type === db.Sequelize.QueryTypes.SELECT) {
            assert.equal(options.model, db.Usuario);
            const nombre = sql.match(/`nombre_usuario` = '([^']*)'/)?.[1];
            const id = sql.match(/`id_usuario` = (\d+)/)?.[1];
            const fila = actual.usuarios.find(u => nombre !== undefined ? u.nombre_usuario === nombre : u.id_usuario === Number(id));
            if (nombre !== undefined) assert.match(sql, /FOR UPDATE;$/);
            return fila ? db.Usuario.build(structuredClone(fila), { isNewRecord: false, raw: true }) : null;
        }
        assert.ok(options.transaction);
        if (options.type === db.Sequelize.QueryTypes.BULKUPDATE) {
            assert.equal(options.model, db.Usuario);
            const valor = campo => {
                const token = sql.match(new RegExp('`' + campo + '`\\s*=\\s*([^, ;]+)'))[1];
                return token.startsWith('$') ? bind[Number(token.slice(1)) - 1] : Number(token);
            };
            const usuario = actual.usuarios.find(u => u.id_usuario === Number(valor('id_usuario')));
            usuario.intentos_fallidos_login = Number(valor('intentos_fallidos_login'));
            const hasta = valor('bloqueado_hasta');
            usuario.bloqueado_hasta = hasta == null ? null : new Date(`${String(hasta).replace(' ', 'T')}Z`);
            return 1;
        }
        assert.equal(options.type, db.Sequelize.QueryTypes.INSERT);
        assert.equal(options.model, db.BitacoraAuditoria);
        const fila = Object.fromEntries(Object.entries(options.instance.get({ plain: true }))
            .map(([campo, valor]) => [campo, valor?.fn === 'STR_TO_DATE' ? valor.args[0] : valor]));
        assert.equal(actual.eventos.some(e => e.correlacion === fila.correlacion && e.tipo_evento === fila.tipo_evento), false);
        fila.id_evento = idEvento++;
        actual.eventos.push(fila);
        options.instance.setDataValue('id_evento', fila.id_evento);
        return [options.instance, 1];
    });

    const cookieOriginal = app.response.cookie;
    t.mock.method(app.response, 'cookie', function (...args) {
        if (falloCookie && this.req.path.endsWith(falloCookie)) throw errorTecnico();
        if (this.req.path.endsWith('/login')) {
            assert.equal(pendientes.size, 0, 'La cookie nueva se emite después del commit');
            assert.ok(estado.eventos.some(e => e.tipo_evento === 'LOGIN_EXITO'));
        }
        return cookieOriginal.apply(this, args);
    });
    const jsonOriginal = app.response.json;
    t.mock.method(app.response, 'json', function (...args) {
        if (falloJson && this.statusCode === 200 && this.req.path.endsWith(falloJson)) {
            falloJson = undefined;
            throw errorTecnico();
        }
        return jsonOriginal.apply(this, args);
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const token = (id = 3, cambios = {}) => generarToken({ idUsuario: id, idRol: id, versionCredenciales: 0, ...cambios });
    const request = async (path, status, { body = {}, jwt: auth, raw, method = 'POST', headers = {} } = {}) => {
        const response = await fetch(`${base}${path}`, { method,
            headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: `token=${auth}` } : {}), ...headers },
            ...(method === 'GET' ? {} : { body: raw ?? JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
        const data = await response.json();
        const cookie = response.headers.get('set-cookie');
        respuestas.push(data);
        assert.equal(response.status, status, JSON.stringify(data));
        assert.equal(pendientes.size, 0, 'La respuesta llega después de terminar las transacciones');
        return { data, cookie };
    };
    const login = (passwordEntrada = password, status = 200, extras = {}) => request('/login', status,
        { body: { nombreUsuario: 'cuenta3', password: passwordEntrada }, ...extras });
    const usuario = () => estado.usuarios[2];
    const auditados = tipo => estado.eventos.filter(e => e.tipo_evento === tipo);
    const fallarEvento = tipo => { falloSql = ({ options }) => {
        if (options.instance?.tipo_evento === tipo) throw errorTecnico();
    }; };

    try {
        await t.test('Login correcto para los tres roles: un éxito, identidad e IP comprobadas, cookie vigente', async () => {
            reset();
            for (const id of [1, 2, 3]) {
                const result = await request('/login', 200, { body: { nombreUsuario: `cuenta${id}`, password },
                    headers: { 'X-Forwarded-For': '198.51.100.1', 'X-Real-IP': '198.51.100.2' } });
                assert.deepEqual(result.data, { message: 'Inicio de sesión exitoso',
                    data: { idUsuario: id, idRol: id, nombreUsuario: `cuenta${id}` } });
                assert.match(result.cookie, /HttpOnly/);
                assert.match(result.cookie, /SameSite=Lax/);
                assert.match(result.cookie, /Max-Age=28800/);
                const jwtCookie = decodeURIComponent(result.cookie.match(/^token=([^;]+)/)[1]);
                assert.equal(verificarToken(jwtCookie).idUsuario, id);
                const evento = auditados('LOGIN_EXITO').at(-1);
                assert.equal(evento.id_usuario_responsable, id);
                assert.equal(evento.id_rol_responsable, id);
                assert.equal(evento.nombre_usuario_responsable, `cuenta${id}`);
                assert.equal(evento.direccion_ip, '127.0.0.1');
                assert.equal(evento.procedencia_ip, 'SOCKET_PEER');
            }
            assert.equal(estado.eventos.length, 3);
        });

        await t.test('Intentos 1/2/3 y bloqueo: contadores confirmados, dos hechos del tercero, sin duplicados', async () => {
            reset();
            for (const contador of [1, 2, 3]) {
                const { data, cookie } = await login('incorrecta', contador === 3 ? 423 : 401);
                assert.equal(cookie, null);
                if (contador < 3) assert.deepEqual(data, { message: 'Usuario o contraseña incorrectos' });
                assert.equal(usuario().intentos_fallidos_login, contador);
                const fallo = auditados('LOGIN_PASSWORD_INCORRECTA').at(-1);
                assert.equal(fallo.metadatos.intentosFallidos, contador);
                assert.equal(fallo.id_usuario_objetivo, 3);
                assert.equal(fallo.id_usuario_responsable, null);
            }
            const bloqueo = auditados('LOGIN_BLOQUEO_GENERADO')[0];
            const tercero = auditados('LOGIN_PASSWORD_INCORRECTA')[2];
            assert.equal(bloqueo.correlacion, tercero.correlacion);
            assert.equal(bloqueo.metadatos.duracionMinutos, 10);
            assert.equal(new Date(bloqueo.metadatos.bloqueadoHasta.replace(' ', 'T') + 'Z').getTime() -
                new Date(bloqueo.metadatos.bloqueadoDesde.replace(' ', 'T') + 'Z').getTime(), 600000);
            assert.equal(estado.eventos.length, 4);
            assert.equal(usuario().estado, true);
            // La primera transacción de seguridad termina antes del primer INSERT de rechazo.
            const primerInsert = consultas.findIndex(q => q.options.instance?.tipo_evento === 'LOGIN_PASSWORD_INCORRECTA');
            assert.ok(consultas.slice(0, primerInsert).some(q => /^COMMIT/.test(q.sql)));
        });

        await t.test('Intento durante bloqueo: no compara contraseña ni amplía bloqueo ni revoca sesión existente', async () => {
            reset();
            for (const contador of [1, 2, 3]) await login('incorrecta', contador === 3 ? 423 : 401);
            const hasta = usuario().bloqueado_hasta.getTime();
            const comparar = bcrypt.compare;
            t.mock.method(bcrypt, 'compare', () => assert.fail('No debe comprobar contraseña durante bloqueo'));
            await login(password, 423);
            t.mock.method(bcrypt, 'compare', comparar);
            assert.equal(usuario().bloqueado_hasta.getTime(), hasta);
            assert.equal(usuario().intentos_fallidos_login, 3);
            assert.equal(auditados('LOGIN_PASSWORD_INCORRECTA').length, 3);
            assert.equal(auditados('LOGIN_BLOQUEO_GENERADO').length, 1);
            assert.equal(auditados('LOGIN_INTENTO_BLOQUEADO').length, 1);
            const total = estado.eventos.length;
            await request('/me', 200, { jwt: token(), method: 'GET' });
            assert.equal(estado.eventos.length, total, 'Una lectura rutinaria no genera auditoría');
        });

        await t.test('Bloqueo vencido reinicia el siguiente fallo en 1; éxito posterior reinicia contador', async () => {
            reset();
            usuario().intentos_fallidos_login = 3;
            usuario().bloqueado_hasta = new Date(Date.now() - 1000);
            await login('incorrecta', 401);
            assert.equal(usuario().intentos_fallidos_login, 1);
            assert.equal(usuario().bloqueado_hasta, null);
            assert.equal(auditados('LOGIN_PASSWORD_INCORRECTA')[0].metadatos.intentosFallidos, 1);
            await login();
            assert.equal(usuario().intentos_fallidos_login, 0);
            assert.equal(usuario().bloqueado_hasta, null);
        });

        await t.test('Nombre inexistente e inactivo conservan respuestas y no fabrican identidad autenticada', async () => {
            reset();
            const inexistente = await request('/login', 401, { body: { nombreUsuario: 'ausente', password } });
            const incorrecto = await login('incorrecta', 401);
            assert.deepEqual(inexistente.data, incorrecto.data);
            const desconocido = auditados('LOGIN_USUARIO_INEXISTENTE')[0];
            assert.equal(desconocido.nombre_ingresado, 'ausente');
            assert.equal(desconocido.id_usuario_objetivo, null);
            assert.equal(desconocido.id_usuario_responsable, null);
            assert.equal(desconocido.metadatos, null);
            usuario().estado = false;
            const result = await login(password, 403);
            assert.deepEqual(result.data, { message: 'Usuario inactivo' });
            assert.equal(usuario().intentos_fallidos_login, 1);
            assert.equal(auditados('LOGIN_USUARIO_INACTIVO')[0].id_usuario_responsable, null);
        });

        await t.test('Fallo de auditoría obligatorio revierte reinicio del login y no emite cookie', async () => {
            reset(); usuario().intentos_fallidos_login = 2;
            fallarEvento('LOGIN_EXITO');
            const { data, cookie } = await login(password, 503);
            assert.deepEqual(data, { message: 'No se pudo completar el registro de auditoría' });
            assert.equal(cookie, null);
            assert.equal(usuario().intentos_fallidos_login, 2);
            assert.equal(estado.eventos.length, 0);
            assert.equal(logs.filter(log => log.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA').length, 1);
            assert.equal(consultas.filter(q => /^INSERT /.test(q.sql)).length, 1, 'No audita recursivamente el error del auditor');
        });

        await t.test('Fallos del auditor en rechazos conservan contador, tercer bloqueo y respuesta original', async () => {
            reset(); fallarEvento('LOGIN_PASSWORD_INCORRECTA');
            await login('incorrecta', 401);
            assert.equal(usuario().intentos_fallidos_login, 1);
            await login('incorrecta', 401);
            await login('incorrecta', 423);
            assert.equal(usuario().intentos_fallidos_login, 3);
            assert.ok(usuario().bloqueado_hasta > new Date());
            assert.equal(estado.eventos.length, 0);
            fallarEvento('LOGIN_INTENTO_BLOQUEADO');
            const hasta = usuario().bloqueado_hasta.getTime();
            await login(password, 423);
            assert.equal(usuario().bloqueado_hasta.getTime(), hasta);
        });

        await t.test('Fallo del segundo evento de bloqueo revierte el grupo de auditoría, no la cuenta', async () => {
            reset(); usuario().intentos_fallidos_login = 2;
            fallarEvento('LOGIN_BLOQUEO_GENERADO');
            await login('incorrecta', 423);
            assert.equal(usuario().intentos_fallidos_login, 3);
            assert.ok(usuario().bloqueado_hasta > new Date());
            assert.equal(estado.eventos.length, 0);
            assert.equal(consultas.filter(q => /^INSERT /.test(q.sql)).length, 2);
        });

        await t.test('Cambio posterior simulado: conserva el contador capturado bajo bloqueo sin releerlo', async () => {
            reset();
            despuesCommit = () => { usuario().intentos_fallidos_login = 2; despuesCommit = undefined; };
            await login('incorrecta', 401);
            assert.equal(usuario().intentos_fallidos_login, 2);
            assert.equal(auditados('LOGIN_PASSWORD_INCORRECTA')[0].metadatos.intentosFallidos, 1);
            assert.equal(consultas.filter(q => /^SELECT /.test(q.sql)).length, 1);
        });

        await t.test('Fallo de firma JWT no reinicia seguridad ni deja un éxito de login', async () => {
            reset(); usuario().intentos_fallidos_login = 2;
            const secreto = process.env.JWT_SECRET;
            try {
                delete process.env.JWT_SECRET;
                const { cookie } = await login(password, 500);
                assert.equal(cookie, null);
            } finally { process.env.JWT_SECRET = secreto; }
            assert.equal(usuario().intentos_fallidos_login, 2);
            assert.equal(auditados('LOGIN_EXITO').length, 0);
            const error = auditados('ERROR_TECNICO')[0];
            assert.equal(error.metadatos.etapa, 'FIRMA_TOKEN');
            assert.equal(error.metadatos.efecto, 'NO_APLICA');
        });

        await t.test('Error de lectura o seguridad revierte el negocio y registra solo fallo técnico seguro', async () => {
            for (const etapa of ['SELECT', 'UPDATE']) {
                reset();
                falloSql = ({ sql, options }) => {
                    if (options.model === db.Usuario && sql.startsWith(etapa)) throw errorTecnico();
                };
                const { data, cookie } = await login('incorrecta', 500);
                assert.deepEqual(data, { message: 'Error interno del servidor' });
                assert.equal(cookie, null);
                assert.equal(usuario().intentos_fallidos_login, 0);
                assert.equal(auditados('ERROR_TECNICO').length, 1);
                assert.equal(auditados('LOGIN_PASSWORD_INCORRECTA').length, 0);
                assert.equal(estado.eventos[0].causa, 'ERROR_PERSISTENCIA');
                assert.equal(estado.eventos[0].metadatos.efecto, 'NO_APLICA');
                assert.equal(JSON.stringify(logs).includes(privada), false);
            }
        });

        await t.test('Conexión caída conserva el 500 original, sin afirmar que el error se persistió', async () => {
            reset(); falloConexion = true;
            await login(password, 500);
            assert.equal(estado.eventos.length, 0);
            assert.equal(usuario().intentos_fallidos_login, 0);
            assert.ok(logs.some(log => log.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
        });

        await t.test('Commit de login incierto no entrega cookie ni vuelve a registrar éxito', async () => {
            reset();
            despuesCommit = () => { despuesCommit = undefined; throw new Error('Respuesta sintética de commit perdida'); };
            const { cookie } = await login(password, 500);
            assert.equal(cookie, null);
            assert.equal(auditados('LOGIN_EXITO').length, 1, 'El transporte simula commit aplicado antes de perder respuesta');
            assert.equal(auditados('ERROR_TECNICO').length, 1);
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.efecto, 'INCIERTO');
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.etapa, 'CONFIRMACION');
        });

        await t.test('Validación, JSON malformado y body excesivo: auditoría única sin copiar entradas', async () => {
            reset();
            await request('/login', 400, { body: { nombreUsuario: 'cuenta3', password, token: privada } });
            await request('/login', 400, { raw: `{"password":"${privada}"` });
            await request('/login', 413, { raw: JSON.stringify({ password: privada + 'x'.repeat(110 * 1024) }) });
            assert.equal(auditados('VALIDACION_RECHAZADA').length, 3);
            assert.equal(consultas.some(q => q.options.model === db.Usuario), false);
            assert.equal(JSON.stringify(estado.eventos).includes(privada), false);
            assert.equal(estado.eventos.some(e => e.nombre_ingresado !== null), false);
            assert.equal(JSON.stringify(logs).includes(privada), false);
        });

        await t.test('Fallo del auditor en validación conserva el 400 original; rutas reales aceptan caja y slash', async () => {
            reset(); fallarEvento('VALIDACION_RECHAZADA');
            const result = await request('/login', 400, { body: {} });
            assert.equal(result.data.message, 'Datos de inicio de sesión inválidos');
            assert.equal(estado.eventos.length, 0);
            falloSql = undefined;
            await request('/LOGIN/?origen=prueba', 400, { body: {} });
            assert.equal(auditados('VALIDACION_RECHAZADA').length, 1);
        });

        await t.test('Logout explícito audita al usuario comprobado, no rol/ID del body o del JWT', async () => {
            reset();
            const result = await request('/logout', 200, { jwt: token(3, { idRol: 99 }),
                body: { idUsuario: 1, idRol: 1, nombreUsuario: 'falso', password: privada } });
            assert.deepEqual(result.data, { message: 'Sesión cerrada correctamente' });
            assert.match(result.cookie, /^token=;/);
            assert.match(result.cookie, /Expires=Thu, 01 Jan 1970/);
            assert.match(result.cookie, /HttpOnly/);
            assert.match(result.cookie, /SameSite=Lax/);
            assert.equal(auditados('LOGOUT').length, 1);
            assert.equal(estado.eventos[0].id_usuario_responsable, 3);
            assert.equal(estado.eventos[0].id_rol_responsable, 3);
            assert.equal(estado.eventos[0].nombre_usuario_responsable, 'cuenta3');
            assert.equal(JSON.stringify(estado.eventos).includes(privada), false);
        });

        await t.test('Logout conserva cookie de eliminación y 200 si falla exclusivamente su auditoría', async () => {
            reset(); fallarEvento('LOGOUT');
            const result = await request('/logout', 200, { jwt: token() });
            assert.match(result.cookie, /^token=;/);
            assert.equal(result.data.message, 'Sesión cerrada correctamente');
            assert.equal(estado.eventos.length, 0);
            assert.equal(consultas.filter(q => /^INSERT /.test(q.sql)).length, 1);
        });

        await t.test('Logout rechazado: sesión ausente, firma inválida, expirado y payload inválido son distintos', async () => {
            reset();
            const casos = [
                [undefined, 'SESION_AUSENTE'], ['token_invalido', 'TOKEN_INVALIDO'],
                [jwt.sign({ idUsuario: 3, idRol: 3, versionCredenciales: 0 }, process.env.JWT_SECRET, { expiresIn: -1 }), 'TOKEN_EXPIRADO'],
                [jwt.sign({ idUsuario: 3, idRol: 3 }, process.env.JWT_SECRET), 'TOKEN_INVALIDO'],
                [jwt.sign({ idUsuario: 1, idRol: 1, versionCredenciales: 0 }, 'firma_sintetica_distinta'), 'TOKEN_INVALIDO']
            ];
            for (const [auth, tipo] of casos) {
                const result = await request('/logout', 401, { jwt: auth });
                assert.equal(result.cookie, null);
                assert.equal(estado.eventos.at(-1).tipo_evento, tipo);
                assert.equal(estado.eventos.at(-1).id_usuario_responsable, null);
                assert.equal(estado.eventos.at(-1).id_usuario_objetivo, null);
            }
            assert.equal(auditados('LOGOUT').length, 0);
            assert.equal(estado.eventos.length, casos.length);
        });

        await t.test('Logout con versión revocada, cuenta inactiva o inexistente no acredita cierre', async () => {
            for (const variante of ['version', 'inactivo', 'inexistente']) {
                reset();
                if (variante === 'version') usuario().version_credenciales = 1;
                if (variante === 'inactivo') usuario().estado = false;
                if (variante === 'inexistente') estado.usuarios.pop();
                const result = await request('/logout', 401, { jwt: token() });
                assert.equal(result.cookie, null);
                assert.equal(auditados('LOGOUT').length, 0);
                const error = auditados('SESION_INVALIDA')[0];
                assert.equal(error.id_usuario_responsable, null);
                assert.equal(error.causa, variante === 'version' ? 'CREDENCIALES_DESACTUALIZADAS' :
                    variante === 'inactivo' ? 'USUARIO_INACTIVO' : 'USUARIO_INEXISTENTE');
                assert.equal(error.id_usuario_objetivo, variante === 'inexistente' ? null : 3);
            }
        });

        await t.test('Fallo técnico autenticando logout se registra sin limpiar cookie ni sustituir el 500', async () => {
            reset();
            falloSql = ({ options }) => { if (options.model === db.Usuario) throw errorTecnico(); };
            const result = await request('/logout', 500, { jwt: token() });
            assert.equal(result.cookie, null);
            assert.equal(auditados('LOGOUT').length, 0);
            assert.equal(auditados('ERROR_TECNICO').length, 1);
            assert.equal(estado.eventos[0].metadatos.operacionOrigen, 'AUTENTICACION.LOGOUT');
        });

        await t.test('Errores en cookie/respuesta distinguen efectos confirmados de fallo HTTP posterior', async () => {
            reset(); falloCookie = '/login';
            await login(password, 500);
            assert.equal(auditados('LOGIN_EXITO').length, 1);
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.efecto, 'CONFIRMADO');
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.etapa, 'COOKIE');
            assert.equal(auditados('ERROR_TECNICO')[0].correlacion, auditados('LOGIN_EXITO')[0].correlacion);
            reset(); falloCookie = '/logout';
            await request('/logout', 500, { jwt: token() });
            assert.equal(auditados('LOGOUT').length, 0);
            assert.equal(auditados('ERROR_TECNICO')[0].id_usuario_responsable, 3);
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.efecto, 'NO_APLICA');
            reset(); falloJson = '/logout';
            const result = await request('/logout', 500, { jwt: token() });
            assert.match(result.cookie, /^token=;/);
            assert.equal(auditados('LOGOUT').length, 1);
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.efecto, 'CONFIRMADO');
            assert.equal(auditados('ERROR_TECNICO')[0].metadatos.etapa, 'RESPUESTA');
        });

        await t.test('Sesión pública no genera éxito rutinario; sesión ausente se audita transversalmente', async () => {
            reset();
            await request('/me', 200, { jwt: token(), method: 'GET' });
            assert.equal(estado.eventos.length, 0);
            await request('/me', 401, { method: 'GET' });
            assert.equal(auditados('SESION_AUSENTE').length, 1);
        });

        await t.test('Datos privados: errores no serializan contexto, diagnósticos no copian secretos ni nombres arbitrarios', () => {
            const error = anotarErrorAuditoria(new Error('Fallo sintético'), { causa: privada, cuentaObjetivo: { secreto: privada } });
            assert.equal(obtenerErrorAuditoria(error).causa, privada);
            assert.equal(JSON.stringify(error).includes(privada), false);
            error.name = privada;
            let body;
            errorHandler(error, {}, { status() { return this; }, json(value) { body = value; } }, () => {});
            assert.deepEqual(body, { message: 'Error interno del servidor' });
            assert.equal(JSON.stringify(logs).includes(privada), false);
            assert.equal(JSON.stringify(estado.eventos).includes(hash), false);
            assert.equal(JSON.stringify(estado.eventos).includes(password), false);
        });
        await t.test('Respuesta parcialmente enviada: termina conexión sin otro JSON ni error crudo al handler por defecto', () => {
            const error = errorTecnico();
            let destruida = false;
            errorHandler(error, {}, { headersSent: true,
                destroy() { destruida = true; }, status() { assert.fail('No puede enviar otra cabecera'); } },
                () => assert.fail('No reenviar stack/SQL al handler por defecto'));
            assert.equal(destruida, true);
            assert.equal(JSON.stringify(logs).includes(privada), false);
        });
        t.diagnostic('Cobertura HTTP con SQL y transacciones gestionadas reales, transporte simulado. Sin MySQL, migraciones ni cambios de Railway.');
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.sequelize.close();
    }
});
