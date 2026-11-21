import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { COLUMNAS_REPORTE, proyectarFila, crearConciliacion, filasEstadisticas } from '../src/business/services/reporte.plantillas.js';
import { materializarEstadisticas } from '../src/business/services/reporte.estadisticas.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'conjunta_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_conjunta_tests';
const { default: db } = await import('../src/data/models/index.js');
const { reporteExtraccionRepository: extraccion } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { reporteRepository: repo } = await import('../src/data/repositories/reporte.repository.js');
const { reporteExportacionService: servicio } = await import('../src/business/services/reporte.exportacion.service.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { app } = await import('../src/app.js');
const { reporteExportacionController: controller } = await import('../src/presentation/controllers/reporte-exportacion.controller.js');
const nombres = { VENTAS: 'Ventas', COMPRAS: 'Compras', PERDIDAS: 'Perdidas', MOVIMIENTOS: 'Movimientos' };
const compacto = s => String(s).normalize('NFC').replace(/\s/gu, '');
const dinero = n => `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
const aplanar = (obj, prefijo = '') => Object.entries(obj ?? {}).flatMap(([k, v]) => {
    const p = prefijo ? `${prefijo}.${k}` : k;
    return v !== null && typeof v === 'object' ? aplanar(v, p) : [[p, String(v)]];
});

// Mismos originales sintéticos para los tres formatos; agregados calculados en
// el fixture con BigInt, no SQL ejecutado ni datos operativos reales.
const fixture = fuente => {
    const rows = Array.from({ length: 4 }, (_, i) => {
        const id = 4 - i, fecha = i < 2 ? '1060-12-31' : '1000-01-01';
        const categoria = ['CONFIRMADA', 'PENDIENTE', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR'][i];
        return { id_venta: id, id_compra: id, id_proveedor_laboratorio: 17,
            id_movimiento: id, id_existencia: 18, id_medicamento: 19, id_usuario: 20,
            categoria, estado_operacion: fuente === 'VENTAS' ? categoria.startsWith('ANULADA') ? 'ANULADA' : categoria : i % 2 ? 'ANULADA' : 'CONFIRMADA',
            total: dinero(1234567890123456789000n + BigInt(id)),
            fecha_referencia: `${fecha} 12:34:56`, fecha_compra: fecha, fecha_registro: '1000-01-01 00:00:00',
            fecha_venta: categoria === 'PENDIENTE' || categoria === 'ANULADA_SIN_CONFIRMAR' ? null : `${fecha} 12:34:56`,
            fecha_anulacion: i > 1 ? '9999-12-31 23:59:59' : null,
            fecha_movimiento: `${fecha} 12:34:56`, direccion: 'SALIDA', motivo: i % 2 ? 'DAÑO' : 'VENCIMIENTO',
            cantidad: i === 0 ? '9007199254740993' : '1', costo_unitario_aplicado: '0.005000',
            codigo_existencia: `0000${id}`, codigo_medicamento: '+001',
            nombre_comercial: `  =DAÑO;" ácido ${id} <script>literal</script>`, nombre_usuario: null,
            _cursor_fecha: fuente === 'COMPRAS' ? fecha : `${fecha} 12:34:56.123456`, _cursor_id: String(id) };
    });
    if (fuente === 'MOVIMIENTOS') return { rows, grupos: [{ cantidad: '4' }] };
    const sumar = (entrada, temporal) => {
        const mapa = new Map();
        for (const r of entrada) {
            const categoria = fuente === 'VENTAS' ? r.categoria : fuente === 'COMPRAS' ? r.estado_operacion : r.motivo;
            const etiqueta = r._cursor_fecha.slice(0, 4), clave = categoria + (temporal ? etiqueta : '');
            const g = mapa.get(clave) ?? { categoria, estado_operacion: categoria, motivo: categoria, etiqueta, n: 0n, q: 0n, c: 0n };
            g.n++; g.q += BigInt(r.cantidad);
            g.c += fuente === 'PERDIDAS' ? (BigInt(r.cantidad) * 5000n + 5000n) / 10000n : BigInt(r.total.replace('.', ''));
            mapa.set(clave, g);
        }
        return [...mapa.values()].map(g => ({ ...g, cantidad: String(g.n), importe: dinero(g.c),
            cantidad_retiros: String(g.n), cantidad_retirada: String(g.q), perdida: dinero(g.c) }));
    };
    return { rows, grupos: sumar(rows, false), temporales: sumar(rows, true) };
};

