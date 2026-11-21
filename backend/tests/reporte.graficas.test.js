import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile, open } from 'node:fs/promises';
import { join, posix } from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'node:stream';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { crearArchivosReporte } from '../src/shared/utils/reporte-archivos.js';
import { planGrafica, coordenadaGrafica, svgPanel, rasterizadorGrafica, comprobarPng, validarTextoEstadistico } from '../src/shared/utils/reporte-grafica.js';
import { generarPdf, FUENTE_PDF } from '../src/shared/utils/reporte-pdf.js';
import { generarXlsx } from '../src/shared/utils/reporte-xlsx.js';
import { materializarEstadisticas } from '../src/business/services/reporte.estadisticas.js';
import { filasEstadisticas, COLUMNAS_REPORTE } from '../src/business/services/reporte.plantillas.js';
const JSZip = createRequire(import.meta.resolve('exceljs'))('jszip');
const PNG = createRequire(import.meta.resolve('pdfkit'))('png-js');
process.env.NODE_ENV = 'test'; process.env.DB_NAME_TEST = 'graficas_sin_conexion'; process.env.JWT_SECRET = 'clave_sintetica_graficas_tests';
const { default: db } = await import('../src/data/models/index.js');
const { reporteExportacionService: servicio, cancelacionExportacion } = await import('../src/business/services/reporte.exportacion.service.js');
const { reporteRepository: repo } = await import('../src/data/repositories/reporte.repository.js');
const { reporteExtraccionRepository: extraccion } = await import('../src/data/repositories/reporte.extraccion.repository.js');
const { bitacoraAuditoriaService: auditor } = await import('../src/business/services/bitacora-auditoria.service.js');
const { reporteValidator: v } = await import('../src/business/validators/reporte.validator.js');
const { reporteExportacionController: controller } = await import('../src/presentation/controllers/reporte-exportacion.controller.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const fuentes = ['VENTAS', 'COMPRAS', 'PERDIDAS'], graficas = ['BARRAS', 'LINEAS', 'SECTORES'];
const nombres = { VENTAS: 'Ventas', COMPRAS: 'Compras', PERDIDAS: 'Perdidas' };
const contexto = { contexto: { correlacion: 'd'.repeat(32) }, responsable: { idUsuario: 1, idRol: 1 } };
const temporal = () => mkdtemp(join(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : os.tmpdir(), 'cadefar-test-graficas-'));
const filtros = (fuente, n = 1, grafico = 'BARRAS', formato = 'PDF') => ({
    formato, presentacion: 'ESTADISTICA', granularidad: 'ANIO', grafico, metrica: fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE',
    periodo: { modalidad: 'PERIODO', desde: '1000-01-01', hasta: `${999 + n}-12-31`, zonaHoraria: 'America/La_Paz' }
});
const agregados = (fuente, vacio = false, enorme = false) => {
    if (vacio) return { grupos: [], temporales: [] };
    const g = fuente === 'PERDIDAS'
        ? [{ motivo: 'VENCIMIENTO', cantidad_retiros: '1', cantidad_retirada: enorme ? '9007199254740993' : '1', perdida: enorme ? '12345678901234567890.12' : '0.01' },
            { motivo: 'DAÑO', cantidad_retiros: '1', cantidad_retirada: '1', perdida: '0.01' }]
        : [{ categoria: 'CONFIRMADA', estado_operacion: 'CONFIRMADA', cantidad: '1', importe: enorme ? '12345678901234567890.12' : '0.01' },
            { categoria: fuente === 'VENTAS' ? 'PENDIENTE' : 'ANULADA', estado_operacion: 'ANULADA', cantidad: '1', importe: '0.01' }];
    return { grupos: g, temporales: g.map(x => ({ ...x, etiqueta: '1000' })) };
};
const preparar = async (raiz, fuente, f, vacio = false, enorme = false, limites = {}) => {
    const metadata = materializarEstadisticas(fuente, f, agregados(fuente, vacio, enorme));
    const archivos = await crearArchivosReporte(raiz, () => {}, limites), e = await archivos.escritor('spool');
    const rows = [...filasEstadisticas(metadata)];
    for (const row of rows) await e.escribir(JSON.stringify(row) + '\n'); await e.cerrar();
    return { archivos, fuente, filtros: f, metadata, generacion: '9999-12-31 23:59:59', filas: rows.length, comprobar() {} };
};
const generar = o => o.filtros.formato === 'PDF' ? generarPdf(o) : generarXlsx(o);
const sinDB = t => { t.mock.method(db.sequelize.connectionManager, 'getConnection', () => assert.fail('MySQL prohibido')); };
const pngReal = async bytes => {
    comprobarPng(bytes); const png = new PNG(bytes); assert.equal(png.width, 1200); assert.equal(png.height, 800);
    const pixels = await png.decode(); assert.equal(pixels.length, 1200 * 800 * 4);
    assert.ok(pixels.some(x => x !== 255), 'Imagen no vacía');
};
const comprobarLayoutSvg = svg => {
    const doc = new PDFDocument({ autoFirstPage: false, font: FUENTE_PDF, fontLayoutCache: false });
    try {
        for (const match of svg.matchAll(/<text ([^>]+)>([^<]*)<\/text>/g)) {
            const attrs = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
            const size = Number(attrs['font-size']), x = Number(attrs.x), y = Number(attrs.y);
            assert.ok(size * (595.28 - 24 * 72 / 25.4) / 1200 >= 8, 'Texto raster legible al incrustar en A4');
            const s = match[2].replace(/&(amp|lt|gt|quot|apos);/g, (_, c) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[c]);
            doc.fontSize(size); const width = doc.widthOfString(s, { features: [] });
            const inicio = attrs['text-anchor'] === 'middle' ? x - width / 2 : x;
            assert.ok(inicio >= 0 && inicio + width <= 1200, s); assert.ok(y - size * 1.1 >= 0 && y + size * .4 <= 800, s);
        }
    } finally { doc.destroy(); }
};
const leerPdf = async (ruta, filas, paneles) => {
    const bytes = await readFile(ruta), task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true });
    const pdf = await task.promise; let imagenes = 0; const textos = [];
    try {
        assert.ok(pdf.numPages <= 500);
        for (let n = 1; n <= pdf.numPages; n++) {
            const p = await pdf.getPage(n); assert.deepEqual(p.view, [0, 0, 595.28, 841.89]);
            assert.deepEqual(await p.getAnnotations(), []);
            const content = await p.getTextContent({ disableNormalization: true });
            const textosPagina = content.items.filter(x => x.str !== undefined);
            for (const x of textosPagina) {
                assert.ok(x.transform[0] >= 8); assert.ok(x.transform[4] >= 34 - .1);
                assert.ok(x.transform[4] + x.width <= 595.28 - 34 + .1, x.str);
                assert.ok(x.transform[5] >= 34 && x.transform[5] <= 841.89 - 34);
            }
            const texto = textosPagina.map(x => x.str).join('\n'); assert.ok(texto.includes(`Página ${n} de ${pdf.numPages}`)); textos.push(texto);
            const ops = await p.getOperatorList();
            for (let i = 0; i < ops.fnArray.length; i++) if (ops.fnArray[i] === OPS.paintImageXObject) {
                assert.equal(ops.argsArray[i][1], 1200); assert.equal(ops.argsArray[i][2], 800); imagenes++;
            }
            p.cleanup();
        }
        assert.equal(imagenes, paneles, 'PNG realmente incrustadas');
        const texto = textos.join('\n'), compacto = texto.split('\n').filter(s => !/^CADEFAR \||^Página \d+ de \d+$|^Tabla completa de series|^Fila \||^categoría \|/.test(s)).join('').replace(/\s/gu, '');
        for (const [i, fila] of filas.entries()) {
            const banda = `${i + 1} | ${fila.intervalo} | ${fila.desde} | ${fila.hasta} | ${fila.parcial}`;
            assert.ok(compacto.includes((banda + `${fila.categoria}|${fila.metrica}|${fila.unidad}|${fila.valor}`).replace(/\s/gu, '')), banda);
        }
        assert.match(texto, /America\/La_Paz/); assert.match(texto, /todos/); assert.match(texto, /9999-12-31 23:59:59/);
        assert.match(texto, /Indicadores/); assert.match(texto, /Distribuciones/); assert.match(texto, /Tabla completa/);
        assert.ok(texto.indexOf('Indicadores /') < texto.indexOf('Distribuciones /'));
        assert.doesNotMatch(bytes.toString('latin1'), /\/JavaScript|\/URI\b|\/Launch|\/Annots/);
        return { texto, paginas: pdf.numPages };
    } finally { await pdf.cleanup(); await task.destroy(); }
};
const leerXlsx = async (ruta, filas, paneles) => {
    const libro = new ExcelJS.Workbook(); await libro.xlsx.readFile(ruta);
    assert.deepEqual(libro.worksheets.map(h => h.name), ['Resumen', 'Estadisticas', 'Grafica']);
    const tabla = libro.getWorksheet('Estadisticas'); assert.equal(tabla.rowCount, filas.length + 1);
    assert.deepEqual(tabla.getRow(1).values.slice(1), COLUMNAS_REPORTE.ESTADISTICA);
    filas.forEach((fila, i) => {
        assert.deepEqual(tabla.getRow(i + 2).values.slice(1), COLUMNAS_REPORTE.ESTADISTICA.map(c => String(fila[c])));
        tabla.getRow(i + 2).eachCell(c => { assert.equal(c.type, ExcelJS.ValueType.String); assert.equal(c.numFmt, '@'); assert.equal(c.formula, undefined); });
    });
    assert.equal(libro.getWorksheet('Grafica').getImages().length, paneles);
    const zip = await JSZip.loadAsync(await readFile(ruta), { checkCRC32: true });
    const images = Object.keys(zip.files).filter(n => /^xl\/media\/.*\.png$/.test(n)); assert.equal(images.length, paneles);
    for (const image of images) await pngReal(await zip.file(image).async('nodebuffer'));
    let relaciones = 0;
    for (const nombre of Object.keys(zip.files).filter(n => /\.xml$|\.rels$/.test(n))) {
        const xml = await zip.file(nombre).async('string'); assert.doesNotMatch(xml, /<f[ >]|<hyperlink[ >]|TargetMode="External"/);
        if (nombre.endsWith('.rels')) for (const match of xml.matchAll(/<Relationship\b[^>]*Target="([^"]+)"[^>]*\/>/g)) {
            const base = posix.dirname(nombre).replace(/\/_rels$/, '').replace(/^_rels$/, '');
            const target = posix.normalize(posix.join(base, match[1])); assert.ok(zip.file(target), target);
            if (target.startsWith('xl/media/')) relaciones++;
        }
    }
    assert.equal(relaciones, paneles);
    const dibujo = await zip.file('xl/drawings/drawing1.xml').async('string');
    assert.equal((dibujo.match(/<xdr:pic>/g) ?? []).length, paneles);
    assert.match(await zip.file('xl/worksheets/sheet3.xml').async('string'), /<drawing r:id="rId/);
    assert.match(await zip.file('[Content_Types].xml').async('string'), /image\/png/);
    const resumen = JSON.stringify(libro.getWorksheet('Resumen').getSheetValues());
    assert.match(resumen, /CADEFAR/); assert.match(resumen, /America\/La_Paz/); assert.match(resumen, /todos/); assert.match(resumen, /9999-12-31 23:59:59/);
    return libro;
};

