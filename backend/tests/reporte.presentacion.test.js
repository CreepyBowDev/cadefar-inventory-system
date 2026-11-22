import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { crearArchivosReporte } from '../src/shared/utils/reporte-archivos.js';
import { generarPdf } from '../src/shared/utils/reporte-pdf.js';
import { generarXlsx } from '../src/shared/utils/reporte-xlsx.js';
import { BOM_CSV, registroCsv } from '../src/shared/utils/reporte-csv.js';
import { TITULOS_REPORTE, alturaFilaXlsx } from '../src/shared/utils/reporte-presentacion.js';
import { COLUMNAS_REPORTE, proyectarFila, crearConciliacion, filasEstadisticas } from '../src/business/services/reporte.plantillas.js';
import { materializarEstadisticas } from '../src/business/services/reporte.estadisticas.js';

// Solo renderizadores puros y archivos sintéticos; no se importa Sequelize ni .env.
const salida = process.env.CADEFAR_EXPORTACIONES_FIXTURES;
const raizTemporal = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Temp', 'opencode') : tmpdir();
const fuentes = ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS'];
const monto = '12345678901234567890.12';
const nombre = 'Ácido acetilsalicílico de liberación prolongada, presentación Ñ; "especial"\r\n' + 'DenominaciónExtensa'.repeat(20);
const fila = (fuente, id) => proyectarFila(fuente, { id_venta: id, id_compra: id, id_movimiento: id,
    id_proveedor_laboratorio: 2147483647, id_existencia: 2147483647, id_medicamento: 2147483647, id_usuario: 2147483647,
    estado_operacion: 'CONFIRMADA', categoria: 'CONFIRMADA', total: monto,
    fecha_referencia: '9999-12-31 23:59:59', fecha_compra: '1000-01-01', fecha_registro: '1000-01-01 00:00:00',
    fecha_venta: '9999-12-31 23:59:59', fecha_anulacion: null, fecha_movimiento: '9999-12-31 23:59:59',
    direccion: 'SALIDA', motivo: 'DAÑO', cantidad: 1, costo_unitario_aplicado: '0.005000',
    codigo_existencia: '000001-000000000001', codigo_medicamento: '+001', nombre_comercial: nombre,
    nombre_usuario: '=literal, no fórmula', id_movimiento_reversion: null });
const grupos = (fuente, vacio) => vacio ? fuente === 'MOVIMIENTOS' ? [{ cantidad: '0' }] : []
    : fuente === 'MOVIMIENTOS' ? [{ cantidad: '8' }]
        : fuente === 'PERDIDAS' ? [{ motivo: 'DAÑO', cantidad_retiros: '8', cantidad_retirada: '8', perdida: '0.08' }]
            : [{ categoria: 'CONFIRMADA', estado_operacion: 'CONFIRMADA', cantidad: '8', importe: '98765431209876543120.96' }];
const textoPdf = async ruta => {
    const task = getDocument({ data: new Uint8Array(await readFile(ruta)), useSystemFonts: false, isEvalSupported: false });
    const pdf = await task.promise, textos = [];
    try {
        for (let n = 1; n <= pdf.numPages; n++) {
            const pagina = await pdf.getPage(n), { items } = await pagina.getTextContent();
            const texto = items.map(i => i.str ?? '').join('\n');
            assert.ok(texto.includes(`Página ${n} de ${pdf.numPages}`));
            if (texto.includes('Tabla completa de series')) {
                assert.equal((texto.match(/^\d+ \|/gm) ?? []).length,
                    (texto.match(/^(?:CONFIRMADA|PENDIENTE|ANULADA|ANULADA_CONFIRMADA|ANULADA_SIN_CONFIRMAR|VENCIMIENTO|DAÑO) \|/gm) ?? []).length,
                    'Las dos bandas de cada fila estadística permanecen en la misma página');
            }
            assert.ok(items.some(i => i.str?.startsWith('CADEFAR |') && i.transform[0] === 12));
            for (const i of items.filter(i => i.str)) {
                assert.ok(i.transform[0] >= 8);
                assert.ok(i.transform[4] >= 34 && i.transform[4] + i.width < pagina.view[2] - 33);
            }
            textos.push(texto); pagina.cleanup();
        }
        return { texto: textos.join('\n'), paginas: pdf.numPages };
    } finally { await pdf.cleanup(); await task.destroy(); }
};
const conservar = async (ruta, nombreArchivo) => {
    if (!salida) return;
    await mkdir(salida, { recursive: true }); await copyFile(ruta, join(salida, nombreArchivo));
};