// Parseo independiente del serializer, incluyendo comillas dobles, ; y CR/LF.
const csv = bytes => {
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
    const s = bytes.toString('utf8').slice(1), rows = []; let i = 0;
    while (i < s.length) {
        const row = [];
        for (;;) {
            assert.equal(s[i++], '"'); let valor = '';
            for (;;) {
                assert.ok(i < s.length, 'CSV truncado');
                const c = s[i++];
                if (c !== '"') valor += c;
                else if (s[i] === '"') { valor += '"'; i++; }
                else break;
            }
            row.push(valor);
            if (s[i] === ';') { i++; continue; }
            assert.equal(s.slice(i, i + 2), '\r\n'); i += 2; break;
        }
        rows.push(row);
    }
    return rows;
};
const leerPdf = async bytes => {
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true });
    const doc = await task.promise, items = [];
    try {
        for (let n = 1; n <= doc.numPages; n++) {
            const p = await doc.getPage(n), content = await p.getTextContent({ disableNormalization: true });
            assert.ok(content.items.some(x => x.str === `Página ${n} de ${doc.numPages}`));
            items.push(...content.items.filter(x => x.str && !/^CADEFAR \||^Página \d+ de \d+$|^Detalle completo|^Tabla completa|^Fila \||^categoría \|/.test(x.str)));
            p.cleanup();
        }
        return { items, texto: items.map(x => x.str).join('\n'), paginas: doc.numPages };
    } finally { await doc.cleanup(); await task.destroy(); }
};