test('Fase 8 matriz real: tres fuentes × tres gráficas × PDF/XLSX, vacío y enormes; tabla/distribuciones completas, PNG y OOXML', async t => {
    sinDB(t); const raiz = await temporal();
    try {
        for (const fuente of fuentes) for (const grafico of graficas) for (const formato of ['PDF', 'XLSX']) for (const vacio of [false, true]) {
            const o = await preparar(raiz, fuente, filtros(fuente, 1, grafico, formato), vacio, true);
            try {
                await generar(o); await o.archivos.verificar(formato.toLowerCase());
                const rows = [...filasEstadisticas(o.metadata)];
                const artefacto = formato === 'PDF' ? (await leerPdf(o.archivos.rutas.pdf, rows, 1)).texto
                    : JSON.stringify((await leerXlsx(o.archivos.rutas.xlsx, rows, 1)).getWorksheet('Resumen').getSheetValues());
                for (const d of o.metadata.distribuciones) for (const c of d.categorias) assert.ok(artefacto.includes(c.valor));
                if (vacio) assert.match(artefacto, /Sin operaciones/);
                if (formato === 'PDF' && vacio) assert.match(artefacto, /S=0.00/);
            } finally { await o.archivos.limpiar(); }
        }
        assert.deepEqual(await readdir(raiz), []);
    } finally { await rm(raiz, { recursive: true }); }
});

