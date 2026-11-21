import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { mkdtemp, readdir, rm, readFile, writeFile, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import os from 'node:os';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { Writable, PassThrough } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { crearArchivosReporte } from '../src/shared/utils/reporte-archivos.js';
import { generarXlsx, MIME_XLSX } from '../src/shared/utils/reporte-xlsx.js';
import { COLUMNAS_REPORTE, filasEstadisticas } from '../src/business/services/reporte.plantillas.js';
import { materializarEstadisticas } from '../src/business/services/reporte.estadisticas.js';
// Lector ZIP ya transitivo de ExcelJS; no otra dependencia de producción.
const JSZip = createRequire(import.meta.resolve('exceljs'))('jszip');

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'xlsx_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_tests_xlsx';
const { default: db } = await import('../src/data/models/index.js');
const { reporteExportacionService: servicio, cancelacionExportacion } = await import('../src/business/services/reporte.exportacion.service.js');
const { reporteExtraccionRepository: repo } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { reporteValidator: v } = await import('../src/business/validators/reporte.validator.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { reporteExportacionController: controller } = await import('../src/presentation/controllers/reporte-exportacion.controller.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const actor = { idUsuario: 1, idRol: 1, nombreUsuario: 'actor' };
const auditoria = { contexto: { correlacion: 'b'.repeat(32) }, responsable: actor };
const fuentes = ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS'];
const nombres = { VENTAS: 'Ventas', COMPRAS: 'Compras', PERDIDAS: 'Perdidas', MOVIMIENTOS: 'Movimientos' };
const temporal = () => mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir(), 'cadefar-test-xlsx-'));
const filtros = fuente => v[`validateExportacion${nombres[fuente]}`]({ ...(fuente === 'MOVIMIENTOS' ? {} : { dia: '9999-12-31' }), formato: 'XLSX', presentacion: 'TABULAR' }).data;
const sinDB = t => t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido'));
const raw = (fuente, id) => ({ id_venta: id, id_compra: id, id_proveedor_laboratorio: 2,
    id_movimiento: id, id_existencia: 3, id_medicamento: 4, id_usuario: 5,
    estado_operacion: 'CONFIRMADA', categoria: 'CONFIRMADA', total: '12345678901234567890.12',
    fecha_referencia: '9999-12-31 23:59:59', fecha_registro: '1000-01-01 00:00:00',
    fecha_venta: '9999-12-31 23:59:59', fecha_compra: '1000-01-01', fecha_anulacion: null,
    fecha_movimiento: '9999-12-31 23:59:59', motivo: 'DAÑO', direccion: 'SALIDA', cantidad: '9007199254740993',
    costo_unitario_aplicado: '0.005000', codigo_existencia: '000001', codigo_medicamento: '+001',
    nombre_comercial: '  =HYPERLINK("https://invalid.test","DAÑO")\n漢字 😀',
    _cursor_fecha: fuente === 'COMPRAS' ? '1000-01-01' : '9999-12-31 23:59:59.999999', _cursor_id: String(id) });
const grupos = (fuente, n) => !n ? fuente === 'MOVIMIENTOS' ? [{ cantidad: '0' }] : []
    : fuente === 'PERDIDAS' ? [{ motivo: 'DAÑO', cantidad_retiros: String(n), cantidad_retirada: (BigInt(n) * 9007199254740993n).toString(),
        perdida: `${BigInt(n) * 4503599627370497n / 100n}.${String(BigInt(n) * 4503599627370497n % 100n).padStart(2, '0')}` }]
        : fuente === 'MOVIMIENTOS' ? [{ cantidad: String(n) }]
            : [{ categoria: 'CONFIRMADA', estado_operacion: 'CONFIRMADA', cantidad: String(n),
                importe: `${(BigInt(n) * 1234567890123456789012n) / 100n}.${String((BigInt(n) * 1234567890123456789012n) % 100n).padStart(2, '0')}` }];
const reabrir = async ruta => { const libro = new ExcelJS.Workbook(); await libro.xlsx.readFile(ruta); return libro; };
const configurar = (t, raiz, eventos) => {
    sinDB(t);
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => callback({ snapshot: true }));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
};

