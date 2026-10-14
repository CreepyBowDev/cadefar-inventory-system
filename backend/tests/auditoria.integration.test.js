import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';

// Opt-in explícito. Crea solo una base local nueva, que conserva al terminar.
// No utiliza sync, DROP, DELETE, truncate ni cambios de usuarios/GRANT.
dotenv.config({ quiet: true });
assert.equal(process.env.AUDITORIA_MYSQL_ACCEPTANCE, '1', 'Autorizar explícitamente la aceptación MySQL aislada');
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST), 'Se requiere MySQL local');
const database = `cadefar_auditoria_${randomBytes(6).toString('hex')}`;
assert.ok(![process.env.DB_NAME, process.env.DB_NAME_TEST, process.env.DB_NAME_PRODUCTION]
    .filter(Boolean).some(nombre => nombre.toLowerCase() === database.toLowerCase()));
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = database;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
Object.assign(process.env, { RECOVERY_ENABLED: 'true', MAIL_PROVIDER: 'mock',
    MAIL_FROM: 'farmacia@example.test', MAIL_FROM_NAME: 'CADEFAR',
    RECOVERY_CLIENT_IP_SOURCE: 'socket', RECOVERY_HMAC_SECRET: randomBytes(32).toString('hex') });
const ejecutar = promisify(execFile);
const directorio = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/sequelize-cli/lib/sequelize', import.meta.url));
const runCli = async (...args) => {
    try { await ejecutar(process.execPath, [cli, ...args, '--env', 'test'], { cwd: directorio, env: { ...process.env }, timeout: 90000 }); }
    catch { throw new Error(`Sequelize CLI: ${args[0]} falló en la base local aislada`); }
};
const crearBaseNueva = async () => {
    let conexion;
    try {
        conexion = await mysql.createConnection({ host: process.env.DB_HOST,
            user: process.env.DB_USER, password: process.env.PASSWORD_DB });
        // Sin IF NOT EXISTS: una colisión debe fallar, nunca migrar una base previa.
        await conexion.query(`CREATE DATABASE \`${database}\``);
    } catch { throw new Error('No se pudo crear una base local nueva para aceptación'); }
    finally { if (conexion) await conexion.end(); }
};