test('Paneles 60/61/1200 sin muestreo, escala común y extremos civiles; geometría BigInt, ceros, marcadores y sectores del período', async t => {
    sinDB(t); const raiz = await temporal();
    try {
        for (const n of [1, 60, 61, 1200]) for (const grafico of ['BARRAS', 'LINEAS']) {
            const f = filtros('VENTAS', n, grafico), data = materializarEstadisticas('VENTAS', f, agregados('VENTAS', false, true));
            const p = planGrafica(data, f); assert.equal(p.paneles, Math.ceil(n / 60)); assert.equal(p.referencia, '12345678901234567890.12'); assert.equal(p.resolucion, true);
            for (let panel = 0; panel < p.paneles; panel++) {
                const svg = svgPanel(data, f, p, panel);
                comprobarLayoutSvg(svg);
                assert.match(svg, /S=12345678901234567890.12/); assert.match(svg, /inferiores a resolución/);
                if (grafico === 'LINEAS') {
                    const puntos = [...svg.matchAll(/<polyline points="([^"]*)"/g)];
                    assert.equal(puntos.length, 4); assert.equal(puntos[0][1].split(' ').length, Math.min(60, n - panel * 60));
                } else assert.equal((svg.match(/<rect x=/g) ?? []).length, Math.min(60, n - panel * 60) * 4 + 4);
            }
        }
        assert.equal(coordenadaGrafica(1n, 1000000000000000000n), 0);
        assert.equal(coordenadaGrafica(1n, 3n), .333333); assert.equal(coordenadaGrafica(0n, 0n), 0);
        const f = filtros('PERDIDAS', 61, 'SECTORES'), data = materializarEstadisticas('PERDIDAS', f, agregados('PERDIDAS'));
        const p = planGrafica(data, f); assert.equal(p.paneles, 1); assert.equal(p.referencia, '0.02');
        const svg = svgPanel(data, f, p, 0); comprobarLayoutSvg(svg); assert.equal((svg.match(/<path d="M600/g) ?? []).length, 2); assert.doesNotMatch(svg, /%|porcentaje automático/);
        // Archivos completos reales también en el máximo lógico de intervalos.
        for (const n of [60, 61, 1200]) for (const formato of ['PDF', 'XLSX']) {
            const o = await preparar(raiz, 'VENTAS', filtros('VENTAS', n, 'LINEAS', formato));
            try {
                await generar(o); const rows = [...filasEstadisticas(o.metadata)], paneles = Math.ceil(n / 60);
                if (formato === 'PDF') await leerPdf(o.archivos.rutas.pdf, rows, paneles);
                else await leerXlsx(o.archivos.rutas.xlsx, rows, paneles);
            } finally { await o.archivos.limpiar(); }
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('PNG real independiente, CRC/corrupción/dimensiones/límites y texto con Noto Sans: DAÑO, acentos/adversarial; glifos no representables', async t => {
    sinDB(t);
    validarTextoEstadistico('DAÑO áéíóú Ω Ж é =1+1 <script> https://invalid.test');
    for (const s of ['😀', '漢', '\ud800', '\t', '\u0000', '\u202e']) assert.throws(() => validarTextoEstadistico(s), /no representable/);
    const f = filtros('PERDIDAS'), data = materializarEstadisticas('PERDIDAS', f, agregados('PERDIDAS'));
    const png = await rasterizadorGrafica.png(svgPanel(data, f, planGrafica(data, f), 0), () => {}); await pngReal(png);
    const roto = Buffer.from(png); roto[roto.length - 15] ^= 1; assert.throws(() => comprobarPng(roto), /CRC|PNG/);
    assert.throws(() => comprobarPng(Buffer.alloc(8 * 1024 * 1024 + 1)), e => e.statusCode === 413);
    const raiz = await temporal();
    try {
        for (const formato of ['PDF', 'XLSX']) {
            const o = await preparar(raiz, 'PERDIDAS', filtros('PERDIDAS', 1, 'BARRAS', formato));
            o.generacion = 'Texto largo íntegro ' + 'áéíóú DAÑO =1+1 <script> https://invalid.test '.repeat(30);
            try {
                await generar(o);
                const rows = [...filasEstadisticas(o.metadata)];
                if (formato === 'PDF') {
                    const r = await leerPdfSimple(o.archivos.rutas.pdf);
                    assert.equal((r.replace(/\s/gu, '').match(/áéíóúDAÑO=1\+1<script>https:\/\/invalid.test/g) ?? []).length, 30);
                } else {
                    const libro = new ExcelJS.Workbook(); await libro.xlsx.readFile(o.archivos.rutas.xlsx);
                    assert.equal(libro.getWorksheet('Resumen').getRow(7).getCell(2).value, o.generacion);
                    assert.equal(rows.length, 6);
                }
            } finally { await o.archivos.limpiar(); }
            const malo = await preparar(raiz, 'PERDIDAS', filtros('PERDIDAS', 1, 'BARRAS', formato)); malo.generacion = '😀';
            try { await assert.rejects(generar(malo), /no representable/); } finally { await malo.archivos.limpiar(); }
        }
    } finally { await rm(raiz, { recursive: true }); }
});
const leerPdfSimple = async ruta => {
    const task = getDocument({ data: new Uint8Array(await readFile(ruta)), useSystemFonts: false, isEvalSupported: false, disableFontFace: true });
    const doc = await task.promise; let texto = '';
    try { for (let n = 1; n <= doc.numPages; n++) { const p = await doc.getPage(n); texto += (await p.getTextContent()).items.map(x => x.str ?? '').join(''); p.cleanup(); } return texto; }
    finally { await doc.cleanup(); await task.destroy(); }
};

test('Cuotas compartidas, límites, corrupción de spool/PNG/artefacto, rasterización/incrustación fallida y cleanup exclusivo', async t => {
    sinDB(t); const raiz = await temporal(); await writeFile(join(raiz, 'ajeno'), 'preservado');
    const rasterizar = rasterizadorGrafica.png;
    try {
        for (const formato of ['PDF', 'XLSX']) for (const caso of ['final', 'disco', 'spool', 'conteo', 'raster', 'png', 'embedding', 'artefacto', 'intervalos', 'series']) {
            const o = await preparar(raiz, 'VENTAS', filtros('VENTAS', 1, 'BARRAS', formato), false, false,
                caso === 'final' ? { final: 100 } : caso === 'disco' ? { disco: 5000 } : {});
            const originalImage = PDFDocument.prototype.image, originalAddImage = ExcelJS.Workbook.prototype.addImage;
            try {
                if (caso === 'spool') await writeFile(o.archivos.rutas.spool, JSON.stringify({ valor: '0.00' }) + '\n');
                if (caso === 'conteo') o.filas++;
                if (caso === 'intervalos') o.metadata.intervalos = Array.from({ length: 1201 }, () => o.metadata.intervalos[0]);
                if (caso === 'series') o.metadata.series = Array.from({ length: 9 }, () => o.metadata.series[0]);
                if (caso === 'raster') rasterizadorGrafica.png = async () => { throw new Error('Raster fallido sintético'); };
                if (caso === 'png') rasterizadorGrafica.png = async () => Buffer.from('PNG corrupta');
                if (caso === 'embedding') {
                    PDFDocument.prototype.image = () => { throw new Error('Embedding fallido sintético'); };
                    ExcelJS.Workbook.prototype.addImage = () => { throw new Error('Embedding fallido sintético'); };
                }
                if (caso === 'artefacto') {
                    await generar(o); await writeFile(o.archivos.rutas[formato.toLowerCase()], 'roto'); await assert.rejects(o.archivos.verificar(formato.toLowerCase()));
                } else await assert.rejects(generar(o));
            } finally {
                rasterizadorGrafica.png = rasterizar; PDFDocument.prototype.image = originalImage; ExcelJS.Workbook.prototype.addImage = originalAddImage;
                await o.archivos.limpiar(); assert.deepEqual(await readdir(raiz), ['ajeno']);
            }
        }
        assert.equal(await readFile(join(raiz, 'ajeno'), 'utf8'), 'preservado');
    } finally { await rm(raiz, { recursive: true }); }
});

test('Cancelación durante worker real: espera terminación, sin PNG/éxito parcial', async t => {
    sinDB(t); const f = filtros('VENTAS'), d = materializarEstadisticas('VENTAS', f, agregados('VENTAS'));
    let cancelar = false;
    const pendiente = rasterizadorGrafica.png(svgPanel(d, f, planGrafica(d, f), 0), () => { if (cancelar) throw cancelacionExportacion(); });
    cancelar = true; await assert.rejects(pendiente, /Cancelación/);
});

test('Métricas de conteo, retiro a costo cero sin ausencia, sectores cero sin figuras ficticias y rechazo de más de 500 páginas', async t => {
    sinDB(t); const raiz = await temporal();
    try {
        for (const fuente of fuentes) for (const grafico of graficas) {
            const f = filtros(fuente, 1, grafico); f.metrica = fuente === 'PERDIDAS' ? 'CANTIDAD_RETIROS' : 'CANTIDAD';
            const d = materializarEstadisticas(fuente, f, agregados(fuente)); const p = planGrafica(d, f);
            assert.equal(p.referencia, grafico === 'SECTORES' ? '2' : '1');
            assert.equal(p.unidad, fuente === 'PERDIDAS' ? 'RETIROS' : 'OPERACIONES');
            await pngReal(await rasterizadorGrafica.png(svgPanel(d, f, p, 0), () => {}));
        }
        for (const formato of ['PDF', 'XLSX']) {
            const f = filtros('PERDIDAS', 1, 'SECTORES', formato), g = agregados('PERDIDAS');
            for (const x of [...g.grupos, ...g.temporales]) x.perdida = '0.00';
            const d = materializarEstadisticas('PERDIDAS', f, g); assert.equal(d.sinDatos, false);
            const p = planGrafica(d, f), svg = svgPanel(d, f, p, 0); assert.equal(p.escala, 0n);
            assert.match(svg, /Sin valor para graficar/); assert.doesNotMatch(svg, /<path|<circle/);
            const o = await preparar(raiz, 'PERDIDAS', f); o.metadata = d;
            // Reescribir solo este fixture, mediante otro trabajo con spool correcto.
            await o.archivos.limpiar();
            o.archivos = await crearArchivosReporte(raiz, () => {}); const e = await o.archivos.escritor('spool');
            for (const row of filasEstadisticas(d)) await e.escribir(JSON.stringify(row) + '\n'); await e.cerrar();
            try { await generar(o); await o.archivos.verificar(formato.toLowerCase()); } finally { await o.archivos.limpiar(); }
        }
        const o = await preparar(raiz, 'VENTAS', filtros('VENTAS')); o.metadata.resumen.pruebaLayout = 'x\n'.repeat(31000);
        try { await assert.rejects(generar(o), e => e.statusCode === 413); await assert.rejects(readFile(o.archivos.rutas.pdf), { code: 'ENOENT' }); }
        finally { await o.archivos.limpiar(); }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Estadística: cancelación de SQL pendiente espera snapshot/cupo; cancelación en documento y timeout de entrega, sin headers o éxito parcial', async t => {
    sinDB(t); const raiz = await temporal(), eventos = [];
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    let activo = false, avisar, resolver, esperar = true;
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => { activo = true; try { return await cb({}); } finally { activo = false; } });
    t.mock.method(repo, 'estadisticasVentas', async f => {
        if (esperar) { avisar(); return new Promise(r => { resolver = r; }); }
        const g = agregados('VENTAS');
        if (f.granularidad === 'DIA') for (const x of g.temporales) x.etiqueta = '1000-01-01';
        return g;
    });
    try {
        for (const formato of ['PDF', 'XLSX']) {
            esperar = true; const inicio = new Promise(r => { avisar = r; }), abortar = new AbortController(), antes = eventos.length;
            const trabajo = servicio.preparar('VENTAS', filtros('VENTAS', 1, 'BARRAS', formato), contexto, { signal: abortar.signal });
            const rechazado = assert.rejects(trabajo, /Cancelación/); await inicio; abortar.abort(cancelacionExportacion());
            assert.equal(activo, true); assert.equal(eventos.length, antes);
            await assert.rejects(servicio.preparar('VENTAS', filtros('VENTAS', 1, 'BARRAS', formato), contexto), /ocupada/);
            resolver(agregados('VENTAS')); await rechazado; assert.equal(activo, false); assert.equal(eventos.length, antes + 2);
            assert.equal(eventos.at(-1).causa, 'CANCELACION_CLIENTE'); assert.deepEqual(await readdir(raiz), []);
        }
        esperar = false;
        const raster = rasterizadorGrafica.png;
        t.mock.method(rasterizadorGrafica, 'png', async (...args) => raster(...args));
        for (const formato of ['PDF', 'XLSX']) {
            const timers = [], res = new PassThrough({ highWaterMark: 1 }); let notificar;
            const headers = new Promise(r => { notificar = r; }); res.status = () => res; res.set = () => { notificar(); return res; };
            const timer = t.mock.method(globalThis, 'setTimeout', (callback, ms) => { const handle = { callback, ms }; timers.push(handle); return handle; });
            const clear = t.mock.method(globalThis, 'clearTimeout', () => {});
            const antes = eventos.length;
            try {
                const trabajo = controller.ventas({ query: { dia: '1000-01-01', formato, presentacion: 'ESTADISTICA', granularidad: 'DIA', grafico: 'LINEAS', metrica: 'IMPORTE' }, contextoAuditoria: contexto.contexto, usuario: contexto.responsable }, res, e => assert.fail(e.message));
                // Esta consulta utiliza etiqueta DIA; devolver agregado consistente.
                await headers; assert.equal(eventos.length, antes); assert.equal(timers.length, 2); timers[1].callback(); await trabajo;
                assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).causa, 'TIEMPO_AGOTADO'); assert.equal(eventos.at(-1).resultado, 'FALLO');
                assert.equal(res.destroyed, true); assert.deepEqual(await readdir(raiz), []);
            } finally { timer.mock.restore(); clear.mock.restore(); res.destroy(); }
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Service estadístico: snapshot/extracción reutilizados, sin detalle operativo ni auditor duplicado, fallos/cancelación tardíos terminal único', async t => {
    sinDB(t); const raiz = await temporal(), eventos = []; let activo = false, consultas = 0;
    t.mock.method(servicio, 'comprobarDisponibilidad', async () => ({ raizPrivada: raiz }));
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => { activo = true; try { return await cb({ snapshot: true }); } finally { activo = false; } });
    t.mock.method(auditor, 'intentarRegistrar', async e => eventos.push(e));
    t.mock.method(extraccion, 'resumen', () => assert.fail('No extracción operativa')); t.mock.method(extraccion, 'bloque', () => assert.fail('No extracción operativa'));
    for (const fuente of fuentes) t.mock.method(repo, `estadisticas${nombres[fuente]}`, async (f, opts) => { assert.ok(activo && opts.transaction.snapshot); consultas++; return agregados(fuente); });
    const probe = await open(join(raiz, 'probe'), 'wx'), proto = Object.getPrototypeOf(probe); await probe.close(); await rm(join(raiz, 'probe'));
    const write = proto.writeFile, rasterizar = rasterizadorGrafica.png; let modo, buffers = 0, abortar;
    t.mock.method(proto, 'writeFile', async function (chunk, ...args) {
        if (Buffer.isBuffer(chunk) && ++buffers === 4) {
            if (modo === 'disco') throw new Error('ENOSPC sintético tardío');
            if (modo === 'cancelar') abortar.abort(cancelacionExportacion());
        }
        return write.call(this, chunk, ...args);
    });
    try {
        for (const formato of ['PDF', 'XLSX']) for (modo of ['raster', 'disco', 'cancelar']) {
            abortar = new AbortController(); buffers = 0; const antes = eventos.length;
            rasterizadorGrafica.png = modo === 'raster' ? async () => { assert.equal(activo, false); throw new Error('Raster sintético'); }
                : async (...args) => { assert.equal(activo, false); return rasterizar(...args); };
            await assert.rejects(servicio.preparar('VENTAS', filtros('VENTAS', 1, 'BARRAS', formato), contexto, { signal: abortar.signal }));
            assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).resultado, 'FALLO');
            assert.equal(eventos.at(-1).causa, modo === 'cancelar' ? 'CANCELACION_CLIENTE' : 'ERROR_INTERNO'); assert.deepEqual(await readdir(raiz), []);
        }
        assert.equal(consultas, 6);
    } finally { rasterizadorGrafica.png = rasterizar; await rm(raiz, { recursive: true }); }
});

test('HTTP LOCAL estadístico real: tres fuentes/dos formatos, MIME/nombre/longitud, roles/HEAD, CSV íntegro, producción/remotos cerrados', async t => {
    sinDB(t); const raiz = await temporal(), eventos = []; const anterior = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
    t.after(() => { process.env.NODE_ENV = anterior; }); t.mock.method(console, 'error', () => {});
    t.mock.method(os, 'tmpdir', () => raiz); t.mock.method(os, 'freemem', () => 128 * 1024 * 1024);
    t.mock.method(fs, 'statfs', async () => ({ bavail: 512n * 1024n, bsize: 1024n }));
    t.mock.method(authService, 'getSessionUsuario', async id => ({ idUsuario: id, idRol: id, nombreUsuario: 'actor' }));
    let consultas = 0;
    t.mock.method(db.sequelize, 'transaction', async (opts, cb) => { consultas++; return cb({}); });
    for (const fuente of fuentes) t.mock.method(repo, `estadisticas${nombres[fuente]}`, async () => ({ grupos: [], temporales: [] }));
    let notificar, limpio; t.mock.method(auditor, 'intentarRegistrar', async e => { eventos.push(e); notificar?.(); });
    const original = servicio.preparar;
    t.mock.method(servicio, 'preparar', async function (...args) { const a = await original.apply(this, args), limpiar = a.limpiar; a.limpiar = async () => { await limpiar(); limpio?.(); }; return a; });
    const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
    const solicitar = (fuente, formato, rol = 1, method = 'GET') => fetch(`http://127.0.0.1:${server.address().port}/api/reportes/${fuente.toLowerCase()}/exportar?dia=9999-12-31&formato=${formato}&presentacion=ESTADISTICA&granularidad=DIA${formato === 'CSV' ? '' : '&grafico=SECTORES&metrica=' + (fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE')}`, {
        method, headers: rol ? { Cookie: `token=${generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 })}` } : {}, signal: AbortSignal.timeout(15000) });
    try {
        for (const fuente of fuentes) for (const formato of ['PDF', 'XLSX', 'CSV']) {
            const antesSQL = consultas;
            assert.equal((await solicitar(fuente, formato, null)).status, 401); assert.equal((await solicitar(fuente, formato, 3)).status, 403);
            if (fuente !== 'PERDIDAS') assert.equal((await solicitar(fuente, formato, 2)).status, 403);
            const head = await solicitar(fuente, formato, 1, 'HEAD'); assert.equal(head.status, 405); assert.equal(head.headers.get('allow'), 'GET'); assert.equal(consultas, antesSQL);
            const antes = eventos.length, terminal = new Promise(r => { notificar = r; }), limpiado = new Promise(r => { limpio = r; });
            const res = await solicitar(fuente, formato, fuente === 'PERDIDAS' ? 2 : 1);
            assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), formato === 'PDF' ? /^application\/pdf/ : formato === 'XLSX' ? /spreadsheetml.sheet/ : /^text\/csv/);
            assert.match(res.headers.get('content-disposition'), new RegExp(`attachment; filename="cadefar-${fuente.toLowerCase()}-estadistica-.*\\.${formato.toLowerCase()}"$`));
            assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
            const bytes = Buffer.from(await res.arrayBuffer()); assert.equal(bytes.length, Number(res.headers.get('content-length')));
            if (formato === 'PDF') assert.match(bytes.toString('latin1'), /\/Subtype \/Image/);
            if (formato === 'XLSX') assert.ok((await JSZip.loadAsync(bytes)).file('xl/media/image1.png'));
            if (formato === 'CSV') assert.equal(bytes.toString('utf8').split('\r\n').length - 2, fuente === 'VENTAS' ? 8 : fuente === 'COMPRAS' ? 4 : 6);
            await terminal; await limpiado; assert.equal(eventos.length, antes + 1); assert.equal(eventos.at(-1).resultado, 'EXITO');
            assert.equal(eventos.at(-1).metadatos.cantidadFilas, fuente === 'VENTAS' ? '8' : fuente === 'COMPRAS' ? '4' : '6'); assert.deepEqual(await readdir(raiz), []);
        }
        const antesSQL = consultas; process.env.NODE_ENV = 'production'; assert.equal((await solicitar('VENTAS', 'PDF')).status, 503);
        process.env.NODE_ENV = 'development';
        for (const formato of ['PDF', 'XLSX']) await assert.rejects(original.call(servicio, 'VENTAS', filtros('VENTAS', 1, 'BARRAS', formato), contexto, { direccionRemota: '192.168.1.2' }), e => e.statusCode === 503);
        assert.equal(consultas, antesSQL);
    } finally { await new Promise(r => server.close(r)); await rm(raiz, { recursive: true }); }
});
