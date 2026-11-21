import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, readFile, writeFile, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { generarPdf, MIME_PDF, LAYOUT_PDF, FUENTE_PDF } from '../src/shared/utils/reporte-pdf.js';
import { crearArchivosReporte } from '../src/shared/utils/reporte-archivos.js';
import { COLUMNAS_REPORTE, proyectarFila, crearConciliacion } from '../src/business/services/reporte.plantillas.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'pdf_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_tests_pdf';
const { default: db } = await import('../src/data/models/index.js');
const { reporteExportacionService: servicio, cancelacionExportacion } = await import('../src/business/services/reporte.exportacion.service.js');
const { reporteExtraccionRepository: repo } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { reporteValidator: v } = await import('../src/business/validators/reporte.validator.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { reporteExportacionController: controller } = await import('../src/presentation/controllers/reporte-exportacion.controller.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const fuentes = ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS'];
const nombres = { VENTAS: 'Ventas', COMPRAS: 'Compras', PERDIDAS: 'Perdidas', MOVIMIENTOS: 'Movimientos' };
const actor = { idUsuario: 1, idRol: 1, nombreUsuario: 'actor' };
const auditoria = { contexto: { correlacion: 'c'.repeat(32) }, responsable: actor };
const temporal = () => mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-test-pdf-'));
const filtros = fuente => v[`validateExportacion${nombres[fuente]}`]({ ...(fuente === 'MOVIMIENTOS' ? {} : { dia: '9999-12-31' }), formato: 'PDF', presentacion: 'TABULAR' }).data;
const sinDB = t => t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido'));
const raw = (fuente, id, extendido = false) => ({ id_venta: id, id_compra: id, id_proveedor_laboratorio: 2,
    id_movimiento: id, id_existencia: 3, id_medicamento: 4, id_usuario: 5,
    estado_operacion: 'CONFIRMADA', categoria: 'CONFIRMADA', total: extendido ? '12345678901234567890.12' : '1.00',
    fecha_referencia: '9999-12-31 23:59:59', fecha_registro: '1000-01-01 00:00:00',
    fecha_venta: '9999-12-31 23:59:59', fecha_compra: '1000-01-01', fecha_anulacion: null,
    fecha_movimiento: '9999-12-31 23:59:59', motivo: 'DAÑO', direccion: 'SALIDA', cantidad: extendido ? '9007199254740993' : '1',
    costo_unitario_aplicado: '0.005000', codigo_existencia: '000001', codigo_medicamento: '+001',
    nombre_comercial: extendido ? '  =HYPERLINK("https://invalid.test","DAÑO") <script>alert(1)</script> áéíóú ü Ñ Ω Ж é' : 'DAÑO áéíóú',
    _cursor_fecha: fuente === 'COMPRAS' ? '1000-01-01' : '9999-12-31 23:59:59.999999', _cursor_id: String(id) });
const grupos = (fuente, n) => !n ? fuente === 'MOVIMIENTOS' ? [{ cantidad: '0' }] : []
    : fuente === 'PERDIDAS' ? [{ motivo: 'DAÑO', cantidad_retiros: String(n), cantidad_retirada: String(n), perdida: `${BigInt(n) / 100n}.${String(BigInt(n) % 100n).padStart(2, '0')}` }]
        : fuente === 'MOVIMIENTOS' ? [{ cantidad: String(n) }]
            : [{ categoria: 'CONFIRMADA', estado_operacion: 'CONFIRMADA', cantidad: String(n), importe: `${n}.00` }];
const configurar = (t, raiz, eventos) => {
    sinDB(t);
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => callback({ snapshot: true }));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
};
const compacto = s => s.normalize('NFC').replace(/\s/gu, '');
// Lector independiente: analiza objetos, fuentes, contenido, coordenadas y acciones,
// no depende del hash/traza del algoritmo de layout del renderer.
const leerPdf = async datos => {
    const bytes = typeof datos === 'string' ? await readFile(datos) : datos;
    const binario = bytes.toString('latin1');
    assert.match(binario, /\/FontFile2/); assert.match(binario, /\/ToUnicode/);
    assert.doesNotMatch(binario, /\/JavaScript|\/JS\b|\/URI\b|\/Launch\b|\/Annots\b|\/EmbeddedFiles/);
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true });
    const doc = await task.promise, paginas = [], columnas = new Map();
    try {
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i), content = await page.getTextContent({ disableNormalization: true });
            assert.deepEqual(page.view, [0, 0, LAYOUT_PDF.ancho, LAYOUT_PDF.alto]);
            assert.deepEqual(await page.getAnnotations(), []);
            const lineas = content.items.filter(x => x.str !== undefined);
            for (const item of lineas) {
                const [a, , , d, x, y] = item.transform;
                assert.ok(a >= 8 && d >= 8, 'Texto mínimo 8 pt');
                assert.ok(x >= LAYOUT_PDF.margen - .1, `Izquierda ${x}`);
                assert.ok(x + item.width <= LAYOUT_PDF.ancho - LAYOUT_PDF.margen + .1, `Derecha ${item.str}`);
                const estilo = content.styles[item.fontName];
                assert.ok(y + item.height * estilo.descent >= LAYOUT_PDF.margen - .1, `Abajo ${item.str}`);
                assert.ok(y + item.height * estilo.ascent <= LAYOUT_PDF.alto - LAYOUT_PDF.margen + .1, `Arriba ${item.str}`);
                const clave = x.toFixed(3);
                columnas.set(clave, (columnas.get(clave) ?? '') + item.str);
            }
            const texto = lineas.map(x => x.str).join('\n');
            assert.match(texto, /CADEFAR/); assert.ok(texto.includes(`Página ${i} de ${doc.numPages}`));
            assert.match(texto, /Detalle completo \/ campos etiquetados/);
            paginas.push(texto); page.cleanup();
        }
        return { paginas, texto: paginas.join('\n'), textoColumnas: [...columnas.values()].join('\n'), total: doc.numPages };
    } finally { await doc.cleanup(); await task.destroy?.(); }
};
const renderizar = async (raiz, fuente, filas, resumen = {}, opciones = {}) => {
    const archivos = await crearArchivosReporte(raiz, opciones.comprobar ?? (() => {}), opciones.limites);
    const spool = await archivos.escritor('spool');
    for (const fila of filas) await spool.escribir(JSON.stringify(fila) + '\n');
    await spool.cerrar();
    const parametros = { archivos, fuente, filtros: filtros(fuente), metadata: { resumen }, generacion: '1000-01-01 00:00:00',
        filas: filas.length, comprobar() {}, ...opciones };
    return { archivos, parametros };
};

