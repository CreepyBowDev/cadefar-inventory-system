import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm, stat, open, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import os from 'node:os';
import fs from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { get } from 'node:http';
import { PassThrough } from 'node:stream';
import { BOM_CSV, registroCsv, protegerCeldaCsv } from '../src/shared/utils/reporte-csv.js';
import { crearArchivosReporte, leerSpool, comprobarRecursosCsvLocal } from '../src/shared/utils/reporte-archivos.js';
import { crearConciliacion, COLUMNAS_REPORTE, proyectarFila } from '../src/business/services/reporte.plantillas.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'exportacion_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_exportacion_tests';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { reporteExportacionService: servicio, cancelacionExportacion, tiempoExportacionAgotado } = await import('../src/business/services/reporte.exportacion.service.js');
const { reporteExtraccionRepository: repo } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { reporteRepository } = await import('../src/data/repositories/reporte.repository.js');
const { reporteValidator: v } = await import('../src/business/validators/reporte.validator.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
const { prepararEventoAuditoria } = await import('../src/business/validators/auditoria.validator.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { reporteExportacionController } = await import('../src/presentation/controllers/reporte-exportacion.controller.js');
const auditoria = { contexto: { correlacion: 'a'.repeat(32), direccionIp: null, procedenciaIp: 'NO_DISPONIBLE' },
    responsable: { idUsuario: 1, idRol: 1, nombreUsuario: 'actor' } };
const query = { dia: '2026-11-20', formato: 'CSV', presentacion: 'TABULAR' };
const filtros = () => v.validateExportacionVentas(query).data;
const raizTemporal = () => mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir(), 'cadefar-test-exportacion-'));
const sinDB = t => t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido'));

// Lector independiente del serializador, máquina de estados sobre bytes UTF-8.
const parsear = bytes => {
    assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191]);
    const texto = bytes.subarray(3).toString('utf8'), filas = [];
    let fila = [], celda = '', dentro = false, cerrado = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (dentro) {
            if (c !== '"') celda += c;
            else if (texto[i + 1] === '"') { celda += '"'; i++; }
            else { dentro = false; cerrado = true; }
        } else if (c === '"' && !cerrado && celda === '') dentro = true;
        else if (c === ';' && cerrado) { fila.push(celda); celda = ''; cerrado = false; }
        else if (c === '\r' && texto[++i] === '\n' && cerrado) {
            fila.push(celda); filas.push(fila); fila = []; celda = ''; cerrado = false;
        } else assert.fail(`CSV mal formado en ${i}`);
    }
    assert.equal(dentro, false); assert.equal(fila.length, 0); assert.equal(celda, ''); assert.equal(cerrado, false);
    return filas;
};
const rawVenta = id => ({ id_venta: id, estado_operacion: 'CONFIRMADA', categoria: 'CONFIRMADA',
    fecha_referencia: '2026-11-20 12:00:00', fecha_registro: '1000-01-01 00:00:00', fecha_venta: '2026-11-20 12:00:00',
    fecha_anulacion: null, total: '0.01', _cursor_fecha: `2026-11-20 12:00:00.${String(id % 3).padStart(6, '0')}`, _cursor_id: String(id) });
const ordenar = filas => filas.sort((a, b) => a._cursor_fecha === b._cursor_fecha ? Number(b._cursor_id) - Number(a._cursor_id) : a._cursor_fecha < b._cursor_fecha ? 1 : -1);

test('CSV bytes/registros independientes: BOM, comillas, CRLF, nulos, Unicode y protección reversible', () => {
    const valores = ['DAÑO, Unicode 漢字 😀', 'a;b"c\r\nx\ny', null, '', '0', '12345678901234567890.12', '9007199254740993',
        '1000-01-01', '9999-12-31', '=1+1', '  @x', '-ABC', '+x', "'texto", " \u200b'original", '\tbenigno', '\rtexto', '\ntexto', '\u0000 \u2003=1'];
    const filas = parsear(Buffer.from(BOM_CSV + registroCsv(valores)));
    assert.deepEqual(filas, [valores.map(x => protegerCeldaCsv(x))]);
    assert.equal(filas[0][1], 'a;b"c\r\nx\ny');
    assert.deepEqual(filas[0].slice(9), ["'=1+1", "'  @x", "'-ABC", "'+x", "''texto", "' \u200b'original", "'\tbenigno", "'\rtexto", "'\ntexto", "'\u0000 \u2003=1"]);
    for (let i = 9; i < valores.length; i++) assert.equal(filas[0][i].slice(1), valores[i]);
});

test('Conciliación por categoría/RN91 exacta; CU40 plano sin observación ni valoración/saldo', () => {
    const grupos = [{ motivo: 'VENCIMIENTO', cantidad_retiros: '2', cantidad_retirada: '2', perdida: '0.02' }];
    const c = crearConciliacion('PERDIDAS', grupos);
    for (const id of [1, 2]) c.agregar(proyectarFila('PERDIDAS', { id_movimiento: id, cantidad: '1', costo_unitario_aplicado: '0.005000', motivo: 'VENCIMIENTO' }));
    c.comprobar();
    const incorrecto = crearConciliacion('PERDIDAS', [{ ...grupos[0], perdida: '0.01' }]);
    for (const id of [1, 2]) incorrecto.agregar(proyectarFila('PERDIDAS', { id_movimiento: id, cantidad: '1', costo_unitario_aplicado: '0.005000', motivo: 'VENCIMIENTO' }));
    assert.throws(() => incorrecto.comprobar(), /inconsistente/);
    const enorme = crearConciliacion('PERDIDAS', [{ motivo: 'DAÑO', cantidad_retiros: '1', cantidad_retirada: '9007199254740993', perdida: '9007199254740993.00' }]);
    enorme.agregar(proyectarFila('PERDIDAS', { motivo: 'DAÑO', cantidad: '9007199254740993', costo_unitario_aplicado: '1.000000' }));
    enorme.comprobar();
    const movimiento = proyectarFila('MOVIMIENTOS', { id_movimiento: 7, id_usuario: 5, cantidad: '9007199254740993', costo_unitario_aplicado: '0.005000', observacion: 'privado', estado: true });
    assert.deepEqual(Object.keys(movimiento), COLUMNAS_REPORTE.MOVIMIENTOS);
    assert.equal(movimiento.idUsuario, 5); assert.equal(movimiento.nombreUsuario, null);
    assert.equal(movimiento.idMovimientoOriginal, null); assert.equal(movimiento.idMovimientoReversion, null);
    assert.equal(movimiento.cantidad, '9007199254740993');
    const categorias = crearConciliacion('VENTAS', [{ categoria: 'CONFIRMADA', cantidad: '1', importe: '0.01' }]);
    categorias.agregar({ categoria: 'PENDIENTE', total: '0.01' });
    assert.throws(() => categorias.comprobar(), /inconsistente/);
});

