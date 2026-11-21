import ExcelJS from 'exceljs';
import { createRequire } from 'node:module';
import { createReadStream } from 'node:fs';
import { pipeline, finished } from 'node:stream/promises';
import { COLUMNAS_REPORTE } from '../../business/services/reporte.plantillas.js';
import { leerSpool } from './reporte-archivos.js';
import { planGrafica, validarTextoEstadistico, comprobarTablaEstadistica, generarPanel } from './reporte-grafica.js';

// Archiver ya es dependencia de ExcelJS 4.4.0. Su escritor documental por defecto
// usa JSZip.generateAsync(nodebuffer): NO usarlo para el archivo completo.
const archiver = createRequire(import.meta.resolve('exceljs'))('archiver');
const aplanar = function* (obj, prefijo = '') {
    for (const [k, v] of Object.entries(obj ?? {})) {
        const nombre = prefijo ? `${prefijo}.${k}` : k;
        if (v !== null && typeof v === 'object') yield* aplanar(v, nombre);
        else yield [nombre, v];
    }
};
export const generarXlsxEstadistica = async (opciones, literal) => {
    const { archivos, fuente, filtros, metadata, generacion, filas, comprobar } = opciones;
    validarTextoEstadistico([metadata, filtros, generacion]);
    const plan = planGrafica(metadata, filtros);
    await comprobarTablaEstadistica(opciones);
    const libro = new ExcelJS.Workbook(); libro.creator = 'CADEFAR'; libro.lastModifiedBy = 'CADEFAR';
    const agregar = (hoja, valores, cabecera = false) => {
        comprobar();
        const fila = hoja.addRow(valores.map(literal));
        fila.eachCell(c => { c.numFmt = '@'; c.alignment = { wrapText: true, vertical: 'top' }; c.font = { name: 'Noto Sans', size: 11, bold: cabecera }; });
        // Altura explícita conservadora para wrapping de texto de metadatos.
        fila.height = 18 * Math.max(1, ...valores.map(v => Math.ceil(String(v ?? '').length / (hoja.name === 'Estadisticas' ? 22 : 80))));
        return fila;
    };
    const resumen = libro.addWorksheet('Resumen'); resumen.columns = [{ width: 44 }, { width: 110 }];
    for (const par of [['Identidad', 'CADEFAR'], ['Título', `${fuente} / ESTADISTICA`], ['Modalidad', filtros.periodo.modalidad],
        ['Desde', filtros.periodo.desde], ['Hasta', filtros.periodo.hasta], ['Zona horaria', 'America/La_Paz'], ['Generación civil', generacion],
        ['Filtro.' + (fuente === 'PERDIDAS' ? 'motivo' : 'estadoOperacion'), filtros[fuente === 'PERDIDAS' ? 'motivo' : 'estadoOperacion'] ?? 'todos'],
        ['Granularidad', filtros.granularidad], ['Gráfica', filtros.grafico], ['Métrica', filtros.metrica], ['Intervalos', String(metadata.intervalos.length)],
        ['Cantidad de filas', String(filas)], ['Nota', 'Estado actual del snapshot; catálogos actuales, no cierre histórico.'],
        ['Exactitud', 'Fechas civiles, IDs, dinero, costos y agregados: texto @. Sin fórmulas ni sumas automáticas.'],
        ...(fuente === 'PERDIDAS' ? [['Pérdidas', 'Retiros originales brutos; RN91 por movimiento; reversiones no descontadas.']]
            : [['Categorías', 'Solo confirmadas son realizadas; otras categorías informativas no son ingresos adicionales.']]),
        ...(metadata.sinDatos ? [['Datos', 'Sin operaciones']] : []), ...aplanar(metadata.resumen, 'resumen'), ...aplanar(metadata.distribuciones, 'distribuciones')]) agregar(resumen, par);
    const columnas = COLUMNAS_REPORTE.ESTADISTICA;
    const tabla = libro.addWorksheet('Estadisticas', { views: [{ state: 'frozen', ySplit: 1 }] });
    tabla.columns = columnas.map(c => ({ width: ['desde', 'hasta', 'intervalo'].includes(c) ? 14 : c === 'valor' ? 30 : 28 }));
    agregar(tabla, columnas, true); let n = 0;
    for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) { agregar(tabla, columnas.map(c => fila[c])); n++; }
    if (n !== filas) throw new Error('XLSX estadístico incompleto');
    tabla.autoFilter = `A1:H${n + 1}`;
    const grafica = libro.addWorksheet('Grafica'); grafica.columns = [{ width: 44 }, { width: 110 }];
    agregar(grafica, ['CADEFAR', `${fuente} / ${filtros.grafico} / ${filtros.metrica}`]);
    agregar(grafica, ['Escala relativa aproximada, referencia exacta S', plan.referencia]);
    agregar(grafica, ['Unidad', plan.unidad]);
    agregar(grafica, ['Resolución', plan.resolucion ? 'Valores positivos inferiores a resolución; no son cero. Consultar tabla exacta.' : 'Geometría aproximada; tabla exacta completa. Sin porcentajes.']);
    if (!plan.escala) agregar(grafica, ['Datos', 'Sin valor para graficar']);
    for (const s of plan.series) agregar(grafica, ['Leyenda / total exacto del período: ' + s.categoria, s.total]);
    for (let panel = 0; panel < plan.paneles; panel++) {
        comprobar();
        const ruta = await generarPanel(opciones, plan, panel);
        const id = libro.addImage({ filename: ruta, extension: 'png' });
        if (id !== panel || libro.getImage(id)?.filename !== ruta) throw new Error('Imagen XLSX no incrustada');
        grafica.addImage(id, { tl: { col: 0, row: 12 + panel * 43 }, ext: { width: 1200, height: 800 }, editAs: 'absolute' });
    }
    if (grafica.getImages().length !== plan.paneles) throw new Error('Dibujo XLSX incompleto');
    await archivos.verificar('spool'); comprobar();
    const destino = await archivos.flujo('xlsx'), zip = archiver('zip', { zlib: { level: 6 } });
    const terminado = pipeline(zip, destino); terminado.catch(() => {});
    const entradas = new Set(); zip.on('entry', entry => entradas.add(entry.name));
    let fallo, lectura, lecturaTerminada; zip.on('error', e => { fallo = e; });
    try {
        // Adaptación versionada de XLSX.write de ExcelJS 4.4.0: modelo acotado,
        // entradas OOXML reales, ZIP a stream, imágenes desde archivos secuenciales.
        const xlsx = libro.xlsx, model = libro.model;
        xlsx.prepareModel(model, { useSharedStrings: false, useStyles: true });
        const originalAppend = zip.append.bind(zip);
        zip.append = (datos, opts) => {
            comprobar(); if (fallo) throw fallo;
            // XML normaliza CR: conservarlo, igual que en el renderer tabular.
            return originalAppend(typeof datos === 'string' ? datos.replace(/\r/g, '&#13;') : datos, opts);
        };
        for (const metodo of ['addContentTypes', 'addOfficeRels', 'addWorkbookRels', 'addWorksheets', 'addSharedStrings', 'addDrawings', 'addTables', 'addThemes', 'addStyles', 'addApp', 'addCore', 'addWorkbook']) {
            comprobar(); if (fallo) throw fallo; await xlsx[metodo](zip, model);
        }
        for (const [i, medium] of model.media.entries()) {
            comprobar(); await archivos.verificar(`png${i}`);
            const name = `xl/media/${medium.name}.${medium.extension}`;
            const leido = new Promise((resolve, reject) => {
                const entrada = entry => { if (entry.name === name) { limpiar(); resolve(); } };
                const error = e => { limpiar(); reject(e); };
                const limpiar = () => { zip.off('entry', entrada); zip.off('error', error); destino.off('error', error); };
                zip.on('entry', entrada); zip.once('error', error); destino.once('error', error);
            });
            leido.catch(() => {});
            lectura = createReadStream(medium.filename); lecturaTerminada = finished(lectura); lecturaTerminada.catch(() => {});
            lectura.on('error', e => zip.destroy(e)); zip.append(lectura, { name });
            await leido; await lecturaTerminada; lectura = null; await archivos.quitarTemporal(`png${i}`);
        }
        await zip.finalize(); await terminado; comprobar();
        for (const nombre of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
            'xl/worksheets/sheet3.xml', 'xl/worksheets/_rels/sheet3.xml.rels', 'xl/drawings/drawing1.xml', 'xl/drawings/_rels/drawing1.xml.rels',
            ...model.media.map(m => `xl/media/${m.name}.${m.extension}`)]) {
            if (!entradas.has(nombre)) throw new Error('OOXML incompleto');
        }
        await archivos.verificar('spool'); await archivos.verificar('xlsx');
    } catch (e) {
        lectura?.destroy(e); zip.abort(); zip.destroy(e); destino.destroy(e);
        await lecturaTerminada?.catch(() => {}); await terminado.catch(() => {}); throw e;
    }
};