test('Presentación: cuatro fuentes tabulares y tres estadísticas, vacías/extensas; archivos reales y valores contractuales', async t => {
    const raiz = await mkdtemp(join(raizTemporal, 'cadefar-presentacion-'));
    try {
        for (const fuente of fuentes) for (const estadistica of fuente === 'MOVIMIENTOS' ? [false] : [false, true]) for (const vacio of [false, true]) {
            await t.test(`${fuente}/${estadistica ? 'ESTADISTICA' : 'TABULAR'}/${vacio ? 'vacio' : 'extenso'}`, async () => {
                const filtros = { presentacion: estadistica ? 'ESTADISTICA' : 'TABULAR',
                    periodo: { modalidad: 'PERIODO', desde: '1000-01-01', hasta: '9999-12-31' },
                    granularidad: 'ANIO', grafico: 'LINEAS', metrica: fuente === 'PERDIDAS' ? 'PERDIDA' : 'IMPORTE' };
                if (estadistica) filtros.periodo.hasta = '1060-12-31';
                const metadata = estadistica ? materializarEstadisticas(fuente, filtros, {
                    grupos: grupos(fuente, vacio), temporales: grupos(fuente, vacio).map(g => ({ ...g, etiqueta: '1000' }))
                }) : { resumen: crearConciliacion(fuente, grupos(fuente, vacio)).resumen };
                const filas = estadistica ? [...filasEstadisticas(metadata)] : vacio ? [] : Array.from({ length: 8 }, (_, i) => fila(fuente, 8 - i));
                const columnas = COLUMNAS_REPORTE[estadistica ? 'ESTADISTICA' : fuente];
                const archivos = await crearArchivosReporte(raiz, () => {});
                try {
                    const spool = await archivos.escritor('spool');
                    for (const f of filas) await spool.escribir(JSON.stringify(f) + '\n');
                    await spool.cerrar();
                    const opciones = { archivos, fuente, filtros, metadata, filas: filas.length, generacion: '2026-11-21 12:00:00', comprobar() {} };
                    await generarPdf(opciones); await generarXlsx(opciones);
                    const pdf = await textoPdf(archivos.rutas.pdf);
                    assert.ok(pdf.texto.includes(TITULOS_REPORTE[fuente]));
                    if (fuente !== 'MOVIMIENTOS') {
                        const resumen = pdf.texto.indexOf(estadistica ? 'Indicadores /' : 'Resumen completo /');
                        const detalle = pdf.texto.indexOf(estadistica ? 'Tabla completa de series /' : 'Detalle completo / todos los campos');
                        assert.ok(resumen >= 0 && detalle > resumen);
                    }
                    if (!vacio) assert.ok(pdf.paginas > 1, 'Fixture multipágina');
                    if (estadistica) {
                        assert.match(pdf.texto, /Intervalos 1 a 60 de 61; todas las categorías/);
                        assert.match(pdf.texto, /Intervalos 61 a 61 de 61; todas las categorías/);
                        assert.match(pdf.texto, /Importe monetario \(sin moneda especificada\)/);
                    }
                    const libro = new ExcelJS.Workbook(); await libro.xlsx.readFile(archivos.rutas.xlsx);
                    const tabla = libro.getWorksheet(estadistica ? 'Estadisticas' : 'Detalle');
                    assert.deepEqual(tabla.getRow(1).values.slice(1), columnas);
                    assert.equal(tabla.getCell('A1').fill.fgColor.argb, 'FF126782');
                    assert.equal(tabla.getCell('A1').font.color.argb, 'FFFFFFFF');
                    assert.equal(tabla.views[0].ySplit, 1);
                    assert.ok(tabla.autoFilter);
                    assert.equal(tabla.rowCount, filas.length + 1);
                    for (const [i, f] of filas.entries()) for (const [j, c] of columnas.entries()) {
                        const celda = tabla.getRow(i + 2).getCell(j + 1);
                        assert.equal(celda.value, f[c] == null ? null : String(f[c]), c);
                        assert.equal(celda.numFmt, '@'); assert.equal(celda.formula, undefined);
                        assert.equal(celda.alignment.wrapText, true);
                    }
                    const resumen = JSON.stringify(libro.getWorksheet('Resumen').getSheetValues());
                    assert.match(resumen, /Significado|significado/);
                    if (fuente === 'MOVIMIENTOS' && !vacio) assert.ok(tabla.getRow(2).height > 16);
                    if (estadistica) {
                        const grafica = libro.getWorksheet('Grafica'), imagenes = grafica.getImages();
                        assert.equal(imagenes.length, 2);
                        const primera = imagenes[0].range.tl.nativeRow;
                        const ultimaLeyenda = grafica.getSheetValues().findLastIndex(r => r?.[1]?.startsWith('Leyenda /'));
                        assert.ok(primera > ultimaLeyenda, 'Imagen debajo de la última fila real de la leyenda');
                        assert.match(grafica.getRow(primera).getCell(2).value, /Intervalos 1 a 60/);
                        assert.ok(imagenes[1].range.tl.nativeRow > primera + 41);
                    }
                    const nombreArchivo = `${fuente.toLowerCase()}-${filtros.presentacion.toLowerCase()}-${vacio ? 'vacio' : 'extenso'}`;
                    await conservar(archivos.rutas.pdf, nombreArchivo + '.pdf');
                    await conservar(archivos.rutas.xlsx, nombreArchivo + '.xlsx');
                    // El CSV deliberadamente no recibe ninguna mejora narrativa.
                    const csv = Buffer.from(BOM_CSV + registroCsv(columnas) + filas.map(f => registroCsv(columnas.map(c => f[c]))).join(''));
                    assert.equal(csv.subarray(0, 3).toString('hex'), 'efbbbf');
                    assert.ok(csv.subarray(3).toString().startsWith(columnas.map(c => `"${c}"`).join(';') + '\r\n'));
                    if (salida) await writeFile(join(salida, nombreArchivo + '.csv'), csv);
                } finally { await archivos.limpiar(); }
            });
        }
    } finally { await rm(raiz, { recursive: true }); }
});

test('Altura XLSX: saltos explícitos, texto largo y límite Excel sin alterar valor', () => {
    const hoja = new ExcelJS.Workbook().addWorksheet('Prueba'); hoja.columns = [{ width: 20 }];
    assert.equal(alturaFilaXlsx(hoja, ['a\r\nb\nc\rd']), 64);
    assert.equal(alturaFilaXlsx(hoja, ['x'.repeat(32767)]), 409);
});