test('Archivos locales: escritura serializada, hash/tamaño, límites, corrupción, fallo y cleanup', async () => {
    const raiz = await raizTemporal();
    try {
        const archivos = await crearArchivosReporte(raiz, () => {}, { disco: 50, final: 20 });
        const spool = await archivos.escritor('spool');
        await spool.escribir('{"x":1}\n'); await spool.cerrar();
        assert.equal(await archivos.verificar('spool'), 8);
        const leidas = []; for await (const fila of leerSpool(archivos.rutas.spool, () => {})) leidas.push(fila);
        assert.deepEqual(leidas, [{ x: 1 }]);
        if (process.platform !== 'win32') assert.equal((await stat(archivos.rutas.spool)).mode & 0o777, 0o600);
        const csv = await archivos.escritor('csv');
        await assert.rejects(csv.escribir('x'.repeat(21)), e => e.statusCode === 413);
        await csv.escribir('x'.repeat(20)); await csv.cerrar();
        assert.equal(await archivos.verificar('csv'), 20);
        await writeFile(archivos.rutas.csv, 'corrupcion');
        await assert.rejects(archivos.verificar('csv'), /inconsistente/);
        await archivos.limpiar(); assert.deepEqual(await readdir(raiz), []);
        const cuota = await crearArchivosReporte(raiz, () => {}, { disco: 10 });
        const a = await cuota.escritor('spool'); await a.escribir('12345678');
        const b = await cuota.escritor('csv'); await assert.rejects(b.escribir('123'), e => e.statusCode === 413);
        await cuota.limpiar();
        await assert.rejects(crearArchivosReporte(join(raiz, 'inexistente'), () => {}), /ENOENT/);
        const roto = await crearArchivosReporte(raiz, () => {});
        const w = await roto.escritor('spool'); await w.escribir('no json\n'); await w.cerrar();
        await assert.rejects(async () => { for await (const f of leerSpool(roto.rutas.spool, () => {})) void f; });
        await roto.limpiar();
    } finally { await rm(raiz, { recursive: true }); }
});

test('Extracción simulada común: 2107 filas, tres bloques, empates/fracciones/cambio intercalado y CSV local completo', async t => {
    sinDB(t);
    const raiz = await raizTemporal(), eventos = [], lotes = [];
    let activo = false, originales = ordenar(Array.from({ length: 2107 }, (_, i) => rawVenta(i + 1)));
    const esperados = originales.map(f => String(f.id_venta));
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        assert.equal(opts.isolationLevel, 'REPEATABLE READ'); activo = true;
        try { return await callback({ snapshot: structuredClone(originales) }); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async (fuente, f, { transaction }) => {
        assert.ok(activo); return [{ categoria: 'CONFIRMADA', cantidad: String(transaction.snapshot.length), importe: '21.07' }];
    });
    t.mock.method(repo, 'bloque', async (fuente, f, opts) => {
        assert.ok(activo); assert.equal(opts.limite, 1000); lotes.push(opts);
        // La conexión alternativa cambia el estado/fecha y añade filas, NO el snapshot.
        originales = [rawVenta(9999)];
        return opts.transaction.snapshot.filter(row => !opts.cursor || row._cursor_fecha < opts.cursor.fecha ||
            (row._cursor_fecha === opts.cursor.fecha && BigInt(row._cursor_id) < BigInt(opts.cursor.id))).slice(0, opts.limite);
    });
    t.mock.method(auditor, 'intentarRegistrar', async e => { assert.equal(activo, false); eventos.push(prepararEventoAuditoria(e)); });
    try {
        const base = process.memoryUsage().rss;
        const archivo = await servicio.preparar('VENTAS', filtros(), auditoria);
        assert.equal(activo, false); assert.equal(eventos.length, 0);
        assert.equal(lotes.length, 4); assert.ok(lotes.every(l => l.transaction === lotes[0].transaction));
        assert.match(lotes[1].cursor.fecha, /\.00000[0-2]$/);
        const bytes = await readFile(archivo.ruta), csv = parsear(bytes);
        assert.equal(archivo.bytes, bytes.length); assert.equal(archivo.cantidadFilas, 2107);
        assert.deepEqual(csv[0], COLUMNAS_REPORTE.VENTAS);
        assert.deepEqual(csv.slice(1).map(r => r[0]), esperados); assert.equal(new Set(csv.slice(1).map(r => r[0])).size, 2107);
        assert.equal(csv[1][4], '1000-01-01 00:00:00'); assert.equal(csv[1][6], '');
        assert.match(archivo.nombre, /^cadefar-ventas-tabular-\d{8}-\d{6}-a{32}\.csv$/);
        assert.ok(process.memoryUsage().rss - base < 128 * 1024 * 1024, 'Solo fixture local acotado, no benchmark máximo');
        await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), e => e.statusCode === 503 && /ocupada/.test(e.message));
        assert.equal(eventos.at(-1).causa, 'RECURSO_NO_DISPONIBLE');
        archivo.iniciarEntrega(); await archivo.finalizar(); await archivo.finalizar(new Error('tardio')); await archivo.limpiar();
        assert.equal(eventos.filter(e => e.resultado === 'EXITO').length, 1);
        assert.deepEqual(eventos.at(-1).metadatos, { formato: 'CSV', presentacion: 'TABULAR', cantidadFilas: '2107', etapaExportacion: 'ENTREGA', estadoEntrega: 'FINALIZADA_SERVIDOR' });
        assert.deepEqual(await readdir(raiz), []);
    } finally { await rm(raiz, { recursive: true }); }
});

