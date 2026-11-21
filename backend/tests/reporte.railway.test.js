import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import { PassThrough } from 'node:stream';
import { crearEntornoRailway, memoriaContenedor, entornoExportacionRailway } from '../src/shared/utils/reporte-railway.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'railway_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_railway_tests';
const { default: db } = await import('../src/data/models/index.js');
const { antesSelectReporte, conPlazoSqlReporte } = await import('../src/data/repositories/reporte-plazo-sql.js');
const { reporteExportacionService: servicio } = await import('../src/business/services/reporte.exportacion.service.js');
const { reporteExtraccionRepository: extraccion } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { reporteRepository } = await import('../src/data/repositories/reporte.repository.js');
const { reporteValidator } = await import('../src/business/validators/reporte.validator.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { app } = await import('../src/app.js');
const { iniciarServidor } = await import('../src/server.js');
const { reporteExportacionController } = await import('../src/presentation/controllers/reporte-exportacion.controller.js');
const MiB = 1024n * 1024n;
test.beforeEach(t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('Conexiones MySQL prohibidas'));
});

function entorno(opciones = {}) {
    const env = { NODE_ENV: 'production', REPORTES_EXPORTACION_PERFIL: 'RAILWAY', REPORTES_EXPORTACION_REPLICAS: '1',
        RAILWAY_SERVICE_ID: 'servicio-sintetico', RAILWAY_DEPLOYMENT_ID: 'deploy-sintetico', RAILWAY_ENVIRONMENT_ID: 'entorno-sintetico', ...opciones.env };
    const estado = { rss: 100 * 1024 * 1024, libre: 1024n * MiB, actual: 128n * MiB, max: 1024n * MiB, creados: [], borrados: [], diagnosticos: [], modo: 0o700 };
    const archivos = {
        realpath: async p => p,
        statfs: async () => ({ bavail: estado.libre, bsize: 1n }),
        mkdir: async (p, opts) => { assert.equal(opts.mode, 0o700); estado.creados.push(p); if (opciones.existe) throw Object.assign(new Error(), { code: 'EEXIST' }); },
        lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false, mode: estado.modo, uid: 7, dev: 1, ino: 2 }),
        rmdir: async p => { if (opciones.residuo) throw Object.assign(new Error(), { code: 'ENOTEMPTY' }); estado.borrados.push(p); }
    };
    const proceso = { env, platform: opciones.platform || 'linux', getuid: () => 7, memoryUsage: () => ({ rss: estado.rss }) };
    const manager = crearEntornoRailway({ archivos, sistema: { tmpdir: () => '/tmp' }, proceso,
        memoria: async () => opciones.sinCgroup ? null : { max: estado.max, actual: estado.actual },
        diagnosticar: opciones.diagnosticar || (evento => estado.diagnosticos.push(evento)) });
    return { manager, estado, archivos, proceso };
}

test('RAILWAY opt-in estricto: exige production, metadatos, Linux y una réplica; sin recursos al deshabilitar', async () => {
    for (const opciones of [{ env: { REPORTES_EXPORTACION_PERFIL: undefined } }, { env: { NODE_ENV: 'development' } },
        { env: { NODE_ENV: 'test' } }, { env: { RAILWAY_SERVICE_ID: undefined } },
        { env: { REPORTES_EXPORTACION_REPLICAS: '2' } }, { platform: 'win32' }]) {
        const { manager, estado } = entorno(opciones);
        assert.equal(await manager.disponibilidad(), false); assert.deepEqual(estado.creados, []);
        await manager.cerrar();
    }
});

test('Diagnósticos de configuración: códigos/campo estáticos, sin valores de entorno ni repetición', async () => {
    const casos = [
        [{ NODE_ENV: 'sintetico-no-publicar' }, 'NODE_ENV_INVALIDO'],
        [{ REPORTES_EXPORTACION_PERFIL: 'sintetico-no-publicar' }, 'PERFIL_NO_ACTIVO'],
        [{ REPORTES_EXPORTACION_REPLICAS: 'sintetico-no-publicar' }, 'REPLICAS_NO_ACREDITADAS'],
        ...['RAILWAY_SERVICE_ID', 'RAILWAY_DEPLOYMENT_ID', 'RAILWAY_ENVIRONMENT_ID'].map(campo => [{ [campo]: 'sintetico-no-publicar\nvalor' }, 'METADATO_RAILWAY_INVALIDO', campo])
    ];
    for (const [env, causa, campo] of casos) {
        const { manager, estado } = entorno({ env });
        assert.equal(await manager.disponibilidad(), false); assert.equal(await manager.disponibilidad(), false);
        assert.deepEqual(estado.diagnosticos, [{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa, etapa: 'CONFIGURACION', ...(campo ? { campo } : {}) }]);
        assert.ok(!JSON.stringify(estado.diagnosticos).includes('sintetico-no-publicar'));
        assert.deepEqual(estado.creados, []);
    }
    const { manager, estado } = entorno({ platform: 'win32' });
    assert.equal(await manager.disponibilidad(), false);
    assert.equal(estado.diagnosticos[0].causa, 'PLATAFORMA_NO_ADMITIDA');
});