test('PDF real: cuatro fuentes vacías y 1001 registros por bloques; conteos, metadatos, categorías cero, totales, páginas y layout', async t => {
    const raiz = await temporal(), eventos = []; configurar(t, raiz, eventos);
    let cantidad = 0, activo = false, llamadas;
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => {
        assert.equal(opts.isolationLevel, 'REPEATABLE READ'); activo = true;
        try { return await callback({ snapshot: true }); } finally { activo = false; }
    });
    t.mock.method(repo, 'resumen', async fuente => { assert.ok(activo); return grupos(fuente, cantidad); });
    t.mock.method(repo, 'bloque', async (fuente, f, { cursor, limite, transaction }) => {
        assert.ok(activo && transaction.snapshot); assert.equal(limite, 1000); llamadas++;
        const ultimo = cursor ? Number(cursor.id) - 1 : cantidad;
        return Array.from({ length: Math.min(ultimo, 1000) }, (_, i) => raw(fuente, ultimo - i));
    });
    const original = PDFDocument.prototype.text;
    t.mock.method(PDFDocument.prototype, 'text', function (...args) {
        assert.equal(activo, false); assert.equal(this.options.bufferPages, false); assert.equal(this.options.fontLayoutCache, false);
        return original.apply(this, args);
    });
    try {
        for (const fuente of fuentes) for (cantidad of [0, 1001]) {
            llamadas = 0; const a = await servicio.preparar(fuente, filtros(fuente), auditoria);
            try {
                assert.equal(llamadas, cantidad ? 3 : 1); assert.equal(a.mime, MIME_PDF);
                assert.equal(a.bytes, (await stat(a.ruta)).size); assert.match(a.nombre, /-c{32}\.pdf$/);
                const pdf = await leerPdf(a.ruta);
                assert.equal((pdf.texto.match(/Registro ID \d+/g) ?? []).length, cantidad);
                for (let id = 1; id <= cantidad; id++) assert.ok(pdf.texto.includes(`Registro ID ${id}\n`));
                assert.match(pdf.texto, /America\/La_Paz/); assert.match(pdf.texto, /todos/);
                assert.match(pdf.texto, /Generación civil: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
                assert.match(pdf.texto, /Estado actual del snapshot; catálogos actuales/);
                assert.ok(pdf.texto.includes(`Cantidad de ${fuente === 'MOVIMIENTOS' ? 'movimientos' : 'filas'}: ${cantidad}`));
                if (cantidad) {
                    assert.ok(pdf.total > 1);
                    const p = proyectarFila(fuente, raw(fuente, 1));
                    for (const c of COLUMNAS_REPORTE[fuente]) assert.ok(compacto(pdf.texto).includes(compacto(p[c] == null ? '—' : String(p[c]))), c);
                }
                if (fuente === 'MOVIMIENTOS') assert.doesNotMatch(pdf.texto, /Resumen|saldo|importe|ingresos/i);
                else {
                    const resumen = crearConciliacion(fuente, grupos(fuente, cantidad)).resumen;
                    const comprobar = (obj, path = '') => { for (const [k, v] of Object.entries(obj)) {
                        if (typeof v === 'object') comprobar(v, path + k + '.');
                        else assert.ok(compacto(pdf.texto).includes(compacto(`${path}${k}: ${v}`)));
                    } }; comprobar(resumen);
                }
                assert.ok(eventos.every(e => e.resultado !== 'EXITO'));
            } finally { await a.finalizar(cancelacionExportacion()); await a.limpiar(); }
            assert.deepEqual(await readdir(raiz), []);
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('PDF exacto: todos los campos, fechas 1000/9999, nulos, enormes, seis decimales, DAÑO, acentos y texto adversarial', async t => {
    sinDB(t); const raiz = await temporal();
    try {
        for (const fuente of fuentes) {
            const fila = proyectarFila(fuente, raw(fuente, 123, true));
            const { archivos, parametros } = await renderizar(raiz, fuente, [fila], { confirmadas: { cantidad: 1, importe: '12345678901234567890.12' } });
            try {
                await generarPdf(parametros); await archivos.verificar('pdf'); const pdf = await leerPdf(archivos.rutas.pdf);
                for (const c of COLUMNAS_REPORTE[fuente]) assert.ok(compacto(pdf.texto + pdf.textoColumnas).includes(compacto(fila[c] == null ? '—' : String(fila[c]))), c);
                assert.match(pdf.texto, /1000-01-01 00:00:00/);
                if (fuente === 'PERDIDAS') { assert.match(pdf.texto, /Pérdidas brutas/); assert.ok(compacto(pdf.texto).includes('45035996273704.97')); }
            } finally { await archivos.limpiar(); }
        }
        const fila = proyectarFila('MOVIMIENTOS', raw('MOVIMIENTOS', 1, true));
        fila.nombreComercial = 'INICIO ' + 'ácido <b> https://invalid.test =1+1 '.repeat(600) + ' FIN';
        fila.nombreUsuario = 'Usuario íntegro final';
        const { archivos, parametros } = await renderizar(raiz, 'MOVIMIENTOS', [fila]);
        try {
            const conteo = await generarPdf(parametros), pdf = await leerPdf(archivos.rutas.pdf);
            assert.equal(conteo.paginas, pdf.total); assert.ok(pdf.total > 2);
            assert.match(pdf.texto, /ID 1 \/ continuación/);
            assert.equal((compacto(pdf.textoColumnas).match(/ácido<b>https:\/\/invalid.test=1\+1/g) ?? []).length, 600);
            assert.ok(compacto(pdf.texto).includes(compacto('Usuario íntegro final')));
        } finally { await archivos.limpiar(); }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Fuente concreta: hash, licencia embedding y rechazo explícito de glifos/controles/surrogates antes de archivo PDF', async t => {
    sinDB(t); const raiz = await temporal();
    const { createHash } = await import('node:crypto');
    assert.equal(createHash('sha256').update(await readFile(FUENTE_PDF)).digest('hex'), 'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5');
    const doc = new PDFDocument({ autoFirstPage: false, font: FUENTE_PDF });
    assert.ok(Object.values(doc._font.font['OS/2'].fsType).every(v => v === false)); doc.destroy();
    try {
        for (const texto of ['漢字', '😀', '\ud800', 'x\u0000y', '\t=1', 'abc\u202e']) {
            const fila = proyectarFila('MOVIMIENTOS', raw('MOVIMIENTOS', 1)); fila.nombreComercial = texto;
            const { archivos, parametros } = await renderizar(raiz, 'MOVIMIENTOS', [fila]);
            try {
                await assert.rejects(generarPdf(parametros), /Glifo PDF no representable/);
                await assert.rejects(stat(archivos.rutas.pdf), { code: 'ENOENT' });
            } finally { await archivos.limpiar(); }
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Límites PDF filas/páginas/bytes, spool corrupto, discrepancia de pasadas y artefacto corrupto; cleanup acotado', async t => {
    sinDB(t); const raiz = await temporal();
    const fila = proyectarFila('MOVIMIENTOS', raw('MOVIMIENTOS', 1));
    try {
        for (const caso of ['filas', 'paginas', 'final', 'disco', 'conteo', 'json', 'pasadas', 'corrupcion']) {
            const valores = [{ ...fila, ...(caso === 'paginas' ? { nombreComercial: 'x\n'.repeat(21000) } : {}) }];
            const { archivos, parametros } = await renderizar(raiz, 'MOVIMIENTOS', valores, {}, { limites: caso === 'final' ? { final: 100 } : caso === 'disco' ? { disco: 1500 } : {} });
            try {
                if (caso === 'filas') parametros.filas = 10001;
                if (caso === 'conteo') parametros.filas = 2;
                if (caso === 'json') await writeFile(archivos.rutas.spool, '{roto\n');
                if (caso === 'pasadas') {
                    const original = archivos.escritor;
                    archivos.escritor = async function (tipo) {
                        if (tipo === 'pdf') await writeFile(archivos.rutas.spool, JSON.stringify({ ...fila, nombreComercial: 'Cambio entre pasadas' }) + '\n');
                        return original.call(this, tipo);
                    };
                }
                if (caso === 'corrupcion') {
                    await generarPdf(parametros); await archivos.verificar('pdf');
                    await writeFile(archivos.rutas.pdf, 'corrupto'); await assert.rejects(archivos.verificar('pdf'));
                } else await assert.rejects(generarPdf(parametros), e => ['filas', 'paginas', 'final', 'disco'].includes(caso)
                    ? e.statusCode === 413 : caso === 'pasadas' ? /entre pasadas/.test(e.message) : true);
            } finally { await archivos.limpiar(); assert.deepEqual(await readdir(raiz), []); }
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('PDF backpressure por página: destino bloqueado detiene segunda pasada; sin bufferPages ni cache histórico', async t => {
    sinDB(t); const raiz = await temporal();
    const fila = proyectarFila('MOVIMIENTOS', raw('MOVIMIENTOS', 1));
    const { archivos, parametros } = await renderizar(raiz, 'MOVIMIENTOS', Array.from({ length: 30 }, (_, i) => ({ ...fila, idMovimiento: i + 1 })));
    let liberar, avisar, dibujadas = 0;
    const bloqueo = new Promise(r => { avisar = r; }), espera = new Promise(r => { liberar = r; });
    const original = archivos.escritor, text = PDFDocument.prototype.text;
    archivos.escritor = async function (tipo) {
        const e = await original.call(this, tipo);
        return tipo === 'pdf' ? { ...e, async escribir(chunk) { avisar(); await espera; return e.escribir(chunk); } } : e;
    };
    t.mock.method(PDFDocument.prototype, 'text', function (s, ...args) { if (/^Registro ID/.test(s)) dibujadas++; return text.call(this, s, ...args); });
    try {
        const trabajo = generarPdf(parametros); await bloqueo;
        for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r));
        assert.ok(dibujadas < 30); liberar(); await trabajo; assert.equal(dibujadas, 30);
    } finally { liberar(); await archivos.limpiar(); await rm(raiz, { recursive: true }); }
});

test('PDF fallos tardíos/cancelación: nunca headers/EXITO parcial, un terminal y limpieza; exceso agregado antes de detalle', async t => {
    const raiz = await temporal(), eventos = []; configurar(t, raiz, eventos);
    let cantidad = 30, nombre = 'DAÑO';
    t.mock.method(repo, 'resumen', async () => grupos('MOVIMIENTOS', cantidad));
    t.mock.method(repo, 'bloque', async (f, filtros, { cursor }) => cursor ? [] : Array.from({ length: cantidad }, (_, i) => ({ ...raw(f, cantidad - i), nombre_comercial: nombre })));
    const probe = await open(join(raiz, 'probe'), 'wx'), proto = Object.getPrototypeOf(probe); await probe.close(); await rm(join(raiz, 'probe'));
    const original = proto.writeFile; let buffers = 0, modo, abortar;
    t.mock.method(proto, 'writeFile', async function (chunk, ...args) {
        if (Buffer.isBuffer(chunk) && ++buffers === 3) {
            if (modo === 'cancelar') abortar.abort(cancelacionExportacion());
            if (modo === 'disco') throw Object.assign(new Error('ENOSPC sintético tardío'), { code: 'ENOSPC' });
        }
        return original.call(this, chunk, ...args);
    });
    try {
        for (modo of ['disco', 'cancelar', 'glifo', 'filas']) {
            buffers = 0; abortar = new AbortController(); nombre = modo === 'glifo' ? '😀' : 'DAÑO'; cantidad = modo === 'filas' ? 10001 : 30;
            const antes = eventos.length;
            await assert.rejects(servicio.preparar('MOVIMIENTOS', filtros('MOVIMIENTOS'), auditoria, { signal: abortar.signal }));
            assert.equal(eventos.length, antes + 1); assert.notEqual(eventos.at(-1).resultado, 'EXITO');
            assert.equal(eventos.at(-1).causa, modo === 'cancelar' ? 'CANCELACION_CLIENTE' : modo === 'filas' ? 'LIMITE_EXPORTACION' : 'ERROR_INTERNO');
            if (['disco', 'cancelar'].includes(modo)) assert.ok(buffers >= 3);
            assert.deepEqual(await readdir(raiz), []);
        }
        modo = 'glifo'; nombre = '😀'; cantidad = 1;
        const res = new PassThrough(); let error;
        res.status = () => assert.fail('Glifo inválido no emite headers');
        try {
            const antes = eventos.length;
            await controller.movimientos({ query: { formato: 'PDF', presentacion: 'TABULAR' }, contextoAuditoria: auditoria.contexto, usuario: actor }, res, e => { error = e; });
            assert.match(error.message, /Glifo PDF no representable/); assert.equal(eventos.length, antes + 1);
            assert.equal(eventos.at(-1).resultado, 'FALLO'); assert.deepEqual(await readdir(raiz), []);
        } finally { res.destroy(); }
    } finally { await rm(raiz, { recursive: true }); }
});

test('PDF: SQL pendiente conserva conexión/cupo; cancelación espera asentamiento y terminal único', async t => {
    const raiz = await temporal(), eventos = []; configurar(t, raiz, eventos);
    let avisar, resolver, activo = false;
    const inicio = new Promise(r => { avisar = r; });
    t.mock.method(db.sequelize, 'transaction', async (opts, callback) => { activo = true; try { return await callback({}); } finally { activo = false; } });
    t.mock.method(repo, 'resumen', async () => { avisar(); return new Promise(r => { resolver = r; }); });
    t.mock.method(repo, 'bloque', () => assert.fail('No detalle tras cancelar'));
    const abortar = new AbortController();
    try {
        const tarea = servicio.preparar('VENTAS', filtros('VENTAS'), auditoria, { signal: abortar.signal });
        const rechazo = assert.rejects(tarea, /Cancelación/); await inicio; abortar.abort(cancelacionExportacion());
        assert.equal(activo, true); assert.equal(eventos.length, 0); assert.equal((await readdir(raiz)).length, 1);
        await assert.rejects(servicio.preparar('VENTAS', filtros('VENTAS'), auditoria), /ocupada/);
        resolver([]); await rechazo; assert.equal(activo, false); assert.equal(eventos.length, 2);
        assert.ok(eventos.every(e => e.resultado !== 'EXITO')); assert.deepEqual(await readdir(raiz), []);
    } finally { await rm(raiz, { recursive: true }); }
});

test('PDF entrega bloqueada: timeout simulado destruye stream local y audita FALLO una sola vez', async t => {
    const raiz = await temporal(), eventos = [], timers = []; configurar(t, raiz, eventos);
    t.mock.method(repo, 'resumen', async () => []); t.mock.method(repo, 'bloque', async () => []);
    t.mock.method(globalThis, 'setTimeout', (callback, ms) => { const timer = { callback, ms }; timers.push(timer); return timer; });
    t.mock.method(globalThis, 'clearTimeout', () => {});
    const res = new PassThrough({ highWaterMark: 1 }); let avisar;
    const headers = new Promise(r => { avisar = r; }); res.status = () => res;
    res.set = h => { assert.equal(h['Content-Type'], MIME_PDF); avisar(); return res; };
    try {
        const tarea = controller.ventas({ query: { dia: '9999-12-31', formato: 'PDF', presentacion: 'TABULAR' }, contextoAuditoria: auditoria.contexto, usuario: actor }, res, () => assert.fail('No JSON'));
        await headers; assert.equal(eventos.length, 0); timers[1].callback(); await tarea;
        assert.equal(eventos.length, 1); assert.equal(eventos[0].causa, 'TIEMPO_AGOTADO'); assert.equal(eventos[0].resultado, 'FALLO');
        assert.equal(res.destroyed, true); assert.deepEqual(await readdir(raiz), []);
    } finally { res.destroy(); await rm(raiz, { recursive: true }); }
});

test('HTTP PDF localhost real: MIME/nombre/longitud, cuatro fuentes, permisos/HEAD, variantes 503, remoto/producción cerrados y terminal único', async t => {
    sinDB(t); t.mock.method(console, 'error', () => {});
    const raiz = await temporal(), eventos = []; const anterior = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
    t.after(() => { process.env.NODE_ENV = anterior; });
    t.mock.method(os, 'tmpdir', () => raiz); t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
    t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n, bsize: 1024n }));
    t.mock.method(authService, 'getSessionUsuario', async id => ({ ...actor, idRol: id, idUsuario: id }));
    let consultas = 0; t.mock.method(db.sequelize, 'transaction', async (opts, callback) => { consultas++; return callback({}); });
    t.mock.method(repo, 'resumen', async fuente => grupos(fuente, 0)); t.mock.method(repo, 'bloque', async () => []);
    let notificar, limpieza; t.mock.method(auditor, 'intentarRegistrar', async e => { eventos.push(e); notificar?.(); });
    const original = servicio.preparar;
    t.mock.method(servicio, 'preparar', async function (...args) { const a = await original.apply(this, args), limpiar = a.limpiar; a.limpiar = async () => { await limpiar(); limpieza?.(); }; return a; });
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    const solicitar = (fuente, rol = 1, method = 'GET') => fetch(`http://127.0.0.1:${server.address().port}/api/${fuente === 'MOVIMIENTOS' ? 'inventario/movimientos' : `reportes/${fuente.toLowerCase()}`}/exportar?${fuente === 'MOVIMIENTOS' ? '' : 'dia=9999-12-31&'}formato=PDF&presentacion=TABULAR`, {
        method, headers: rol ? { Cookie: `token=${generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 })}` } : {}, signal: AbortSignal.timeout(10000) });
    try {
        for (const fuente of fuentes) {
            const antesSql = consultas;
            assert.equal((await solicitar(fuente, null)).status, 401); assert.equal((await solicitar(fuente, 3)).status, 403);
            assert.equal((await solicitar(fuente, 2, 'HEAD')).status, ['VENTAS', 'COMPRAS'].includes(fuente) ? 403 : 405);
            const head = await solicitar(fuente, 1, 'HEAD'); assert.equal(head.status, 405); assert.equal(head.headers.get('allow'), 'GET'); assert.equal(consultas, antesSql);
            const antes = eventos.length, terminal = new Promise(r => { notificar = r; }), limpio = new Promise(r => { limpieza = r; });
            const res = await solicitar(fuente, ['PERDIDAS', 'MOVIMIENTOS'].includes(fuente) ? 2 : 1);
            assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), MIME_PDF);
            assert.match(res.headers.get('content-disposition'), /attachment; filename="cadefar-.*\.pdf"$/);
            assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
            const bytes = Buffer.from(await res.arrayBuffer()); assert.equal(Number(res.headers.get('content-length')), bytes.length); await leerPdf(bytes);
            await terminal; await limpio; assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).resultado, 'EXITO');
            assert.equal(eventos.at(-1).metadatos.formato, 'PDF'); assert.deepEqual(await readdir(raiz), []);
        }
        const antesSql = consultas;
        for (const formato of ['PDF', 'XLSX']) for (const fuente of fuentes.slice(0, 3)) {
            const q = v[`validateExportacion${nombres[fuente]}`]({ dia: '9999-12-31', formato, presentacion: 'ESTADISTICA', granularidad: 'DIA', grafico: 'BARRAS', metrica: fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE' });
            assert.ok(q.success); await assert.rejects(original.call(servicio, fuente, q.data, auditoria, { direccionRemota: '192.168.1.2' }), e => e.statusCode === 503);
        }
        assert.equal(consultas, antesSql);
        process.env.NODE_ENV = 'production'; assert.equal((await solicitar('VENTAS')).status, 503);
        process.env.NODE_ENV = 'development';
        await assert.rejects(original.call(servicio, 'VENTAS', filtros('VENTAS'), auditoria, { direccionRemota: '192.168.1.2' }), e => e.statusCode === 503);
        assert.equal(consultas, antesSql);
    } finally { await new Promise(r => server.close(r)); await rm(raiz, { recursive: true }); }
});