test('Fallos de extracción/conciliación/cursor/cierre, límite y cancelación pendiente no liberan SQL antes de resolver', async t => {
    sinDB(t); t.mock.method(console, 'error', () => {});
    const raiz = await raizTemporal(), eventos = [];
    let fallo = '', consultas = 0, activo = false, resolver, enConsulta;
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        activo = true;
        try { const result = await callback({}); if (fallo === 'cierre') throw new Error('COMMIT privado'); return result; }
        finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async () => [{ categoria: 'CONFIRMADA', cantidad: fallo === 'enorme' ? '9007199254740993'
        : fallo === 'limite' ? '1000001' : '1', importe: fallo === 'conciliacion' ? '99.00' : '0.01' }]);
    t.mock.method(repo, 'bloque', async () => {
        consultas++;
        if (fallo === 'lectura') throw new Error('SQL privado');
        if (fallo === 'pendiente') { enConsulta(); await new Promise(resolve => { resolver = resolve; }); }
        if (consultas > 1 && fallo !== 'cursor') return [];
        return [rawVenta(1)];
    });
    t.mock.method(auditor, 'intentarRegistrar', async e => { assert.equal(activo, false); eventos.push(e); });
    try {
        for (fallo of ['lectura', 'conciliacion', 'cursor', 'cierre', 'limite', 'enorme']) {
            consultas = 0; const antes = eventos.length;
            await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria));
            assert.equal(eventos.length, antes + 1); assert.notEqual(eventos.at(-1).resultado, 'EXITO');
            assert.equal(eventos.at(-1).causa, ['limite', 'enorme'].includes(fallo) ? 'LIMITE_EXPORTACION' : 'ERROR_INTERNO');
            assert.deepEqual(await readdir(raiz), []);
        }
        for (const razon of [cancelacionExportacion(), tiempoExportacionAgotado()]) {
            fallo = 'pendiente'; consultas = 0;
            const inicioConsulta = new Promise(resolve => { enConsulta = resolve; });
            const abortar = new AbortController();
            const p = servicio.preparar('VENTAS', filtros(), auditoria, { signal: abortar.signal });
            await inicioConsulta; abortar.abort(razon);
            assert.equal(activo, true);
            await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /ocupada/);
            resolver(); await assert.rejects(p);
            assert.equal(activo, false); assert.equal(eventos.at(-1).causa, razon.message.includes('tiempo') ? 'TIEMPO_AGOTADO' : 'CANCELACION_CLIENTE');
            assert.deepEqual(await readdir(raiz), []);
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('SQL generado real sin conexión: keyset original con %f, sin OFFSET/locks, referencias transaction-aware', async t => {
    sinDB(t); const sql = [];
    t.mock.method(db.sequelize, 'query', async (texto, options) => { sql.push({ texto, options }); return []; });
    for (const fuente of ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS']) {
        const f = fuente === 'MOVIMIENTOS' ? { idMedicamento: 4, motivo: "x' OR 1=1" } : filtros();
        const transaction = { id: 'snapshot_simulado' };
        await repo.resumen(fuente, f, { transaction });
        const agregado = sql.at(-1).texto;
        assert.doesNotMatch(agregado, /OFFSET|FOR UPDATE|DISTINCT/i);
        if (fuente === 'PERDIDAS') assert.match(agregado, /SUM\(ROUND\(/);
        await repo.bloque(fuente, f, { transaction, cursor: { fecha: fuente === 'COMPRAS' ? '9999-12-31' : '9999-12-31 23:59:59.999999', id: '77' } });
        const result = sql.at(-1);
        assert.deepEqual(result.options.transaction, transaction); assert.doesNotMatch(result.texto, /OFFSET|FOR UPDATE|observacion|password|estado`/i);
        assert.match(result.texto, /LIMIT 1000/); assert.match(result.texto, /< '77'/);
        assert.match(result.texto, /ORDER BY .* DESC, .* DESC/s);
        if (fuente !== 'COMPRAS') { assert.match(result.texto, /%H:%i:%s\.%f/); assert.match(result.texto, /23:59:59\.999999/); }
        if (fuente === 'VENTAS') assert.match(result.texto, /CASE WHEN estado_operacion/);
        if (fuente === 'MOVIMIENTOS') { assert.match(result.texto, /INNER JOIN/); assert.match(result.texto, /id_medicamento` = 4/); }
    }
    await assert.rejects(repo.bloque('VENTAS', filtros(), { transaction: {}, limite: 1001 }));
    await assert.rejects(repo.bloque('VENTAS', filtros(), { transaction: {}, cursor: { fecha: new Date(), id: '1' } }));
});

test('CSV estadístico completo: dos intervalos, todas las series/categorías, grandes exactos y conciliación previa', async t => {
    sinDB(t); const raiz = await raizTemporal();
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => callback({ snapshot: true }));
    t.mock.method(auditor, 'intentarRegistrar', async () => {});
    t.mock.method(repo, 'bloque', () => assert.fail('Estadística no extrae detalle'));
    const fixtures = {
        Ventas: { grupos: [{ categoria: 'CONFIRMADA', cantidad: '2', importe: '12345678901234567890.14' }],
            temporales: [{ categoria: 'CONFIRMADA', etiqueta: '9999-12-30', cantidad: '1', importe: '12345678901234567890.12' },
                { categoria: 'CONFIRMADA', etiqueta: '9999-12-31', cantidad: '1', importe: '0.02' }] },
        Compras: { grupos: [{ estado_operacion: 'ANULADA', cantidad: '2', importe: '0.02' }],
            temporales: [{ estado_operacion: 'ANULADA', etiqueta: '9999-12-30', cantidad: '1', importe: '0.01' },
                { estado_operacion: 'ANULADA', etiqueta: '9999-12-31', cantidad: '1', importe: '0.01' }] },
        Perdidas: { grupos: [{ motivo: 'DAÑO', cantidad_retiros: '2', cantidad_retirada: '9007199254740994', perdida: '0.02' }],
            temporales: [{ motivo: 'DAÑO', etiqueta: '9999-12-30', cantidad_retiros: '1', cantidad_retirada: '9007199254740993', perdida: '0.01' },
                { motivo: 'DAÑO', etiqueta: '9999-12-31', cantidad_retiros: '1', cantidad_retirada: '1', perdida: '0.01' }] }
    };
    try {
        for (const [nombre, datos] of Object.entries(fixtures)) {
            t.mock.method(reporteRepository, `estadisticas${nombre}`, async () => datos);
            const f = v[`validateExportacion${nombre}`]({ desde: '9999-12-30', hasta: '9999-12-31', formato: 'CSV', presentacion: 'ESTADISTICA', granularidad: 'DIA' }).data;
            const archivo = await servicio.preparar(nombre.toUpperCase(), f, auditoria);
            const csv = parsear(await readFile(archivo.ruta));
            assert.equal(csv.length, 1 + archivo.metadata.series.length * 2);
            assert.equal(csv.length - 1, archivo.cantidadFilas);
            let indice = 1;
            for (const [i, intervalo] of archivo.metadata.intervalos.entries()) {
                for (const serie of archivo.metadata.series) {
                    assert.deepEqual(csv[indice++], [intervalo.etiqueta, intervalo.desde, intervalo.hasta, String(intervalo.parcial),
                        serie.categoria, serie.metrica, serie.unidad, serie.valores[i]]);
                }
            }
            if (nombre === 'Ventas') assert.ok(csv.some(r => r[7] === '12345678901234567890.12'));
            if (nombre === 'Perdidas') assert.ok(csv.some(r => r[7] === '9007199254740993'));
            await archivo.finalizar(cancelacionExportacion()); await archivo.limpiar();
            datos.temporales = [];
            await assert.rejects(servicio.preparar(nombre.toUpperCase(), f, auditoria));
            assert.deepEqual(await readdir(raiz), []);
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Fallos reales locales de escritura inyectados en spool/CSV: rollback o snapshot ya cerrado, sin éxito ni archivos residuales', async t => {
    sinDB(t); const raiz = await raizTemporal(), eventos = [];
    let activo = false, numero = 0, fallarEn = 1;
    const probe = join(raiz, 'probe'), handle = await open(probe, 'wx'), proto = Object.getPrototypeOf(handle);
    await handle.close(); await rm(probe);
    const original = proto.writeFile;
    t.mock.method(proto, 'writeFile', async function (...args) {
        if (++numero === fallarEn) { const error = new Error('ENOSPC privado'); error.code = 'ENOSPC'; throw error; }
        return original.apply(this, args);
    });
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        activo = true; try { return await callback({}); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async () => [{ categoria: 'CONFIRMADA', cantidad: '1', importe: '0.01' }]);
    t.mock.method(repo, 'bloque', async (fuente, f, { cursor }) => cursor ? [] : [rawVenta(1)]);
    t.mock.method(auditor, 'intentarRegistrar', async e => { assert.equal(activo, false); eventos.push(e); });
    try {
        for (fallarEn of [1, 2, 3]) {
            numero = 0;
            await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /ENOSPC/);
            assert.equal(eventos.at(-1).resultado, 'FALLO'); assert.equal(eventos.at(-1).causa, 'ERROR_INTERNO');
            assert.equal(eventos.at(-1).metadatos.etapaExportacion, fallarEn === 1 ? 'EXTRACCION' : 'GENERACION');
            assert.deepEqual(await readdir(raiz), []);
        }
        assert.equal(eventos.length, 3);
    } finally { await rm(raiz, { recursive: true }); }
});

test('Reloj simulado: presupuestos 60s snapshot y 120s generación, nunca devolver éxito tardío', async t => {
    sinDB(t); const raiz = await raizTemporal(), eventos = [];
    let ahora = 0, fase = 'EXTRACCION';
    t.mock.method(performance, 'now', () => ahora);
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    t.mock.method(repo, 'resumen', async () => { if (fase === 'EXTRACCION') ahora = 60001; return []; });
    t.mock.method(repo, 'bloque', async () => []);
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        const resultado = await callback({}); if (fase === 'GENERACION') ahora = 120001; return resultado;
    });
    try {
        await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /agotó el tiempo/);
        fase = 'GENERACION'; ahora = 0;
        await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /agotó el tiempo/);
        assert.equal(eventos.length, 2); assert.ok(eventos.every(e => e.causa === 'TIEMPO_AGOTADO' && e.resultado === 'FALLO'));
        assert.deepEqual(await readdir(raiz), []);
    } finally { await rm(raiz, { recursive: true }); }
});