test('Diagnósticos de recursos, temporal existente y permisos, sin debilitar rechazo ni reclamar carpetas', async () => {
    for (const causa of ['CGROUP_NO_ACREDITADO', 'MEMORIA_INSUFICIENTE', 'DISCO_INSUFICIENTE', 'TEMPORAL_EXISTENTE', 'TEMPORAL_NO_PRIVADO']) {
        const { manager, estado } = entorno({ sinCgroup: causa === 'CGROUP_NO_ACREDITADO', existe: causa === 'TEMPORAL_EXISTENTE' });
        if (causa === 'MEMORIA_INSUFICIENTE') estado.actual = estado.max - 1n;
        if (causa === 'DISCO_INSUFICIENTE') estado.libre = 0n;
        if (causa === 'TEMPORAL_NO_PRIVADO') estado.modo = 0o755;
        assert.equal(await manager.disponibilidad(), false);
        assert.deepEqual(estado.diagnosticos, [{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa, etapa: 'INICIALIZACION' }]);
        assert.deepEqual(estado.borrados, []);
        await manager.disponibilidad(); assert.equal(estado.diagnosticos.length, 1);
    }
});

test('Errores opacos de filesystem: solo etapa/causa, nunca message/code/stack/path/env crudos', async () => {
    for (const [operacion, causa] of [['realpath', 'TEMPORAL_RESOLUCION_FALLIDA'], ['statfs', 'DISCO_NO_CONSULTABLE'], ['mkdir', 'TEMPORAL_CREACION_FALLIDA'], ['lstat', 'TEMPORAL_NO_CONSULTABLE']]) {
        const { manager, archivos, estado } = entorno();
        archivos[operacion] = async () => { throw Object.assign(new Error('sintetico-no-publicar\nSQL /privado/archivo'), { code: 'sintetico-no-publicar', path: '/privado/archivo' }); };
        assert.equal(await manager.disponibilidad(), false);
        assert.deepEqual(estado.diagnosticos, [{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa, etapa: 'INICIALIZACION' }]);
    }
    const { manager, estado } = entorno();
    assert.equal((await manager.disponibilidad()).perfil, 'RAILWAY'); assert.deepEqual(estado.diagnosticos, []);
    await manager.cerrar();
});

test('Diagnósticos del sondeo/cierre, acotados; logger que falla no cambia decisiones de seguridad', async t => {
    let sondear;
    t.mock.method(globalThis, 'setInterval', cb => { sondear = cb; return { unref() {} }; });
    t.mock.method(globalThis, 'clearInterval', () => {});
    const { manager, estado } = entorno({ residuo: true }); await manager.disponibilidad();
    let abortos = 0; const vigilancia = manager.vigilar(() => abortos++);
    estado.rss += 128 * 1024 * 1024 + 1;
    await sondear(); await sondear();
    assert.equal(abortos, 2);
    assert.deepEqual(estado.diagnosticos, [{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa: 'INCREMENTO_RSS_EXCEDIDO', etapa: 'VIGILANCIA' }]);
    vigilancia.liberar(); await assert.rejects(manager.cerrar());
    assert.equal(estado.diagnosticos.at(-1).causa, 'TEMPORAL_CON_RESIDUOS');
    const roto = entorno({ sinCgroup: true, diagnosticar: () => { throw new Error('logger sintético no disponible'); } });
    assert.equal(await roto.manager.disponibilidad(), false); assert.deepEqual(roto.estado.creados, []);
});