test('Fase 7: aceptación Bitácora con MySQL local real y base conservada', { timeout: 180000 }, async t => {
    let db, server;
    const logs = [];
    t.mock.method(console, 'error', mensaje => logs.push(mensaje));
    try {
        await crearBaseNueva();
        t.diagnostic(`Base local creada y conservada: ${database}`);
        await runCli('db:migrate');
        await runCli('db:seed', '--seed', '20260914181926-seed-rol.js');
        ({ default: db } = await import('../src/data/models/index.js'));
        const { bitacoraAuditoriaService: service } = await import('../src/business/services/bitacora-auditoria.service.js');
        const { bitacoraAuditoriaRepository: repo } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
        const { crearContextoAuditoriaConexion: contexto } = await import('../src/shared/utils/auditoria-contexto.js');
        const { prepararEventoAuditoria } = await import('../src/business/validators/auditoria.validator.js');
        const { generarToken } = await import('../src/shared/utils/jwt.js');
        const { app } = await import('../src/app.js');
        const select = (sql, replacements) => db.sequelize.query(sql, { replacements, type: db.Sequelize.QueryTypes.SELECT, logging: false });
        const [version] = await select('SELECT VERSION() AS version');
        t.diagnostic(`Servidor de aceptación: MySQL ${version.version}`);
        const password = 'ClaveSintetica-123!';
        const hash = await bcrypt.hash(password, 4);
        const usuarios = [];
        for (const rol of [1, 2, 3]) usuarios.push(await db.Usuario.create({ id_rol: rol, nombre_usuario: `fixture_rol_${rol}`, password_hash: hash }));
        const responsable = { idUsuario: usuarios[0].id_usuario, idRol: 1, nombreUsuario: usuarios[0].nombre_usuario };
        const evento = (extra = {}) => ({ tipoEvento: 'LOGOUT', resultado: 'EXITO', responsable, contexto: contexto('192.0.2.1'), ...extra });
        const rows = tipo => select('SELECT * FROM bitacora_auditoria WHERE tipo_evento = ? ORDER BY id_evento', [tipo]);
        const count = () => db.BitacoraAuditoria.count();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
        const request = async (method, path, body, rol = 1, status = 200, headers = {}) => {
            const u = usuarios[rol - 1];
            const token = generarToken({ idUsuario: u.id_usuario, idRol: rol, versionCredenciales: 0 });
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
                headers: { 'Content-Type': 'application/json', Cookie: `token=${token}`, ...headers },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
            const data = await response.json();
            if (status !== null) assert.equal(response.status, status, JSON.stringify(data));
            return { data, response };
        };
        await t.test('Migración aplicada: InnoDB, JSON, DATETIME(3), índices y ausencia de FKs/cascadas', async () => {
            const [tabla] = await select('SHOW CREATE TABLE bitacora_auditoria');
            const ddl = tabla['Create Table']; assert.match(ddl, /ENGINE=InnoDB/); assert.match(ddl, /datetime\(3\)/i);
            assert.match(ddl, /utf8mb4_bin/); assert.doesNotMatch(ddl, /FOREIGN KEY|CASCADE/i);
            assert.match(ddl, /uq_bitacora_solicitud_tipo/); assert.match(ddl, /chk_bitacora_resultado/);
            const columnas = await select("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bitacora_auditoria' AND COLUMN_NAME IN ('antes','despues','metadatos','referencias')", [database]);
            assert.equal(columnas.filter(c => c.DATA_TYPE === 'json').length, 4);
        });
        let idTemporal;
        await t.test('UTC y milisegundos reales independientes del timezone Sequelize; JSON permitido sin secretos', async () => {
            const previa = db.sequelize.options.timezone;
            db.sequelize.options.timezone = '-04:00';
            try {
                idTemporal = await service.registrar(evento({ fechaEvento: new Date('2026-01-02T03:04:05.678Z'),
                    antes: { password_hash: hash }, metadatos: { efecto: 'CONFIRMADO', cookie: 'no_conservar' } }));
            } finally { db.sequelize.options.timezone = previa; }
            const data = await repo.findById({ idEvento: idTemporal });
            assert.equal(data.fecha_evento, '2026-01-02T03:04:05.678Z'); assert.match(data.fecha_registro, /\.\d{3}Z$/);
            assert.equal(data.antes, null); assert.deepEqual(data.metadatos, { efecto: 'CONFIRMADO' });
        });
        await t.test('CHECK efectivos rechazan estado/IP/identidad/registro/versión incoherentes por SQL real', async () => {
            const antes = await count();
            for (const extra of [{ resultado: 'INVALIDO' }, { procedencia_ip: 'SOCKET_PEER', direccion_ip: null },
                { id_usuario_responsable: null }, { tipo_registro: 'USUARIO', id_registro: null }, { version_formato: 0 }]) {
                const data = { ...prepararEventoAuditoria(evento()), ...extra };
                await assert.rejects(db.sequelize.transaction(tx => repo.create({ data, transaction: tx })),
                    error => error.original?.code === 'ER_CHECK_CONSTRAINT_VIOLATED');
            }
            assert.equal(await count(), antes);
        });
        await t.test('UNIQUE concurrente: un confirmado, otro no confirmado, sin duplicado ni reintento', async () => {
            const e = evento(); const resultados = await Promise.all([service.intentarRegistrar(e), service.intentarRegistrar(e)]);
            assert.deepEqual(resultados.map(r => r.estado).sort(), ['CONFIRMADO', 'NO_CONFIRMADO']);
            assert.equal(await db.BitacoraAuditoria.count({ where: { correlacion: e.contexto.correlacion } }), 1);
        });
        await t.test('Rollback InnoDB real elimina éxito no confirmado y cambio de negocio conjuntamente', async () => {
            const e = evento({ tipoEvento: 'USUARIO_ESTADO', registro: { tipo: 'USUARIO', id: usuarios[2].id_usuario } });
            await assert.rejects(db.sequelize.transaction(async transaction => {
                await db.Usuario.update({ estado: false }, { where: { id_usuario: usuarios[2].id_usuario }, transaction });
                await service.registrar(e, { transaction }); throw new Error('rollback_sintetico');
            }), /rollback_sintetico/);
            assert.equal((await usuarios[2].reload()).estado, true);
            assert.equal(await db.BitacoraAuditoria.count({ where: { correlacion: e.contexto.correlacion } }), 0);
        });
        await t.test('Persistencia después de arrancar otro proceso: detalle e instante originales', async () => {
            const script = `import db from './src/data/models/index.js'; import { bitacoraAuditoriaRepository as r } from './src/data/repositories/bitacora-auditoria.repository.js'; const e = await r.findById({ idEvento: ${idTemporal} }); console.log(JSON.stringify({ id: e.id_evento, fecha: e.fecha_evento })); await db.sequelize.close();`;
            let result;
            try { result = await ejecutar(process.execPath, ['--input-type=module', '-e', script], { cwd: directorio, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' }, timeout: 30000 }); }
            catch { throw new Error('No se pudo recuperar el evento en el proceso reiniciado'); }
            const recuperado = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
            assert.deepEqual(recuperado, { id: idTemporal, fecha: '2026-01-02T03:04:05.678Z' });
        });
        await t.test('CU42 HTTP real: filtros UTC inclusivos, página/total, detalle histórico y autorización', async () => {
            const e = await repo.findById({ idEvento: idTemporal });
            const filtros = new URLSearchParams({ desde: e.fecha_registro, hasta: e.fecha_registro,
                tipoEvento: 'LOGOUT', idUsuarioResponsable: String(responsable.idUsuario), limite: '1' });
            const listado = (await request('GET', `/bitacora?${filtros}`)).data;
            assert.equal(listado.data[0].idEvento, idTemporal); assert.equal(listado.paginacion.total, 1);
            const detalle = (await request('GET', `/bitacora/${idTemporal}`)).data.data;
            assert.equal(detalle.fechaEvento, e.fecha_evento);
            await request('GET', '/bitacora', undefined, 2, 403); await request('GET', '/bitacora', undefined, 3, 403);
            const vacio = (await request('GET', '/bitacora?tipoRegistro=BITACORA&idRegistro=2147483647')).data;
            assert.deepEqual(vacio.data, []); assert.equal(vacio.paginacion.total, 0);
        });
        await t.test('Página/count REPEATABLE READ mantiene snapshot frente a INSERT confirmado concurrente', async () => {
            await db.sequelize.transaction({ isolationLevel: 'REPEATABLE READ' }, async transaction => {
                const filtros = { pagina: 1, limite: 100, tipoEvento: 'LOGOUT' };
                const antes = await repo.findAll(filtros, { transaction });
                await service.registrar(evento());
                const despues = await repo.findAll(filtros, { transaction });
                assert.deepEqual(despues, antes);
            });
        });
        await t.test('Login/bloqueo reales: tres fallos confirman contador, dos hechos del tercero y bloqueo vigente', async () => {
            for (const status of [401, 401, 423]) await request('POST', '/auth/login', { nombreUsuario: usuarios[2].nombre_usuario, password: 'Incorrecta' }, 3, status);
            await request('POST', '/auth/login', { nombreUsuario: usuarios[2].nombre_usuario, password }, 3, 423);
            assert.equal((await rows('LOGIN_PASSWORD_INCORRECTA')).length, 3);
            const bloqueos = await rows('LOGIN_BLOQUEO_GENERADO'); assert.equal(bloqueos.length, 1);
            assert.equal((await rows('LOGIN_INTENTO_BLOQUEADO')).length, 1);
            const fallo = (await rows('LOGIN_PASSWORD_INCORRECTA')).at(-1);
            assert.equal(bloqueos[0].correlacion, fallo.correlacion);
            assert.equal((await usuarios[2].reload()).intentos_fallidos_login, 3);
            const login = await request('POST', '/auth/login', { nombreUsuario: usuarios[0].nombre_usuario, password });
            assert.match(login.response.headers.get('set-cookie'), /HttpOnly/i); assert.equal((await rows('LOGIN_EXITO')).length, 1);
        });
        await t.test('CU04/CU05 y alta administrativa real conservan solo snapshots públicos del usuario', async () => {
            const r = await request('POST', '/usuarios', { nombreUsuario: 'usuario_alta_sintetico', idRol: 3, password, correo: 'alta@example.test' }, 1, 201);
            const idUsuario = r.data.data.idUsuario;
            await request('GET', '/usuarios'); await request('GET', `/usuarios/${idUsuario}`);
            assert.equal((await rows('USUARIO_CREAR')).length, 1); assert.equal((await rows('USUARIOS_CONSULTAR')).length, 1);
            assert.equal((await rows('USUARIO_CONSULTAR')).length, 1);
            const privado = JSON.stringify(await rows('USUARIO_CREAR'));
            assert.equal(privado.includes(password), false); assert.equal(privado.includes('alta@example.test'), false);
        });
        await t.test('Cambio efectivo de contraseña real confirma hash/versión y auditoría', async () => {
            const creado = await db.Usuario.create({ nombre_usuario: 'password_sintetico', id_rol: 3, password_hash: hash });
            const { usuarioService } = await import('../src/business/services/usuario.service.js');
            await usuarioService.updatePassword(creado.id_usuario, { password: 'CambioSintetico-456!' }, { contexto: contexto('192.0.2.2'), responsable });
            await creado.reload(); assert.equal(creado.version_credenciales, 1);
            assert.equal(await bcrypt.compare('CambioSintetico-456!', creado.password_hash), true);
            const e = (await rows('PASSWORD_RESTABLECER_ADMINISTRADOR')).at(-1);
            assert.equal(e.id_usuario_objetivo, creado.id_usuario); assert.equal(e.antes, null); assert.equal(e.despues, null);
        });
        await t.test('Recuperación real: emisión/envío distintos, consumo atómico y cuotas preservadas sin correo/código/HMAC auditados', async () => {
            const creado = await db.Usuario.create({ nombre_usuario: 'recuperacion_sintetica', id_rol: 3, password_hash: hash, correo: 'recovery@example.test' });
            const { recuperacionPasswordService: recovery } = await import('../src/business/services/recuperacion-password.service.js');
            let codigo;
            const espera = t.mock.method(recovery, 'esperarRespuesta', async () => {});
            try {
                await recovery.solicitarRecuperacion({ correo: creado.correo }, '192.0.2.3', { resolverMock: async mensaje => {
                    codigo = /\b\d{6}\b/.exec(mensaje.text)[0]; return { estado: 'ACEPTADO' };
                } }, contexto('192.0.2.3'));
                assert.match(codigo, /^\d{6}$/);
                assert.equal((await rows('RECUPERACION_EMITIR')).length, 1); assert.equal((await rows('RECUPERACION_ENVIO')).length, 1);
                await recovery.restablecerPassword({ correo: creado.correo, codigo, passwordNueva: 'RecuperadaSintetica-789!' }, '192.0.2.3', contexto('192.0.2.3'));
            } finally { espera.mock.restore(); }
            await creado.reload(); assert.equal(creado.version_credenciales, 1);
            const recuperacion = await db.RecuperacionPassword.findOne({ where: { id_usuario: creado.id_usuario } });
            assert.ok(recuperacion.consumida_en); assert.ok(await db.LimiteRecuperacionIp.count());
            const auditado = JSON.stringify(await rows('PASSWORD_RESTABLECER_RECUPERACION'));
            assert.equal(auditado.includes(creado.correo), false); assert.equal(auditado.includes(recuperacion.codigo_hmac), false);
            assert.equal(auditado.includes('RecuperadaSintetica-789!'), false);
        });
        const proveedor = await db.ProveedorLaboratorio.create({ nombre: 'Proveedor sintético' });
        const medicamento = await db.Medicamento.create({ id_proveedor_laboratorio: proveedor.id_proveedor_laboratorio,
            codigo_medicamento: 'SYN001', nombre_comercial: 'Producto sintético', forma_farmaceutica: 'Tableta',
            presentacion: '500 mg', unidad_inventario: 'tableta', condicion_venta: 'LIBRE', via_administracion: 'ORAL', tipo_liberacion: 'INMEDIATA' });
        const nuevaCompra = clave => ({ fechaCompra: '2026-01-01', claveOperacion: clave, detalles: [
            { idMedicamento: medicamento.id_medicamento, cantidad: 10, costoUnitario: '1', fechaVencimiento: '2035-12-31', precisionVencimiento: 'DIA' }
        ] });
        let idCompra, idExistencia;
        await t.test('Registro de compra real confirma cabecera/detalle/existencia/movimiento y un evento', async () => {
            const r = (await request('POST', '/compras', nuevaCompra('sintetica_compra_1'), 1, 201)).data.data;
            idCompra = r.idCompra; idExistencia = r.detalles[0].idExistencia;
            const eventos = await rows('COMPRA_REGISTRAR'); assert.equal(eventos.length, 1); assert.equal(eventos[0].id_registro, idCompra);
            assert.equal((await db.ExistenciaMedicamento.findByPk(idExistencia)).cantidad_fisica, 10);
        });
        await t.test('Auditoría fallida por INSERT duplicado real revierte una compra nueva con 503', async () => {
            const antes = [await db.Compra.count(), await db.DetalleCompra.count(), await db.MovimientoInventario.count(), await count()];
            const saldo = (await db.ExistenciaMedicamento.findByPk(idExistencia)).cantidad_fisica;
            const original = repo.create;
            const mock = t.mock.method(repo, 'create', async function (args) {
                const id = await original.call(this, args);
                if (args.data.tipo_evento === 'COMPRA_REGISTRAR') await original.call(this, args);
                return id;
            });
            try { await request('POST', '/compras', nuevaCompra('sintetica_rollback'), 1, 503); }
            finally { mock.mock.restore(); }
            assert.deepEqual([await db.Compra.count(), await db.DetalleCompra.count(), await db.MovimientoInventario.count(), await count()], antes);
            assert.equal((await db.ExistenciaMedicamento.findByPk(idExistencia)).cantidad_fisica, saldo);
        });
        await t.test('Anulación concurrente bajo bloqueos reales: un éxito y un rechazo, una reversión', async () => {
            const resultados = await Promise.all([1, 2].map(() =>
                request('POST', `/compras/${idCompra}/anular`, { motivo: 'Motivo sintético' }, 1, null)));
            assert.deepEqual(resultados.map(r => r.response.status).sort(), [200, 409]);
            assert.equal((await rows('COMPRA_ANULAR')).filter(e => e.resultado === 'EXITO').length, 1);
            assert.equal(await db.MovimientoInventario.count({ where: { motivo: 'ANULACION_COMPRA' } }), 1);
            assert.equal((await db.ExistenciaMedicamento.findByPk(idExistencia)).cantidad_fisica, 0);
        });
        await t.test('Ajustes concurrentes con las mismas precondiciones: un éxito y un rechazo, sin stock perdido', async () => {
            const ultimo = await db.MovimientoInventario.max('id_movimiento', { where: { id_existencia: idExistencia } });
            const datos = { idExistencia, stockObservado: 0, ultimoMovimientoObservado: ultimo, saldoContado: 5, costoUnitario: '2', observacion: 'Conteo sintético' };
            const token = generarToken({ idUsuario: usuarios[1].id_usuario, idRol: 2, versionCredenciales: 0 });
            const results = await Promise.all([1, 2].map(async () => {
                const r = await fetch(`http://127.0.0.1:${server.address().port}/api/inventario/ajustes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` }, body: JSON.stringify(datos), signal: AbortSignal.timeout(30000) });
                await r.json(); return r.status;
            }));
            assert.deepEqual(results.sort(), [201, 409]); assert.equal((await db.ExistenciaMedicamento.findByPk(idExistencia)).cantidad_fisica, 5);
            assert.equal((await rows('INVENTARIO_AJUSTAR')).filter(e => e.resultado === 'EXITO').length, 1);
        });
        await t.test('Identidad histórica sigue consultable tras cambiar nombre/rol del responsable', async () => {
            await db.Usuario.update({ nombre_usuario: 'nombre_nuevo_sintetico', id_rol: 2 }, { where: { id_usuario: responsable.idUsuario } });
            const e = await repo.findById({ idEvento: idTemporal });
            assert.equal(e.nombre_usuario_responsable, responsable.nombreUsuario); assert.equal(e.id_rol_responsable, 1);
        });
        await t.test('Hooks append-only y down no destructivo preservan todos los eventos', async () => {
            const antes = await count();
            await assert.rejects(db.BitacoraAuditoria.update({ accion: 'OTRA' }, { where: { id_evento: idTemporal } }), /no admiten modificación/);
            const { default: migracion } = await import('../src/data/database/migrations/20261013120000-create-bitacora-auditoria.js');
            await assert.rejects(migracion.down(), /60 meses/); assert.equal(await count(), antes);
        });
        const grants = await select('SHOW GRANTS');
        const amplios = grants.some(r => /ALL PRIVILEGES|\bUPDATE\b|\bDELETE\b|\bDROP\b/i.test(Object.values(r).join(' ')));
        t.diagnostic(`Privilegios de cuenta local permiten modificación/DDL: ${amplios ? 'sí; separación de cuentas pendiente' : 'revisar privilegios efectivos y roles antes de producción'}`);
        assert.equal(JSON.stringify(logs).includes(hash), false);
        t.diagnostic('Base conservada con datos sintéticos; no se probó restauración de backup ni rendimiento representativo ni IP original Railway.');
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (db) await db.sequelize.close();
    }
});