test('Adaptador HTTP con transporte bloqueado: backpressure y timer de entrega independiente, FALLO único y cleanup', async t => {
    sinDB(t); const raiz = await raizTemporal(), eventos = [], timers = [];
    t.mock.method(globalThis, 'setTimeout', (callback, ms) => { const timer = { callback, ms, cancelado: false }; timers.push(timer); return timer; });
    t.mock.method(globalThis, 'clearTimeout', timer => { if (timer) timer.cancelado = true; });
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => callback({}));
    t.mock.method(repo, 'resumen', async () => [{ categoria: 'CONFIRMADA', cantidad: '1', importe: '0.01' }]);
    t.mock.method(repo, 'bloque', async (fuente, f, { cursor }) => cursor ? [] : [rawVenta(1)]);
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    const res = new PassThrough({ highWaterMark: 1 });
    let avisarHeaders;
    const headers = new Promise(resolve => { avisarHeaders = resolve; });
    res.status = () => res;
    res.set = valor => { assert.ok(valor['Content-Length']); avisarHeaders(); return res; };
    try {
        const tarea = reporteExportacionController.ventas({ query, contextoAuditoria: auditoria.contexto, usuario: auditoria.responsable }, res,
            () => assert.fail('No segundo JSON/next tras destruir transporte'));
        await headers;
        assert.equal(timers.length, 2); assert.ok(timers.every(timer => timer.ms === 120000));
        assert.equal(timers[0].cancelado, true); assert.equal(timers[1].cancelado, false);
        assert.equal(eventos.length, 0); assert.equal(res.writableFinished, false);
        timers[1].callback(); await tarea;
        assert.equal(eventos.length, 1); assert.equal(eventos[0].causa, 'TIEMPO_AGOTADO');
        assert.equal(eventos[0].metadatos.etapaExportacion, 'ENTREGA'); assert.equal(eventos[0].metadatos.estadoEntrega, 'FALLIDA');
        assert.equal(res.destroyed, true); assert.deepEqual(await readdir(raiz), []);
    } finally { res.destroy(); await rm(raiz, { recursive: true }); }
});