test('Diagnósticos después de admitir: identifica cambio de raíz, disco no consultable y servidor cerrando', async () => {
    for (const causa of ['TEMPORAL_IDENTIDAD_CAMBIADA', 'TEMPORAL_NO_PRIVADO', 'TEMPORAL_NO_CONSULTABLE', 'DISCO_NO_CONSULTABLE']) {
        const { manager, archivos, estado } = entorno(); await manager.disponibilidad();
        const original = archivos.lstat;
        if (causa === 'TEMPORAL_IDENTIDAD_CAMBIADA') archivos.lstat = async () => ({ ...await original(), ino: 99 });
        if (causa === 'TEMPORAL_NO_PRIVADO') estado.modo = 0o755;
        if (causa === 'TEMPORAL_NO_CONSULTABLE') archivos.lstat = async () => { throw new Error('ruta sintética privada'); };
        if (causa === 'DISCO_NO_CONSULTABLE') archivos.statfs = async () => { throw new Error('ruta sintética privada'); };
        assert.equal(await manager.disponibilidad(), false);
        assert.deepEqual(estado.diagnosticos, [{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa, etapa: 'DISPONIBILIDAD' }]);
    }
    const { manager, estado } = entorno(); await manager.disponibilidad(); await manager.cerrar();
    assert.equal(await manager.disponibilidad(), false);
    assert.deepEqual(estado.diagnosticos, [{ codigo: 'EXPORTACION_RAILWAY_NO_DISPONIBLE', causa: 'SERVIDOR_CERRANDO', etapa: 'INICIALIZACION' }]);
});

test('cgroup v2/v1: interpreta límite y consumo del contenedor, sin fallback a RAM del host', async () => {
    const leer = valores => ({ readFile: async p => { if (!(p in valores)) throw new Error('No disponible'); return valores[p]; } });
    assert.deepEqual(await memoriaContenedor(leer({ '/sys/fs/cgroup/memory.max': '8388608\n', '/sys/fs/cgroup/memory.current': '100\n' })), { max: 8388608n, actual: 100n });
    assert.deepEqual(await memoriaContenedor(leer({ '/sys/fs/cgroup/memory.max': 'max',
        '/sys/fs/cgroup/memory/memory.limit_in_bytes': '8388608', '/sys/fs/cgroup/memory/memory.usage_in_bytes': '200' })), { max: 8388608n, actual: 200n });
    for (const max of ['max', '-1', '9223372036854771712', '0']) assert.equal(await memoriaContenedor(leer({ '/sys/fs/cgroup/memory.max': max, '/sys/fs/cgroup/memory.current': '1' })), null);
    assert.equal(await memoriaContenedor(leer({})), null);
});

test('Admisión: 512 MiB de cuota + margen de disco, 128 MiB de RAM libre y raíz exclusiva privada', async () => {
    for (const motivo of ['cgroup', 'memoria', 'disco', 'modo', 'residuo']) {
        const { manager, estado } = entorno({ sinCgroup: motivo === 'cgroup', existe: motivo === 'residuo' });
        if (motivo === 'memoria') estado.actual = estado.max - 128n * MiB + 1n;
        if (motivo === 'disco') estado.libre = 640n * MiB - 1n;
        if (motivo === 'modo') estado.modo = 0o755;
        assert.equal(await manager.disponibilidad(), false);
        assert.deepEqual(estado.borrados, [], 'No borrar/chmod de raíces anteriores o no acreditadas');
    }
    const { manager, estado } = entorno();
    const perfil = await manager.disponibilidad();
    assert.equal(perfil.perfil, 'RAILWAY'); assert.match(perfil.raizPrivada, /cadefar-reportes-railway-[a-f0-9]{24}$/);
    assert.deepEqual(await manager.disponibilidad(), perfil); assert.equal(estado.creados.length, 1);
    await manager.cerrar(); assert.deepEqual(estado.borrados, [perfil.raizPrivada]);
    assert.equal(await manager.disponibilidad(), false);
});

test('Vigilancia: incremento RSS, presión cgroup/disco, aborto y liberación del temporizador', async t => {
    let sondear, cancelado = false, abortos = 0;
    t.mock.method(globalThis, 'setInterval', callback => { sondear = callback; return { unref() {} }; });
    t.mock.method(globalThis, 'clearInterval', () => { cancelado = true; });
    const { manager, estado } = entorno(); await manager.disponibilidad();
    const trabajo = manager.vigilar(() => abortos++);
    estado.rss += 128 * 1024 * 1024 + 1;
    assert.throws(trabajo.comprobar, /Recursos/); await sondear(); assert.equal(abortos, 1);
    estado.rss = 100 * 1024 * 1024; estado.libre = 128n * MiB - 1n;
    await sondear(); assert.equal(abortos, 2);
    estado.libre = 1024n * MiB; estado.actual = estado.max - 1n;
    await sondear(); assert.equal(abortos, 3);
    trabajo.liberar(); assert.equal(cancelado, true); await sondear(); assert.equal(abortos, 3);
    await manager.cerrar();
});