test('Fase 9: 21 descargas HTTP LOCAL con fixtures comunes, bloques, igualdad íntegra CSV/XLSX/PDF y auditor exclusivo caído', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido'));
    const raiz = await mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-test-conjunta-'));
    await writeFile(join(raiz, 'ajeno'), 'preservado');
    const anterior = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
    t.after(() => { process.env.NODE_ENV = anterior; });
    t.mock.method(os, 'tmpdir', () => raiz);
    t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
    t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n, bsize: 1024n }));
    t.mock.method(authService, 'getSessionUsuario', async id => ({ idUsuario: id, idRol: id, nombreUsuario: 'actor' }));
    let activo = false, bloques = 0, consultas = 0, capturado, limpiarTerminado, falloAuditor = false;
    const eventos = [], diagnosticos = [];
    t.mock.method(console, 'error', e => diagnosticos.push(e));
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => {
        assert.equal(opts.isolationLevel, 'REPEATABLE READ'); activo = true; consultas++;
        try { return await cb({ snapshot: true }); } finally { activo = false; }
    });
    t.mock.method(extraccion, 'resumen', async fuente => fixture(fuente).grupos);
    t.mock.method(extraccion, 'bloque', async (fuente, f, { transaction, cursor, limite }) => {
        assert.ok(activo && transaction.snapshot); assert.equal(limite, 1000); bloques++;
        return fixture(fuente).rows.filter(r => !cursor || r._cursor_fecha < cursor.fecha ||
            (r._cursor_fecha === cursor.fecha && BigInt(r._cursor_id) < BigInt(cursor.id))).slice(0, 2);
    });
    for (const fuente of ['VENTAS', 'COMPRAS', 'PERDIDAS']) t.mock.method(repo, `estadisticas${nombres[fuente]}`, async (f, opts) => {
        assert.ok(activo && opts.transaction.snapshot); return fixture(fuente);
    });
    t.mock.method(auditor, 'intentarRegistrar', async e => {
        assert.equal(activo, false); assert.equal(capturado.res.writableFinished, true);
        eventos.push(e); if (falloAuditor) throw new Error('Auditor sintético caído');
    });
    const preparar = servicio.preparar;
    t.mock.method(servicio, 'preparar', async function (...args) {
        const a = await preparar.apply(this, args); capturado.artefacto = a;
        const limpiar = a.limpiar;
        a.limpiar = async () => { await limpiar(); limpiarTerminado(); };
        return a;
    });
    // Observar finish del ServerResponse real, no equipararlo a recepción humana.
    const server = app.listen(0, '127.0.0.1');
    server.on('request', (req, res) => { capturado.res = res; });
    await new Promise(r => server.once('listening', r));
    try {
        for (const fuente of Object.keys(nombres)) for (const presentacion of fuente === 'MOVIMIENTOS' ? ['TABULAR'] : ['TABULAR', 'ESTADISTICA']) {
            let metadataComun;
            for (const formato of ['CSV', 'XLSX', 'PDF']) await t.test(`${fuente}/${presentacion}/${formato}`, async () => {
                capturado = {}; bloques = 0; const antes = eventos.length, sqlAntes = consultas;
                // Auditor caído en los tres formatos, sin destruir descarga,
                // repetir generación ni fabricar persistencia confirmada.
                falloAuditor = formato === 'PDF' || (fuente === 'VENTAS' && formato === 'CSV') || (fuente === 'COMPRAS' && formato === 'XLSX');
                const limpio = new Promise(r => { limpiarTerminado = r; });
                const q = new URLSearchParams({ formato, presentacion, ...(fuente === 'MOVIMIENTOS' ? {} : { desde: '1000-01-01', hasta: '1060-12-31' }),
                    ...(presentacion === 'ESTADISTICA' ? { granularidad: 'ANIO', ...(formato === 'CSV' ? {} : { grafico: 'LINEAS', metrica: fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE' }) } : {}) });
                const ruta = fuente === 'MOVIMIENTOS' ? 'inventario/movimientos' : `reportes/${fuente.toLowerCase()}`;
                const rol = ['PERDIDAS', 'MOVIMIENTOS'].includes(fuente) ? 2 : 1;
                const res = await fetch(`http://127.0.0.1:${server.address().port}/api/${ruta}/exportar?${q}`, {
                    headers: { Cookie: `token=${generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 })}` }, signal: AbortSignal.timeout(30000) });
                assert.equal(res.status, 200); const bytes = Buffer.from(await res.arrayBuffer()); await limpio;
                assert.equal(bytes.length, Number(res.headers.get('content-length')));
                assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
                assert.equal(res.headers.get('content-type'), { CSV: 'text/csv; charset=utf-8', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', PDF: 'application/pdf' }[formato]);
                assert.match(res.headers.get('content-disposition'), new RegExp(`^attachment; filename="cadefar-${fuente.toLowerCase()}-${presentacion.toLowerCase()}-\\d{8}-\\d{6}-[a-f0-9]{32}\\.${formato.toLowerCase()}"$`));
                assert.equal(consultas, sqlAntes + 1); assert.equal(bloques, presentacion === 'TABULAR' ? 3 : 0);
                assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).resultado, 'EXITO');
                assert.equal(eventos.at(-1).metadatos.estadoEntrega, 'FINALIZADA_SERVIDOR');
                const f = fixture(fuente), a = capturado.artefacto;
                const esperado = presentacion === 'TABULAR' ? f.rows.map(r => proyectarFila(fuente, r)) : [...filasEstadisticas(materializarEstadisticas(fuente,
                    { periodo: { modalidad: 'PERIODO', desde: '1000-01-01', hasta: '1060-12-31', zonaHoraria: 'America/La_Paz' }, granularidad: 'ANIO' }, f))];
                const columnas = COLUMNAS_REPORTE[presentacion === 'TABULAR' ? fuente : 'ESTADISTICA'];
                if (metadataComun) assert.deepEqual(a.metadata, metadataComun); else metadataComun = a.metadata;
                if (presentacion === 'TABULAR') assert.deepEqual(a.metadata.resumen, crearConciliacion(fuente, f.grupos).resumen);
                assert.equal(a.cantidadFilas, esperado.length); assert.equal(eventos.at(-1).metadatos.cantidadFilas, String(esperado.length));
                if (formato === 'CSV') {
                    const tabla = csv(bytes); assert.deepEqual(tabla.shift(), columnas);
                    assert.deepEqual(tabla, esperado.map(row => columnas.map(c => {
                        const s = row[c] == null ? '' : String(row[c]);
                        return /^\s*[=+]/u.test(s) ? "'" + s : s;
                    })));
                } else if (formato === 'XLSX') {
                    const libro = new ExcelJS.Workbook(); await libro.xlsx.load(bytes);
                    const hoja = libro.getWorksheet(presentacion === 'TABULAR' ? 'Detalle' : 'Estadisticas');
                    assert.equal(hoja.rowCount, esperado.length + 1);
                    esperado.forEach((row, i) => columnas.forEach((c, j) => {
                        const celda = hoja.getRow(i + 2).getCell(j + 1);
                        assert.equal(celda.value, row[c] == null ? null : String(row[c])); assert.equal(celda.numFmt, '@');
                        assert.equal(celda.formula, undefined); assert.equal(celda.hyperlink, undefined);
                    }));
                    const resumen = new Map(libro.getWorksheet('Resumen').getSheetValues().filter(Boolean).map(r => [r[1], r[2]]));
                    for (const [k, valor] of aplanar(a.metadata.resumen, 'resumen')) assert.equal(resumen.get(k), valor);
                    if (presentacion === 'ESTADISTICA') {
                        for (const [k, valor] of aplanar(a.metadata.distribuciones, 'distribuciones')) assert.equal(resumen.get(k), valor);
                        assert.equal(libro.getWorksheet('Grafica').getImages().length, 2);
                    }
                } else {
                    const pdf = await leerPdf(bytes); assert.ok(pdf.paginas > 1);
                    for (const [k, valor] of aplanar(a.metadata.resumen)) assert.ok(compacto(pdf.texto).includes(compacto(`${k}: ${valor}`)));
                    if (presentacion === 'ESTADISTICA') {
                        const texto = compacto(pdf.texto);
                        esperado.forEach((r, i) => assert.ok(texto.includes(compacto(`${i + 1}|${r.intervalo}|${r.desde}|${r.hasta}|${r.parcial}${r.categoria}|${r.metrica}|${r.unidad}|${r.valor}`))));
                        for (const d of a.metadata.distribuciones) {
                            assert.ok(texto.includes(compacto(`${d.metrica}/${d.unidad}/total informativo: ${d.total}`)));
                            for (const c of d.categorias) assert.ok(texto.includes(compacto(`${c.categoria}: ${c.valor}`)));
                        }
                    } else {
                        const inicios = pdf.items.flatMap((x, i) => /^Registro ID \d+$/.test(x.str) ? [i] : []);
                        assert.equal(inicios.length, esperado.length);
                        esperado.forEach((row, i) => {
                            const items = pdf.items.slice(inicios[i], inicios[i + 1] ?? pdf.items.length), porX = new Map();
                            assert.equal(items[0].str, `Registro ID ${row[columnas[0]]}`);
                            for (const x of items) porX.set(x.transform[4], (porX.get(x.transform[4]) ?? '') + x.str);
                            const texto = compacto([...porX.values()].join('\n'));
                            for (const c of columnas) assert.ok(texto.includes(compacto(row[c] ?? '—')), `${c} en registro ${i}`);
                        });
                    }
                }
                assert.deepEqual(await readdir(raiz), ['ajeno']);
            });
        }
        assert.equal(eventos.length, 21);
        assert.equal(diagnosticos.filter(e => e.codigo === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA').length, 11);
        assert.equal(await readFile(join(raiz, 'ajeno'), 'utf8'), 'preservado');
    } finally { await new Promise(r => server.close(r)); await rm(raiz, { recursive: true }); }
});

test('Fase 9: cupo común CSV/XLSX/PDF retenido durante entrega bloqueada; 503 Retry-After sin SQL ni cola, EXITO solo tras finish', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido'));
    const raiz = await mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-test-cupo-'));
    const eventos = []; let consultas = 0;
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => { consultas++; return cb({}); });
    t.mock.method(extraccion, 'resumen', async () => fixture('VENTAS').grupos);
    t.mock.method(extraccion, 'bloque', async (fuente, f, opts) => opts.cursor ? [] : fixture('VENTAS').rows);
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    try {
        for (const [i, formato] of ['CSV', 'XLSX', 'PDF'].entries()) {
            const res = new PassThrough({ highWaterMark: 1 });
            let notificar; const headers = new Promise(r => { notificar = r; });
            res.status = () => res; res.set = h => { assert.ok(h['Content-Length']); notificar(); return res; };
            const req = { query: { desde: '1000-01-01', hasta: '1060-12-31', formato, presentacion: 'TABULAR' },
                usuario: { idUsuario: 1, idRol: 1 }, contextoAuditoria: { correlacion: String(i + 1).repeat(32) } };
            const antes = eventos.length, sqlAntes = consultas;
            const entrega = controller.ventas(req, res, e => assert.fail(e.message));
            try {
                await headers;
                assert.equal(res.writableFinished, false); assert.equal(eventos.length, antes);
                const ocupado = new PassThrough(); let status, error, retry;
                ocupado.status = n => { status = n; return ocupado; };
                ocupado.set = (k, v) => { if (k === 'Retry-After') retry = v; return ocupado; };
                try {
                    // Otro formato/fuente comparte el mismo cupo de instancia.
                    await controller.compras({ ...req, query: { ...req.query, formato: ['XLSX', 'PDF', 'CSV'][i] },
                        contextoAuditoria: { correlacion: String(i + 4).repeat(32) } }, ocupado, e => { error = e; status = e.statusCode; });
                    assert.equal(status, 503); assert.match(error.message, /ocupada/); assert.equal(retry, '5');
                    assert.equal(consultas, sqlAntes + 1); assert.equal(eventos.length, antes + 1);
                    assert.equal(eventos.at(-1).resultado, 'RECHAZADO');
                    assert.equal(eventos.at(-1).causa, 'RECURSO_NO_DISPONIBLE');
                    assert.equal((await readdir(raiz)).length, 1, 'El trabajo en entrega conserva sus archivos');
                } finally { ocupado.destroy(); }
                res.resume(); await entrega;
                assert.equal(res.writableFinished, true); assert.equal(eventos.length, antes + 2);
                assert.equal(eventos.at(-1).resultado, 'EXITO');
                assert.equal(eventos.at(-1).metadatos.estadoEntrega, 'FINALIZADA_SERVIDOR');
                assert.equal(consultas, sqlAntes + 1, 'La solicitud rechazada no quedó en cola');
                assert.deepEqual(await readdir(raiz), []);
            } finally { res.destroy(); await entrega; }
        }
    } finally { await rm(raiz, { recursive: true }); }
});