test('HTTP montado: sesión/roles/query/HEAD y gate real cerrado; cuatro eventos terminales allowlisted', async t => {
    sinDB(t); t.mock.method(console, 'error', () => {});
    const eventos = [];
    t.mock.method(authService, 'getSessionUsuario', async id => ({ idUsuario: id, idRol: id, nombreUsuario: `actor${id}` }));
    t.mock.method(db.sequelize, 'transaction', async callback => callback({ auditor: true }));
    t.mock.method(bitacoraAuditoriaRepository, 'create', async ({ data }) => { eventos.push(data); return eventos.length; });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const request = async (ruta, q, status, rol = 1, method = 'GET') => {
        const token = rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null;
        const r = await fetch(`http://127.0.0.1:${server.address().port}/api/${ruta}?${q}`, { method,
            headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000) });
        const body = method === 'HEAD' ? null : await r.json(); assert.equal(r.status, status, JSON.stringify(body));
        assert.doesNotMatch(JSON.stringify(body), /SQL|stack|password|\.csv|ndjson/); return { r, body };
    };
    try {
        assert.equal(await servicio.comprobarDisponibilidad(), false);
        for (const [ruta, fuente, regente] of [['reportes/ventas/exportar', 'VENTAS', false], ['reportes/compras/exportar', 'COMPRAS', false],
            ['reportes/perdidas/exportar', 'PERDIDAS', true], ['inventario/movimientos/exportar', 'MOVIMIENTOS', true]]) {
            const q = `${fuente === 'MOVIMIENTOS' ? '' : 'dia=2026-11-20&'}formato=CSV&presentacion=TABULAR`;
            await request(ruta, q, 401, null); await request(ruta, q, 403, 3);
            if (!regente) await request(ruta, q, 403, 2);
            const antes = eventos.length;
            const head = await request(ruta, q, 405, 1, 'HEAD'); assert.equal(head.r.headers.get('allow'), 'GET'); assert.equal(eventos.length, antes);
            for (const extra of ['&pagina=1', '&limite=25', '&foo=x', '&formato=CSV', '&granularidad=DIA']) {
                const n = eventos.length; await request(ruta, q + extra, 400); assert.equal(eventos.length, n + 1);
                assert.equal(eventos.at(-1).tipo_evento, 'VALIDACION_RECHAZADA');
            }
            for (const formato of ['CSV', 'PDF', 'XLSX']) {
                const n = eventos.length;
                const { body } = await request(ruta, q.replace('CSV', formato), 503, regente ? 2 : 1);
                assert.equal(body.message, 'Formato no disponible'); assert.equal(eventos.length, n + 1);
                assert.equal(eventos.at(-1).tipo_evento, fuente === 'MOVIMIENTOS' ? 'INVENTARIO_MOVIMIENTOS_EXPORTAR' : `REPORTE_${fuente}_EXPORTAR`);
                assert.equal(eventos.at(-1).resultado, 'RECHAZADO'); assert.equal(eventos.at(-1).causa, 'RECURSO_NO_DISPONIBLE');
            }
        }
        const exceso = await request('reportes/ventas/exportar', 'desde=1000-01-01&hasta=9999-12-31&formato=CSV&presentacion=ESTADISTICA&granularidad=ANIO', 400);
        assert.match(exceso.body.message, /supera 1200/);
        const limpio = prepararEventoAuditoria({ ...auditoria, tipoEvento: 'REPORTE_VENTAS_EXPORTAR', resultado: 'EXITO',
            metadatos: { formato: 'CSV', presentacion: 'TABULAR', cantidadFilas: '1000000', total: '99.99', perdida: '99', filas: [1], ruta: 'privado', cantidadResultados: 100 } });
        assert.deepEqual(limpio.metadatos, { formato: 'CSV', presentacion: 'TABULAR', cantidadFilas: '1000000' });
        assert.throws(() => prepararEventoAuditoria({ ...auditoria, tipoEvento: 'REPORTE_VENTAS_EXPORTAR', resultado: 'EXITO', metadatos: { cantidadFilas: '1000001' } }));
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('HTTP CSV real local con checker sin reemplazar: cuatro fuentes/vacíos/series, finish único y cleanup', async t => {
    sinDB(t); t.mock.method(console, 'error', () => {});
    const raiz = await raizTemporal(), eventos = [];
    let filas = [], grupos = [], falloAuditor = false, activo = false, notificarAuditor, notificarLimpieza;
    const prepararOriginal = servicio.preparar;
    t.mock.method(servicio, 'preparar', async function (...args) {
        const archivo = await prepararOriginal.apply(this, args), limpiar = archivo.limpiar;
        archivo.limpiar = async () => { await limpiar(); notificarLimpieza(); };
        return archivo;
    });
    const entornoAnterior = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    t.after(() => { process.env.NODE_ENV = entornoAnterior; });
    t.mock.method(os, 'tmpdir', () => raiz);
    t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
    t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n, bsize: 1024n }));
    t.mock.method(authService, 'getSessionUsuario', async () => auditoria.responsable);
    t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
        if (typeof options === 'function') return options({ auditor: true });
        activo = true; try { return await callback({}); } finally { activo = false; }
    });
    t.mock.method(bitacoraAuditoriaRepository, 'create', async ({ data }) => {
        assert.equal(activo, false); eventos.push(data); notificarAuditor(); if (falloAuditor) throw new Error('SQL privado'); return eventos.length;
    });
    t.mock.method(repo, 'resumen', async () => grupos);
    t.mock.method(repo, 'bloque', async (fuente, f, opts) => opts.cursor ? [] : filas);
    for (const nombre of ['Ventas', 'Compras', 'Perdidas']) t.mock.method(reporteRepository, `estadisticas${nombre}`, async () => ({ grupos: [], temporales: [] }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const descargar = async (fuente, presentacion = 'TABULAR', q = '') => {
        const ruta = fuente === 'MOVIMIENTOS' ? 'inventario/movimientos' : `reportes/${fuente.toLowerCase()}`;
        const antes = eventos.length;
        const registro = new Promise(resolve => { notificarAuditor = resolve; });
        const limpieza = new Promise(resolve => { notificarLimpieza = resolve; });
        const r = await fetch(`http://127.0.0.1:${server.address().port}/api/${ruta}/exportar?${fuente === 'MOVIMIENTOS' ? '' : 'dia=9999-12-31&'}formato=CSV&presentacion=${presentacion}${presentacion === 'ESTADISTICA' ? '&granularidad=DIA' : ''}${q}`, {
            headers: { Cookie: `token=${generarToken({ idUsuario: 1, idRol: 1, versionCredenciales: 0 })}` }, signal: AbortSignal.timeout(10000) });
        assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /^text\/csv; charset=utf-8$/);
        assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.match(r.headers.get('content-disposition'), /^attachment; filename="cadefar-/);
        const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(Number(r.headers.get('content-length')), bytes.length);
        // El cliente puede terminar antes del cierre local del ReadStream: barrera del auditor.
        await registro;
        await limpieza;
        assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).resultado, 'EXITO');
        assert.equal(eventos.at(-1).metadatos.estadoEntrega, 'FINALIZADA_SERVIDOR');
        return parsear(bytes);
    };
    try {
        for (const fuente of ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS']) {
            grupos = fuente === 'MOVIMIENTOS' ? [{ cantidad: '0' }] : []; filas = [];
            assert.deepEqual(await descargar(fuente), [COLUMNAS_REPORTE[fuente]]);
            if (fuente !== 'MOVIMIENTOS') {
                const csv = await descargar(fuente, 'ESTADISTICA');
                assert.deepEqual(csv[0], COLUMNAS_REPORTE.ESTADISTICA);
                assert.equal(csv.length, { VENTAS: 9, COMPRAS: 5, PERDIDAS: 7 }[fuente]);
                assert.ok(csv.slice(1).every(r => r[0] === '9999-12-31' && ['0', '0.00'].includes(r[7])));
            }
        }
        filas = [{ ...rawVenta(1), id_movimiento: 1, id_existencia: 3, id_medicamento: 4, id_usuario: 5, motivo: 'DAÑO',
            fecha_movimiento: '9999-12-31 23:59:59', cantidad: '1', costo_unitario_aplicado: '0.005000',
            nombre_comercial: '  =DAÑO;"\n漢字', codigo_existencia: 'X', codigo_medicamento: 'Y', observacion: 'NO_EXPORTAR',
            _cursor_fecha: '9999-12-31 23:59:59.999999' }];
        grupos = [{ motivo: 'DAÑO', cantidad_retiros: '1', cantidad_retirada: '1', perdida: '0.01' }];
        const perdida = await descargar('PERDIDAS'); assert.equal(perdida[1][12], '0.01'); assert.equal(perdida[1][5], "'  =DAÑO;\"\n漢字");
        grupos = [{ cantidad: '1' }];
        const movimiento = await descargar('MOVIMIENTOS'); assert.equal(movimiento[1][7], ''); assert.equal(movimiento[1][6], '5');
        assert.doesNotMatch(JSON.stringify(movimiento), /NO_EXPORTAR/);
        grupos = [{ estado_operacion: 'CONFIRMADA', cantidad: '1', importe: '12345678901234567890.12' }];
        filas = [{ id_compra: 1, id_proveedor_laboratorio: 2, estado_operacion: 'CONFIRMADA', fecha_compra: '1000-01-01',
            fecha_registro: '9999-12-31 23:59:59', fecha_anulacion: null, total: '12345678901234567890.12', _cursor_fecha: '1000-01-01', _cursor_id: '1' }];
        assert.equal((await descargar('COMPRAS'))[1][7], '12345678901234567890.12');
        grupos = [{ categoria: 'CONFIRMADA', cantidad: '1', importe: '0.01' }]; filas = [rawVenta(1)]; falloAuditor = true;
        assert.equal((await descargar('VENTAS'))[1][7], '0.01');
    } finally { await new Promise(resolve => server.close(resolve)); await rm(raiz, { recursive: true }); }
});