test('Raíz con residuos: no limpieza recursiva, no reclamación de trabajo de otro proceso', async () => {
    const { manager, estado } = entorno({ residuo: true }); await manager.disponibilidad();
    await assert.rejects(manager.cerrar(), /./); assert.deepEqual(estado.borrados, []);
    assert.equal(await manager.disponibilidad(), false);
});

test('Propiedad del temporal y presión transitoria: rechaza symlink/otro UID/cambio de inode, permite reintento sin recursos', async () => {
    for (const cambio of ['symlink', 'uid', 'inode']) {
        const { manager, archivos } = entorno(); await manager.disponibilidad();
        const original = archivos.lstat;
        archivos.lstat = async () => ({ ...await original(), ...(cambio === 'symlink' ? { isSymbolicLink: () => true } : cambio === 'uid' ? { uid: 8 } : { ino: 3 }) });
        assert.equal(await manager.disponibilidad(), false);
        await assert.rejects(manager.cerrar(), /Propiedad/);
    }
    const { manager, estado } = entorno(); estado.libre = 0n;
    assert.equal(await manager.disponibilidad(), false); assert.equal(estado.creados.length, 0);
    estado.libre = 1024n * MiB;
    assert.equal((await manager.disponibilidad()).perfil, 'RAILWAY'); await manager.cerrar();
});

test('SQL acotado por SELECT en misma transacción, presupuesto restante y restauración antes de liberar', async t => {
    const sql = [], tx = {}; let restante = 59000;
    t.mock.method(db.sequelize, 'query', async (texto, opts) => {
        assert.equal(opts.transaction, tx); assert.equal(opts.retry.max, 0); sql.push(texto);
        return [{ motor: '8.0.46', ejecucion: 17, espera: 25 }];
    });
    await conPlazoSqlReporte(tx, () => restante, async () => {
        await antesSelectReporte(tx); restante = 1000; await antesSelectReporte(tx);
    });
    assert.match(sql[1], /max_execution_time = 59000, lock_wait_timeout = 59/);
    assert.match(sql[2], /max_execution_time = 1000, lock_wait_timeout = 1/);
    assert.equal(sql.at(-1), 'SET SESSION max_execution_time = 17, lock_wait_timeout = 25');
    const n = sql.length; await antesSelectReporte(tx); await antesSelectReporte({}); assert.equal(sql.length, n);
    await assert.rejects(conPlazoSqlReporte(tx, () => 0, () => antesSelectReporte(tx)), /agotado/);
    assert.equal(sql.at(-1), 'SET SESSION max_execution_time = 17, lock_wait_timeout = 25');
});

test('Todas las lecturas de extracción/estadística pasan por plazo; GET anterior sin sesión alterada', async t => {
    const tx = new class Snapshot {}, sql = [];
    t.mock.method(db.sequelize, 'query', async (texto, opts) => {
        assert.equal(opts.transaction, tx); sql.push(texto);
        return texto.startsWith('SELECT /*+') ? [{ motor: '8.0.46', ejecucion: 0, espera: 31536000 }] : [];
    });
    const f = reporteValidator.validateExportacionVentas({ dia: '2026-11-20', formato: 'CSV', presentacion: 'TABULAR' }).data;
    await conPlazoSqlReporte(tx, () => 50000, async () => {
        for (const fuente of ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS']) {
            await extraccion.resumen(fuente, fuente === 'MOVIMIENTOS' ? {} : f, { transaction: tx });
            await extraccion.bloque(fuente, fuente === 'MOVIMIENTOS' ? {} : f, { transaction: tx });
        }
        for (const fuente of ['Ventas', 'Compras', 'Perdidas']) await reporteRepository[`estadisticas${fuente}`]({ ...f, granularidad: 'DIA' }, { transaction: tx });
    });
    assert.equal(sql.filter(s => s.startsWith('SET SESSION max_execution_time = 50000')).length, 14);
    assert.equal(sql.filter(s => /^SELECT (?!\/\*)/.test(s)).length, 14);
});