test('XLSX real: cuatro fuentes, vacíos y 1001 filas en varios bloques, hojas/tipos/metadatos exactos', async t => {
    const raiz = await temporal(), eventos = [];
    configurar(t, raiz, eventos);
    let fuenteActual, cantidad, llamadas, activo = false;
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        assert.equal(opts.isolationLevel, 'REPEATABLE READ'); activo = true;
        try { return await callback({ snapshot: true }); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async fuente => { assert.ok(activo); return grupos(fuente, cantidad); });
    t.mock.method(repo, 'bloque', async (fuente, f, { cursor, limite, transaction }) => {
        assert.ok(activo); assert.ok(transaction.snapshot); assert.equal(limite, 1000); llamadas++;
        const ultimo = cursor ? BigInt(cursor.id) - 1n : BigInt(cantidad);
        return Array.from({ length: Math.min(Number(ultimo), 1000) }, (_, i) => raw(fuente, Number(ultimo) - i));
    });
    const original = ExcelJS.stream.xlsx.WorkbookWriter.prototype.addWorksheet;
    t.mock.method(ExcelJS.stream.xlsx.WorkbookWriter.prototype, 'addWorksheet', function (...args) {
        assert.equal(activo, false, 'Renderizado después del snapshot');
        assert.equal(this.useSharedStrings, false);
        assert.ok(this.stream instanceof Writable);
        const hoja = original.apply(this, args);
        assert.ok(hoja.stream instanceof PassThrough, 'No StreamBuf interno sin backpressure');
        assert.equal(hoja.stream.writableHighWaterMark, 65536);
        return hoja;
    });
    try {
        for (fuenteActual of fuentes) for (cantidad of [0, 1001]) {
            llamadas = 0;
            const a = await servicio.preparar(fuenteActual, filtros(fuenteActual), auditoria);
            assert.equal(llamadas, cantidad ? 3 : 1);
            assert.equal(eventos.filter(e => e.resultado === 'EXITO').length, 0, 'Generar no audita éxito');
            assert.equal(a.mime, MIME_XLSX); assert.equal(a.bytes, (await stat(a.ruta)).size);
            assert.match(a.nombre, new RegExp(`^cadefar-${fuenteActual.toLowerCase()}-tabular-\\d{8}-\\d{6}-b{32}\\.xlsx$`));
            const libro = await reabrir(a.ruta), detalle = libro.getWorksheet('Detalle'), resumen = libro.getWorksheet('Resumen');
            const zip = await JSZip.loadAsync(await readFile(a.ruta));
            assert.equal(zip.file('xl/sharedStrings.xml'), null);
            for (const nombre of Object.keys(zip.files).filter(n => /\.xml$|\.rels$/.test(n))) {
                const xml = await zip.file(nombre).async('string');
                assert.doesNotMatch(xml, /<f[ >]|<hyperlink[ >]|TargetMode="External"/);
            }
            assert.deepEqual(libro.worksheets.map(h => h.name), ['Resumen', 'Detalle']);
            assert.deepEqual(detalle.getRow(1).values.slice(1), COLUMNAS_REPORTE[fuenteActual]);
            assert.equal(detalle.rowCount, cantidad + 1); assert.equal(detalle.views[0].ySplit, 1);
            assert.deepEqual(detalle.autoFilter, `A1:${String.fromCharCode(64 + COLUMNAS_REPORTE[fuenteActual].length)}${cantidad + 1}`);
            assert.match(JSON.stringify(resumen.getSheetValues()), /America\/La_Paz/);
            assert.match(JSON.stringify(resumen.getSheetValues()), /todos/);
            if (fuenteActual === 'MOVIMIENTOS') assert.doesNotMatch(JSON.stringify(resumen.getSheetValues()), /resumen\.|diccionario|saldo/i);
            if (cantidad) {
                const fila = detalle.getRow(2);
                for (const [i, c] of COLUMNAS_REPORTE[fuenteActual].entries()) {
                    const celda = fila.getCell(i + 1);
                    assert.equal(celda.numFmt, '@');
                    assert.ok([ExcelJS.ValueType.String, ExcelJS.ValueType.Null].includes(celda.type), c);
                    assert.equal(celda.formula, undefined); assert.equal(celda.hyperlink, undefined);
                }
                assert.equal(fila.getCell(1).value, '1001');
                const valores = Object.fromEntries(COLUMNAS_REPORTE[fuenteActual].map((c, i) => [c, fila.getCell(i + 1).value]));
                if (fuenteActual === 'VENTAS' || fuenteActual === 'COMPRAS') {
                    assert.equal(valores.total, '12345678901234567890.12'); assert.equal(valores.fechaAnulacion, null);
                    assert.equal(valores.fechaRegistro, '1000-01-01 00:00:00');
                } else {
                    assert.equal(valores.cantidad, '9007199254740993'); assert.equal(valores.costoUnitarioAplicado, '0.005000');
                    assert.equal(valores.codigoExistencia, '000001'); assert.equal(valores.codigoMedicamento, '+001');
                    assert.equal(valores.nombreComercial, raw(fuenteActual, 1).nombre_comercial);
                    assert.equal(valores.idMovimientoReversion, null);
                    if (fuenteActual === 'PERDIDAS') assert.equal(valores.perdida, '45035996273704.97');
                    else assert.equal(valores.nombreUsuario, null);
                }
            }
            await a.finalizar(cancelacionExportacion()); await a.limpiar(); await a.limpiar();
            assert.deepEqual(await readdir(raiz), []);
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('XLSX estadístico completo: tres fuentes, todas las métricas/ceros, distribuciones y gráfica', async t => {
    sinDB(t); const raiz = await temporal();
    try {
        for (const fuente of fuentes.slice(0, 3)) for (const vacio of [false, true]) {
            const f = { ...filtros(fuente), presentacion: 'ESTADISTICA', granularidad: 'DIA', grafico: 'BARRAS', metrica: fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE',
                periodo: { modalidad: 'PERIODO', desde: '9999-12-30', hasta: '9999-12-31', zonaHoraria: 'America/La_Paz' } };
            const g = vacio ? [] : grupos(fuente, 1);
            const data = materializarEstadisticas(fuente, f, { grupos: g, temporales: g.map(x => ({ ...x, etiqueta: '9999-12-30' })) });
            const filas = [...filasEstadisticas(data)];
            const archivos = await crearArchivosReporte(raiz, () => {});
            try {
                const spool = await archivos.escritor('spool');
                for (const fila of filas) await spool.escribir(JSON.stringify(fila) + '\n');
                await spool.cerrar();
                await generarXlsx({ archivos, fuente, filtros: f, metadata: data, generacion: '1000-01-01 00:00:00', filas: filas.length, comprobar() {} });
                await archivos.verificar('xlsx');
                const libro = await reabrir(archivos.rutas.xlsx);
                assert.deepEqual(libro.worksheets.map(h => h.name), ['Resumen', 'Estadisticas', 'Grafica']);
                const hoja = libro.getWorksheet('Estadisticas');
                assert.equal(hoja.rowCount, filas.length + 1);
                for (const [i, fila] of filas.entries()) {
                    assert.deepEqual(hoja.getRow(i + 2).values.slice(1), COLUMNAS_REPORTE.ESTADISTICA.map(c => String(fila[c])));
                    assert.equal(hoja.getRow(i + 2).getCell(8).type, ExcelJS.ValueType.String);
                }
                assert.match(JSON.stringify(libro.getWorksheet('Resumen').getSheetValues()), /distribuciones/);
            } finally { await archivos.limpiar(); }
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Límites XLSX, texto adversarial literal, corrupción, conteo incompleto y cuotas reales reducidas', async t => {
    sinDB(t); const raiz = await temporal();
    const textos = ['=1+1', '+SUM(A1)', '-ABC', '@x', '\t=1', '\r=1', '\n=1', 'a\r\nb', "'texto", ' https://invalid.test', '_x0041_ _x000D_ _x005F_ _X0041_', 'x'.repeat(32767)];
    const ejecutar = async (valores, esperadas, limites = {}) => {
        const archivos = await crearArchivosReporte(raiz, () => {}, limites);
        try {
            const spool = await archivos.escritor('spool');
            for (const valor of valores) await spool.escribir(JSON.stringify({ nombreComercial: valor }) + '\n');
            await spool.cerrar();
            await generarXlsx({ archivos, fuente: 'MOVIMIENTOS', filtros: filtros('MOVIMIENTOS'), metadata: {}, generacion: '9999-12-31 23:59:59', filas: esperadas, comprobar() {} });
            const libro = await reabrir(archivos.rutas.xlsx);
            for (const [i, valor] of valores.entries()) {
                const celda = libro.getWorksheet('Detalle').getRow(i + 2).getCell(6);
                // El lector inline de ExcelJS 4.4.0 no decodifica ST_Xstring.
                // Decodificar una sola pasada, como exige OOXML (sin recursión).
                const literal = celda.value.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
                assert.equal(literal, valor); assert.equal(celda.type, ExcelJS.ValueType.String);
                assert.equal(celda.formula, undefined); assert.equal(celda.hyperlink, undefined);
            }
            await writeFile(archivos.rutas.xlsx, 'corrupto');
            await assert.rejects(archivos.verificar('xlsx'));
            await assert.rejects(reabrir(archivos.rutas.xlsx));
        } finally { await archivos.limpiar(); assert.deepEqual(await readdir(raiz), []); }
    };
    try {
        await ejecutar(textos, textos.length);
        await assert.rejects(ejecutar(['x'.repeat(32768)], 1), e => e.statusCode === 413);
        await assert.rejects(ejecutar(['x\u0000y'], 1), /no representable/);
        await assert.rejects(ejecutar(['\ud800'], 1), /no representable/);
        await assert.rejects(ejecutar(['x'], 2), /incompleto/);
        await assert.rejects(ejecutar([], 1000001), e => e.statusCode === 413);
        await assert.rejects(ejecutar([], 0, { final: 100 }), e => e.statusCode === 413);
        await assert.rejects(ejecutar([], 0, { disco: 100 }), e => e.statusCode === 413);
    } finally { await rm(raiz, { recursive: true }); }
});

test('Error tardío ZIP y cancelación en generación: único FALLO, handles cerrados y cleanup sin éxito parcial', async t => {
    const raiz = await temporal(), eventos = [];
    configurar(t, raiz, eventos);
    t.mock.method(repo, 'resumen', async () => []); t.mock.method(repo, 'bloque', async () => []);
    const probe = await open(join(raiz, 'probe'), 'wx'), proto = Object.getPrototypeOf(probe);
    await probe.close(); await rm(join(raiz, 'probe'));
    const original = proto.writeFile;
    let buffers = 0, cancelar = false, abortar;
    t.mock.method(proto, 'writeFile', async function (chunk, ...args) {
        if (Buffer.isBuffer(chunk) && ++buffers === 8) {
            if (cancelar) abortar.abort(cancelacionExportacion());
            else throw Object.assign(new Error('ENOSPC sintético tardío'), { code: 'ENOSPC' });
        }
        return original.call(this, chunk, ...args);
    });
    try {
        for (cancelar of [false, true]) {
            buffers = 0; abortar = new AbortController();
            await assert.rejects(servicio.preparar('VENTAS', filtros('VENTAS'), auditoria, { signal: abortar.signal }));
            assert.ok(buffers >= 8); assert.equal(eventos.length, cancelar ? 2 : 1);
            assert.equal(eventos.at(-1).resultado, 'FALLO');
            assert.equal(eventos.at(-1).causa, cancelar ? 'CANCELACION_CLIENTE' : 'ERROR_INTERNO');
            assert.equal(eventos.at(-1).metadatos.etapaExportacion, 'GENERACION');
            assert.deepEqual(await readdir(raiz), []);
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Backpressure XLSX: destino bloqueado detiene lectura de filas, sin acumular histórico completo', async t => {
    sinDB(t); const raiz = await temporal();
    const archivos = await crearArchivosReporte(raiz, () => {});
    let liberar, avisarBloqueo, filasLeidas = 0;
    const bloqueo = new Promise(resolve => { avisarBloqueo = resolve; });
    const espera = new Promise(resolve => { liberar = resolve; });
    const destino = new Writable({ highWaterMark: 1024, write(chunk, enc, cb) { avisarBloqueo(); espera.then(() => cb()); } });
    const original = ExcelJS.stream.xlsx.WorkbookWriter.prototype.addWorksheet;
    t.mock.method(ExcelJS.stream.xlsx.WorkbookWriter.prototype, 'addWorksheet', function (...args) {
        const hoja = original.apply(this, args), addRow = hoja.addRow;
        hoja.addRow = function (...a) { if (hoja.name === 'Detalle') filasLeidas++; return addRow.apply(this, a); };
        return hoja;
    });
    try {
        const spool = await archivos.escritor('spool');
        for (let i = 0; i < 200; i++) await spool.escribir(JSON.stringify({ nombreComercial: randomBytes(16000).toString('hex') }) + '\n');
        await spool.cerrar();
        const trabajo = generarXlsx({ archivos: { ...archivos, async flujo() { return destino; } }, fuente: 'MOVIMIENTOS', filtros: filtros('MOVIMIENTOS'), metadata: {}, generacion: '2026-11-20 00:00:00', filas: 200, comprobar() {} });
        await bloqueo;
        // Dar oportunidades al productor con el destino aún bloqueado.
        for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve));
        assert.ok(filasLeidas < 200, `Lectura no acotada: ${filasLeidas}`);
        liberar(); await trabajo; await finished(destino);
        assert.equal(filasLeidas, 201);
    } finally { liberar(); destino.destroy(); await archivos.limpiar(); await rm(raiz, { recursive: true }); }
});

test('XLSX cancelado con SQL pendiente: conserva conexión/cupo/spool hasta resolver y audita una sola vez', async t => {
    const raiz = await temporal(), eventos = [];
    configurar(t, raiz, eventos);
    let avisar, resolver, activo = false;
    const consulta = new Promise(resolve => { avisar = resolve; });
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        activo = true; try { return await callback({}); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async () => { avisar(); return new Promise(resolve => { resolver = resolve; }); });
    t.mock.method(repo, 'bloque', () => assert.fail('No extraer después de cancelar'));
    const abortar = new AbortController();
    try {
        const tarea = servicio.preparar('VENTAS', filtros('VENTAS'), auditoria, { signal: abortar.signal });
        const rechazo = assert.rejects(tarea, /Cancelación/);
        await consulta; abortar.abort(cancelacionExportacion());
        assert.equal(activo, true); assert.equal(eventos.length, 0);
        assert.equal((await readdir(raiz)).length, 1);
        await assert.rejects(servicio.preparar('VENTAS', filtros('VENTAS'), auditoria), /ocupada/);
        resolver([]); await rechazo;
        assert.equal(activo, false); assert.equal(eventos.length, 2);
        assert.equal(eventos.at(-1).causa, 'CANCELACION_CLIENTE');
        assert.ok(eventos.every(e => e.resultado !== 'EXITO'));
        assert.deepEqual(await readdir(raiz), []);
    } finally { await rm(raiz, { recursive: true }); }
});

test('XLSX entrega bloqueada: timeout del transporte, un terminal FALLO y cleanup', async t => {
    const raiz = await temporal(), eventos = [], timers = [];
    configurar(t, raiz, eventos);
    t.mock.method(repo, 'resumen', async () => []); t.mock.method(repo, 'bloque', async () => []);
    t.mock.method(globalThis, 'setTimeout', (callback, ms) => { const timer = { callback, ms }; timers.push(timer); return timer; });
    t.mock.method(globalThis, 'clearTimeout', () => {});
    const res = new PassThrough({ highWaterMark: 1 });
    let avisar;
    const headers = new Promise(resolve => { avisar = resolve; });
    res.status = () => res;
    res.set = h => { assert.equal(h['Content-Type'], MIME_XLSX); avisar(); return res; };
    try {
        const tarea = controller.ventas({ query: { dia: '9999-12-31', formato: 'XLSX', presentacion: 'TABULAR' },
            contextoAuditoria: auditoria.contexto, usuario: actor }, res, () => assert.fail('No JSON tras transporte destruido'));
        await headers; assert.equal(eventos.length, 0);
        assert.equal(timers.length, 2); timers[1].callback(); await tarea;
        assert.equal(eventos.length, 1); assert.equal(eventos[0].resultado, 'FALLO');
        assert.equal(eventos[0].causa, 'TIEMPO_AGOTADO');
        assert.equal(eventos[0].metadatos.estadoEntrega, 'FALLIDA');
        assert.equal(res.destroyed, true); assert.deepEqual(await readdir(raiz), []);
    } finally { res.destroy(); await rm(raiz, { recursive: true }); }
});

test('HTTP XLSX localhost: MIME/nombre/longitud, cuatro rutas, roles/HEAD, variantes no disponibles y terminal único', async t => {
    sinDB(t); t.mock.method(console, 'error', () => {});
    const raiz = await temporal(), eventos = [];
    const anterior = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
    t.after(() => { process.env.NODE_ENV = anterior; });
    t.mock.method(os, 'tmpdir', () => raiz); t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
    t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n, bsize: 1024n }));
    t.mock.method(authService, 'getSessionUsuario', async id => ({ ...actor, idRol: id, idUsuario: id }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => callback({}));
    t.mock.method(repo, 'resumen', async fuente => grupos(fuente, 0)); t.mock.method(repo, 'bloque', async () => []);
    let notificar, limpieza;
    t.mock.method(auditor, 'intentarRegistrar', async e => { eventos.push(e); notificar?.(); });
    const original = servicio.preparar;
    t.mock.method(servicio, 'preparar', async function (...args) {
        const a = await original.apply(this, args), limpiar = a.limpiar;
        a.limpiar = async () => { await limpiar(); limpieza(); }; return a;
    });
    const servidor = app.listen(0, '127.0.0.1'); await new Promise(resolve => servidor.once('listening', resolve));
    const solicitar = (fuente, extra = '', rol = 1, method = 'GET') => fetch(`http://127.0.0.1:${servidor.address().port}/api/${fuente === 'MOVIMIENTOS' ? 'inventario/movimientos' : `reportes/${fuente.toLowerCase()}`}/exportar?${fuente === 'MOVIMIENTOS' ? '' : 'dia=9999-12-31&'}formato=XLSX&presentacion=TABULAR${extra}`, {
        method, headers: rol ? { Cookie: `token=${generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 })}` } : {}, signal: AbortSignal.timeout(10000) });
    try {
        for (const fuente of fuentes) {
            assert.equal((await solicitar(fuente, '', null)).status, 401);
            assert.equal((await solicitar(fuente, '', 3)).status, 403);
            assert.equal((await solicitar(fuente, '', 2, 'HEAD')).status, ['VENTAS', 'COMPRAS'].includes(fuente) ? 403 : 405);
            const head = await solicitar(fuente, '', 1, 'HEAD');
            assert.equal(head.status, 405); assert.equal(head.headers.get('allow'), 'GET');
            const antes = eventos.length;
            const terminal = new Promise(resolve => { notificar = resolve; });
            const limpio = new Promise(resolve => { limpieza = resolve; });
            const res = await solicitar(fuente, '', ['PERDIDAS', 'MOVIMIENTOS'].includes(fuente) ? 2 : 1);
            assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), MIME_XLSX);
            assert.match(res.headers.get('content-disposition'), /attachment; filename="cadefar-.*\.xlsx"$/);
            assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
            const bytes = Buffer.from(await res.arrayBuffer()); assert.equal(Number(res.headers.get('content-length')), bytes.length);
            const libro = new ExcelJS.Workbook(); await libro.xlsx.load(bytes);
            assert.equal(libro.getWorksheet('Detalle').rowCount, 1);
            await terminal; await limpio;
            assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).resultado, 'EXITO');
            assert.equal(eventos.at(-1).metadatos.formato, 'XLSX');
            assert.deepEqual(await readdir(raiz), []);
        }
        for (const fuente of fuentes.slice(0, 3)) {
            const q = v[`validateExportacion${nombres[fuente]}`]({ dia: '9999-12-31', formato: 'XLSX', presentacion: 'ESTADISTICA', granularidad: 'DIA', grafico: 'BARRAS', metrica: fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE' });
            assert.ok(q.success);
            await assert.rejects(original.call(servicio, fuente, q.data, auditoria, { direccionRemota: '192.168.1.2' }), e => e.statusCode === 503);
        }
        await assert.rejects(original.call(servicio, 'VENTAS', { ...filtros('VENTAS'), formato: 'PDF', presentacion: 'ESTADISTICA', granularidad: 'DIA', grafico: 'BARRAS', metrica: 'IMPORTE' }, auditoria, { direccionRemota: '192.168.1.2' }), e => e.statusCode === 503);
        process.env.NODE_ENV = 'production';
        assert.equal((await solicitar('VENTAS')).status, 503);
        process.env.NODE_ENV = 'development';
        const res = new PassThrough(); let rechazado;
        await controller.ventas({ query: { dia: '9999-12-31', formato: 'XLSX', presentacion: 'TABULAR' }, contextoAuditoria: auditoria.contexto,
            usuario: actor, socket: { remoteAddress: '192.168.1.2' }, headers: { 'x-forwarded-for': '127.0.0.1' } }, res, e => { rechazado = e; });
        assert.equal(rechazado.statusCode, 503); res.destroy();
    } finally { await new Promise(resolve => servidor.close(resolve)); await rm(raiz, { recursive: true }); }
});