test('HTTP cancelación durante SQL simulado y fallo del archivo en entrega: terminal único sin éxito parcial', async t => {
    sinDB(t); t.mock.method(console, 'error', () => {});
    const raiz = await raizTemporal(), eventos = [];
    let liberarSQL, avisarConsulta, avisarEvento, avisarCleanup, avisarRechazo, avisarDesconexion, pendiente = true, activo = false;
    const prepararOriginal = servicio.preparar;
    t.mock.method(servicio, 'preparar', async function (...args) {
        args[3].signal.addEventListener('abort', () => avisarDesconexion(), { once: true });
        let archivo;
        try { archivo = await prepararOriginal.apply(this, args); }
        catch (error) { avisarRechazo(); throw error; }
        const limpiar = archivo.limpiar;
        archivo.limpiar = async () => { await limpiar(); avisarCleanup(); };
        if (!pendiente) await rm(archivo.ruta); // Fallo real de lectura local, no error del cliente.
        return archivo;
    });
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(authService, 'getSessionUsuario', async () => auditoria.responsable);
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        if (typeof opts === 'function') return opts({});
        activo = true; try { return await callback({}); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async () => [{ categoria: 'CONFIRMADA', cantidad: '1', importe: '0.01' }]);
    t.mock.method(repo, 'bloque', async (fuente, f, { cursor }) => {
        if (cursor) return [];
        if (pendiente) { avisarConsulta(); await new Promise(resolve => { liberarSQL = resolve; }); }
        return [rawVenta(1)];
    });
    t.mock.method(bitacoraAuditoriaRepository, 'create', async ({ data }) => {
        assert.equal(activo, false); eventos.push(data); avisarEvento(); return eventos.length;
    });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/reportes/ventas/exportar?dia=2026-11-20&formato=CSV&presentacion=TABULAR`;
    const headers = { Cookie: `token=${generarToken({ idUsuario: 1, idRol: 1, versionCredenciales: 0 })}` };
    try {
        const consulta = new Promise(resolve => { avisarConsulta = resolve; });
        const evento = new Promise(resolve => { avisarEvento = resolve; });
        const rechazo = new Promise(resolve => { avisarRechazo = resolve; });
        const desconectado = new Promise(resolve => { avisarDesconexion = resolve; });
        const request = get(url, { headers }); request.on('error', () => {});
        await consulta;
        const cerrado = new Promise(resolve => request.once('close', resolve));
        request.destroy(); await cerrado;
        // Barrera real de close en servidor: el SQL deliberadamente sigue pendiente.
        await desconectado;
        assert.equal(activo, true); assert.equal(eventos.length, 0);
        liberarSQL(); await evento;
        assert.equal(eventos.length, 1); assert.equal(eventos[0].causa, 'CANCELACION_CLIENTE');
        // preparar rechaza únicamente tras rollback y cleanup, no al dispararse AbortSignal.
        await rechazo;
        assert.deepEqual(await readdir(raiz), []);
        pendiente = false;
        const siguienteEvento = new Promise(resolve => { avisarEvento = resolve; });
        const cleanup = new Promise(resolve => { avisarCleanup = resolve; });
        await assert.rejects(fetch(url, { headers, signal: AbortSignal.timeout(10000) }));
        await siguienteEvento; await cleanup;
        assert.equal(eventos.length, 2); assert.equal(eventos[1].causa, 'ERROR_INTERNO');
        assert.equal(eventos[1].metadatos.etapaExportacion, 'ENTREGA');
        assert.ok(eventos.every(e => e.resultado === 'FALLO'));
        assert.deepEqual(await readdir(raiz), []);
    } finally { await new Promise(resolve => server.close(resolve)); await rm(raiz, { recursive: true }); }
});

test('Perfil LOCAL: entorno/dirección/recursos y raíz fuera del repositorio, sin habilitación de producción', async t => {
    sinDB(t); const raiz = await raizTemporal();
    const anterior = process.env.NODE_ENV;
    t.after(() => { process.env.NODE_ENV = anterior; });
    t.mock.method(os, 'tmpdir', () => raiz);
    t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
    t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n, bsize: 1024n }));
    try {
        for (const entorno of ['production', 'test', 'staging', '']) {
            process.env.NODE_ENV = entorno;
            assert.equal(await comprobarRecursosCsvLocal('127.0.0.1'), false);
        }
        process.env.NODE_ENV = 'development';
        for (const ip of [undefined, '192.168.1.2', '0.0.0.0', '127.0.0.1.ejemplo', '::ffff:192.168.1.2']) {
            assert.equal(await comprobarRecursosCsvLocal(ip), false);
        }
        for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
            assert.deepEqual(await servicio.comprobarDisponibilidad({ direccionRemota: ip }), { raizPrivada: await fs.realpath(raiz), perfil: 'LOCAL' });
        }
        delete process.env.NODE_ENV;
        assert.ok(await comprobarRecursosCsvLocal('127.0.0.1'), 'Desarrollo predeterminado sin NODE_ENV');
        process.env.NODE_ENV = 'development';
        t.mock.method(os, 'freemem', () => 128 * 1024 * 1024 - 1);
        assert.equal(await comprobarRecursosCsvLocal('127.0.0.1'), false);
        t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
        t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n - 1n, bsize: 1024n }));
        assert.equal(await comprobarRecursosCsvLocal('127.0.0.1'), false);
        t.mock.method(fs, 'statfs', async () => { throw new Error('Disco no consultable'); });
        assert.equal(await comprobarRecursosCsvLocal('127.0.0.1'), false);
        t.mock.method(os, 'tmpdir', () => process.cwd());
        assert.equal(await comprobarRecursosCsvLocal('127.0.0.1'), false, 'Nunca temporales en backend/repositorio');
        t.mock.method(os, 'tmpdir', () => join(raiz, 'inexistente'));
        assert.equal(await comprobarRecursosCsvLocal('127.0.0.1'), false);
        assert.deepEqual(await readdir(raiz), [], 'Checker no crea archivos ni borra temporales');
    } finally { await rm(raiz, { recursive: true }); }
});

test('Controller LOCAL: no confía en IP/cabeceras reenviadas para habilitar una dirección remota', async t => {
    sinDB(t); const anterior = process.env.NODE_ENV, eventos = [];
    process.env.NODE_ENV = 'development';
    t.after(() => { process.env.NODE_ENV = anterior; });
    t.mock.method(db.sequelize, 'transaction', () => assert.fail('No abre snapshot desde red'));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    const res = new PassThrough();
    let error;
    try {
        await reporteExportacionController.ventas({ query, contextoAuditoria: auditoria.contexto, usuario: auditoria.responsable,
            socket: { remoteAddress: '192.168.1.2' }, ip: '127.0.0.1', headers: { 'x-forwarded-for': '127.0.0.1' } }, res, e => { error = e; });
        assert.equal(error.statusCode, 503); assert.equal(error.message, 'Formato no disponible');
        assert.equal(eventos.length, 1); assert.equal(eventos[0].causa, 'RECURSO_NO_DISPONIBLE');
    } finally { res.destroy(); }
});

test('Gate fuera del perfil local: siete combinaciones CSV rechazadas antes del snapshot y sin extracción', async t => {
    sinDB(t); const eventos = [];
    t.mock.method(db.sequelize, 'transaction', () => assert.fail('Gate cerrado no abre snapshot'));
    t.mock.method(repo, 'resumen', () => assert.fail('Gate cerrado no agrega'));
    t.mock.method(repo, 'bloque', () => assert.fail('Gate cerrado no extrae'));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    assert.equal(await servicio.comprobarDisponibilidad(), false);
    for (const fuente of ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS']) {
        for (const presentacion of fuente === 'MOVIMIENTOS' ? ['TABULAR'] : ['TABULAR', 'ESTADISTICA']) {
            const f = { ...filtros(), presentacion, ...(presentacion === 'ESTADISTICA' ? { granularidad: 'DIA' } : {}) };
            await assert.rejects(servicio.preparar(fuente, f, auditoria), e => e.statusCode === 503 && e.message === 'Formato no disponible');
        }
    }
    assert.equal(eventos.length, 7);
    assert.ok(eventos.every(e => e.resultado === 'RECHAZADO' && e.causa === 'RECURSO_NO_DISPONIBLE' &&
        e.metadatos.estadoEntrega === 'NO_INICIADA' && e.metadatos.cantidadFilas === undefined));
});

test('Apertura pendiente simulada: conserva cupo y rechaza cancelación/plazo antes del primer SELECT', async t => {
    sinDB(t); const raiz = await raizTemporal(), eventos = [];
    let ahora = 0, avisar, abrir, activo = false;
    t.mock.method(performance, 'now', () => ahora);
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        activo = true; avisar();
        await new Promise(resolve => { abrir = resolve; });
        try { return await callback({}); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', () => assert.fail('No SELECT tras apertura vencida/cancelada'));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    try {
        for (const causa of ['TIEMPO_AGOTADO', 'CANCELACION_CLIENTE']) {
            ahora = 0;
            const inicio = new Promise(resolve => { avisar = resolve; });
            const abortar = new AbortController();
            const tarea = servicio.preparar('VENTAS', filtros(), auditoria, { signal: abortar.signal });
            const rechazo = assert.rejects(tarea);
            await inicio;
            if (causa === 'TIEMPO_AGOTADO') ahora = 60001;
            else abortar.abort(cancelacionExportacion());
            assert.equal(activo, true);
            await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /ocupada/);
            const antes = eventos.length;
            abrir(); await rechazo;
            assert.equal(activo, false); assert.equal(eventos.length, antes + 1);
            assert.equal(eventos.at(-1).causa, causa);
            assert.deepEqual(await readdir(raiz), []);
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Agregados/series pendientes: aborto no libera snapshot/cupo ni limpia hasta resolver o rechazar SQL simulado', async t => {
    sinDB(t); const raiz = await raizTemporal(), eventos = [];
    let avisar, terminar, activo = false;
    const pendiente = async () => { avisar(); return new Promise((resolve, reject) => { terminar = rechazar => rechazar ? reject(new Error('SQL simulado')) : resolve([]); }); };
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        activo = true; try { return await callback({}); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', pendiente);
    t.mock.method(repo, 'bloque', () => assert.fail('No extraer tras aborto'));
    for (const nombre of ['Ventas', 'Compras', 'Perdidas']) t.mock.method(reporteRepository, `estadisticas${nombre}`, pendiente);
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    try {
        for (const fuente of ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS']) {
            for (const presentacion of fuente === 'MOVIMIENTOS' ? ['TABULAR'] : ['TABULAR', 'ESTADISTICA']) {
                for (const rechazar of [false, true]) {
                    for (const razon of [cancelacionExportacion(), tiempoExportacionAgotado()]) {
                        const inicio = new Promise(resolve => { avisar = resolve; });
                        const abortar = new AbortController();
                        const tarea = servicio.preparar(fuente, { ...filtros(), presentacion, granularidad: 'DIA' }, auditoria, { signal: abortar.signal });
                        const rechazo = assert.rejects(tarea, error => error === razon);
                        await inicio; abortar.abort(razon);
                        assert.equal(activo, true);
                        assert.equal((await readdir(raiz)).length, 1, 'Spool pertenece todavía al trabajo vivo');
                        await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /ocupada/);
                        const antes = eventos.length;
                        terminar(rechazar); await rechazo;
                        assert.equal(activo, false); assert.equal(eventos.length, antes + 1);
                        assert.equal(eventos.at(-1).resultado, 'FALLO');
                        assert.equal(eventos.at(-1).causa, razon.message.includes('tiempo') ? 'TIEMPO_AGOTADO' : 'CANCELACION_CLIENTE');
                        assert.deepEqual(await readdir(raiz), []);
                    }
                }
            }
        }
    } finally { await rm(raiz, { recursive: true }); }
});

// Último caso: un residual desconocido cierra intencionalmente la admisión de la instancia.
test('Cleanup fallido: diagnóstico sanitizado y admisión cerrada, sin olvidar residuo ni liberar descargas nuevas', async t => {
    sinDB(t); const raiz = await raizTemporal(), diagnosticos = [], eventos = [];
    t.mock.method(console, 'error', data => diagnosticos.push(data));
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => callback({}));
    t.mock.method(repo, 'resumen', async () => []);
    t.mock.method(repo, 'bloque', async () => []);
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    try {
        const archivo = await servicio.preparar('VENTAS', filtros(), auditoria);
        // Simular pérdida del nombre/propiedad esperada; no borrado amplio por antigüedad.
        await rename(dirname(archivo.ruta), join(raiz, 'residual-propio-del-test'));
        await archivo.finalizar(cancelacionExportacion()); await archivo.limpiar(); await archivo.limpiar();
        assert.deepEqual(diagnosticos, [{ codigo: 'EXPORTACION_LIMPIEZA_PENDIENTE' }]);
        await assert.rejects(servicio.preparar('VENTAS', filtros(), auditoria), /Formato no disponible/);
        assert.equal(eventos.at(-1).causa, 'RECURSO_NO_DISPONIBLE');
        assert.deepEqual(await readdir(raiz), ['residual-propio-del-test']);
    } finally { await rm(raiz, { recursive: true }); }
});