test('SQL: rechazo de motor no acreditado y destrucción, no retorno al pool si falla restauración', async t => {
    let destruida = false, leyo = false;
    const tx = { forceCleanup: async () => { assert.equal(tx.finished, 'rollback'); destruida = true; } };
    t.mock.method(db.sequelize, 'query', async texto => {
        if (texto.startsWith('SELECT')) return [{ motor: '8.0.46', ejecucion: 0, espera: 30 }];
        throw new Error('Restauración sintética fallida');
    });
    await assert.rejects(conPlazoSqlReporte(tx, () => 1000, async () => { leyo = true; }), e => /restaurar/.test(e.message) && e.sesionExportacionInsegura === true);
    assert.ok(leyo && destruida); assert.equal(tx.finished, 'rollback');
    t.mock.method(db.sequelize, 'query', async () => [{ motor: '10.11-MariaDB', ejecucion: 0, espera: 30 }]);
    await assert.rejects(conPlazoSqlReporte({}, () => 1000, () => assert.fail('No debe leer')), /no acreditado/);
});

test('CORS conserva credenciales/origen y expone nombre/reintento sin permitir otro origen', async t => {
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    t.mock.method(console, 'error', () => {});
    try {
        const permitido = process.env.FRONTEND_URL || 'http://localhost:5173';
        for (const origin of [permitido, 'https://otro.invalid']) {
            const r = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/me`, { headers: { Origin: origin } });
            assert.equal(r.status, 401); assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
            assert.equal(r.headers.get('access-control-expose-headers'), 'Content-Disposition,Retry-After');
            assert.equal(r.headers.get('access-control-allow-origin'), permitido);
            if (origin.endsWith('otro.invalid')) assert.notEqual(r.headers.get('access-control-allow-origin'), origin);
        }
    } finally { await new Promise(r => server.close(r)); }
});

test('Cierre del servidor espera exportaciones/HTTP incluso si limpieza falla, antes de cerrar DB', async t => {
    const eventos = [], server = new EventEmitter(); server.address = () => ({ port: 0 });
    let finExportaciones, finHttp;
    server.close = callback => { eventos.push('http'); finHttp = callback; };
    t.mock.method(app, 'listen', () => { queueMicrotask(() => server.emit('listening')); return server; });
    t.mock.method(console, 'log', () => {});
    t.mock.method(servicio, 'cerrar', () => { eventos.push('exportaciones'); return new Promise((resolve, reject) => { finExportaciones = reject; }); });
    t.mock.method(db.sequelize, 'close', async () => eventos.push('db'));
    const ejecutando = await iniciarServidor(); const cerrando = ejecutando.cerrar();
    finExportaciones(new Error('Residuo sintético'));
    await Promise.resolve(); assert.deepEqual(eventos, ['exportaciones', 'http']);
    finHttp(); await assert.rejects(cerrando, /incompleto/); assert.equal(eventos.at(-1), 'db');
});

test('Pipeline Railway production: 21 variantes reutilizan generadores/SQL acotado, sin MySQL', { timeout: 30000 }, async t => {
    const raiz = await mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-railway-test-'));
    const anterior = process.env.NODE_ENV, perfil = process.env.REPORTES_EXPORTACION_PERFIL;
    process.env.NODE_ENV = 'production'; process.env.REPORTES_EXPORTACION_PERFIL = 'RAILWAY';
    let liberadas = 0, timeout = false; const events = [], sentencias = [];
    t.mock.method(entornoExportacionRailway, 'disponibilidad', async () => ({ perfil: 'RAILWAY', raizPrivada: raiz }));
    t.mock.method(entornoExportacionRailway, 'vigilar', () => ({ comprobar() {}, liberar() { liberadas++; } }));
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => cb(new class Snapshot {}));
    t.mock.method(db.sequelize, 'query', async texto => {
        sentencias.push(texto);
        if (texto.startsWith('SELECT /*+')) return [{ motor: '8.0.46', ejecucion: 0, espera: 30 }];
        if (timeout && /^SELECT /.test(texto)) throw { original: { errno: 3024 } };
        return [];
    });
    t.mock.method(auditor, 'intentarRegistrar', async event => events.push(event));
    const audit = { contexto: { correlacion: 'a'.repeat(32) }, responsable: { idUsuario: 1, idRol: 1, nombreUsuario: 'sintetico' } };
    try {
        for (const fuente of ['Ventas', 'Compras', 'Perdidas', 'Movimientos']) for (const presentacion of fuente === 'Movimientos' ? ['TABULAR'] : ['TABULAR', 'ESTADISTICA']) {
            for (const formato of ['CSV', 'XLSX', 'PDF']) {
                const query = { ...(fuente === 'Movimientos' ? {} : { dia: '2026-11-20' }), formato, presentacion,
                    ...(presentacion === 'ESTADISTICA' ? { granularidad: 'DIA', ...(formato === 'CSV' ? {} : { grafico: 'BARRAS', metrica: fuente === 'Perdidas' ? 'CANTIDAD_RETIROS' : 'CANTIDAD' }) } : {}) };
                const validada = reporteValidator[`validateExportacion${fuente}`](query); assert.equal(validada.success, true);
                const archivo = await servicio.preparar(fuente.toUpperCase(), validada.data, audit, { direccionRemota: '203.0.113.1' });
                try {
                    const bytes = await readFile(archivo.ruta); assert.equal(bytes.length, archivo.bytes); assert.ok(bytes.length > 0);
                    assert.equal(process.env.NODE_ENV, 'production');
                    archivo.iniciarEntrega(); await archivo.finalizar();
                } finally { await archivo.limpiar(); }
                assert.deepEqual(await readdir(raiz), []);
            }
        }
        assert.equal(events.length, 21); assert.equal(liberadas, 21);
        assert.ok(events.every(e => e.resultado === 'EXITO'));
        assert.equal(sentencias.filter(s => s === 'SET SESSION max_execution_time = 0, lock_wait_timeout = 30').length, 21);
        timeout = true;
        const f = reporteValidator.validateExportacionVentas({ dia: '2026-11-20', formato: 'CSV', presentacion: 'TABULAR' }).data;
        await assert.rejects(servicio.preparar('VENTAS', f, audit), e => e.statusCode === 503 && /agotó el tiempo/.test(e.message));
        assert.equal(events.at(-1).causa, 'TIEMPO_AGOTADO'); assert.equal(liberadas, 22);
        assert.deepEqual(await readdir(raiz), []);
    } finally {
        process.env.NODE_ENV = anterior;
        if (perfil === undefined) delete process.env.REPORTES_EXPORTACION_PERFIL; else process.env.REPORTES_EXPORTACION_PERFIL = perfil;
        await rm(raiz, { recursive: true });
    }
});

test('Gate Railway cerrado sin configuración; cierre aborta trabajo y espera terminal/cleanup', { timeout: 10000 }, async t => {
    t.mock.method(entornoExportacionRailway, 'cerrar', async () => {});
    const anterior = process.env.REPORTES_EXPORTACION_PERFIL;
    process.env.REPORTES_EXPORTACION_PERFIL = 'RAILWAY';
    try { assert.equal(await servicio.comprobarDisponibilidad({ direccionRemota: '203.0.113.1' }), false); }
    finally { if (anterior === undefined) delete process.env.REPORTES_EXPORTACION_PERFIL; else process.env.REPORTES_EXPORTACION_PERFIL = anterior; }
    const raiz = await mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-cierre-test-'));
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => cb({}));
    t.mock.method(extraccion, 'resumen', async () => []); t.mock.method(extraccion, 'bloque', async () => []);
    const events = []; t.mock.method(auditor, 'intentarRegistrar', async event => events.push(event));
    const query = { dia: '2026-11-20', formato: 'CSV', presentacion: 'TABULAR' };
    const f = reporteValidator.validateExportacionVentas(query).data;
    const audit = { contexto: { correlacion: 'a'.repeat(32) }, responsable: { idUsuario: 1, idRol: 1 } };
    const res = new PassThrough({ highWaterMark: 1 });
    let headers;
    const listos = new Promise(resolve => { headers = resolve; });
    res.status = () => res; res.set = () => { headers(); return res; };
    try {
        const tarea = reporteExportacionController.ventas({ query, contextoAuditoria: audit.contexto, usuario: audit.responsable }, res,
            () => assert.fail('No respuesta JSON posterior al aborto de entrega'));
        await listos;
        assert.equal(res.writableFinished, false);
        let cerrado = false;
        const cerrar = servicio.cerrar().then(() => { cerrado = true; });
        await Promise.resolve(); assert.equal(cerrado, false);
        await assert.rejects(servicio.preparar('VENTAS', f, audit), e => e.statusCode === 503);
        await tarea; await cerrar;
        assert.equal(res.destroyed, true);
        assert.equal(cerrado, true); assert.equal(events.at(-1).causa, 'CANCELACION_CLIENTE');
        assert.deepEqual(await readdir(raiz), []);
    } finally { res.destroy(); await rm(raiz, { recursive: true }); }
});
