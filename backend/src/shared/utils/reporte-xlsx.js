import ExcelJS from 'exceljs';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { COLUMNAS_REPORTE } from '../../business/services/reporte.plantillas.js';
import { leerSpool, errorLimiteExportacion } from './reporte-archivos.js';
import { generarXlsxEstadistica } from './reporte-xlsx-estadistica.js';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const TEXTO = { numFmt: '@', alignment: { vertical: 'top', wrapText: true } };
const MAGNITUD = { ...TEXTO, alignment: { ...TEXTO.alignment, horizontal: 'right' } };
const CABECERA = { ...TEXTO, font: { bold: true } };
const magnitud = c => /cantidad|costo|total|perdida|valor|importe/i.test(c);
const literal = valor => {
    if (valor == null) return null;
    if (!['string', 'number', 'bigint', 'boolean'].includes(typeof valor) ||
        (typeof valor === 'number' && !Number.isSafeInteger(valor))) throw new Error('Celda no representable');
    const texto = String(valor);
    if (texto.length > 32767) throw errorLimiteExportacion();
    // ExcelJS elimina controles XML inválidos: rechazar, nunca perder texto silenciosamente.
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(texto) || !texto.isWellFormed()) throw new Error('Texto no representable');
    // Escape OOXML del guion bajo: conservar secuencias literales _xHHHH_.
    return texto.replace(/_x([0-9a-fA-F]{4})_/g, '_x005F_x$1_');
};

// Adaptación deliberada a ExcelJS 4.4.0. Su StreamBuf interno devuelve true
// siempre y no espera _pipe. PassThrough permite drenar cada fila antes de leer
// la siguiente. No usa temporales de biblioteca ni buffer del libro completo.
class LibroAcotado extends ExcelJS.stream.xlsx.WorkbookWriter {
    _openStream(path) {
        const stream = new PassThrough({ highWaterMark: 65536 });
        const escribir = stream.write;
        // WorksheetWriter entrega StringBuf reutilizables: copiar solo el chunk
        // actual antes de que lo vacíe, nunca conservar el objeto mutable.
        stream.write = function (chunk, ...args) {
            let datos = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : chunk.toBuffer();
            // XML normaliza CR literales a LF al reabrir. Referencia XML para
            // conservar CR/CRLF originales sin alterar ni escapar dos veces datos.
            if (datos.includes(13)) {
                const partes = []; let inicio = 0, posicion;
                while ((posicion = datos.indexOf(13, inicio)) !== -1) {
                    partes.push(datos.subarray(inicio, posicion), Buffer.from('&#13;')); inicio = posicion + 1;
                }
                partes.push(datos.subarray(inicio)); datos = Buffer.concat(partes);
            }
            return escribir.call(this, datos, ...args);
        };
        this.zip.append(stream, { name: path });
        stream.on('finish', () => stream.emit('zipped'));
        stream.on('error', error => this.zip.emit('error', error));
        return stream;
    }
}
const agregar = async (hoja, valores, columnas, comprobar, cabecera = false) => {
    comprobar();
    const fila = hoja.addRow(valores.map(literal));
    valores.forEach((_, i) => { fila.getCell(i + 1).style = cabecera ? CABECERA : magnitud(columnas[i] ?? '') ? MAGNITUD : TEXTO; });
    fila.commit();
    if (hoja.stream.writableNeedDrain) await once(hoja.stream, 'drain');
    comprobar();
};
const aplanar = function* (objeto, prefijo = '') {
    for (const [clave, valor] of Object.entries(objeto ?? {})) {
        const nombre = prefijo ? `${prefijo}.${clave}` : clave;
        if (valor !== null && typeof valor === 'object') yield* aplanar(valor, nombre);
        else yield [nombre, valor];
    }
};

export const generarXlsx = async ({ archivos, fuente, filtros, metadata, generacion, filas, comprobar }) => {
    const estadistica = filtros.presentacion === 'ESTADISTICA';
    if (estadistica) return generarXlsxEstadistica({ archivos, fuente, filtros, metadata, generacion, filas, comprobar }, literal);
    const columnas = COLUMNAS_REPORTE[estadistica ? 'ESTADISTICA' : fuente];
    if (!columnas || filas > (estadistica ? 9600 : 1000000) ||
        (estadistica && metadata.intervalos.length > 1200)) throw errorLimiteExportacion();
    const destino = await archivos.flujo('xlsx');
    const libro = new LibroAcotado({ stream: destino, useSharedStrings: false, useStyles: true,
        creator: 'CADEFAR', lastModifiedBy: 'CADEFAR', zip: { zlib: { level: 6 } } });
    let fallo, errorRegistrado;
    const comprobarOriginal = comprobar;
    comprobar = () => { if (errorRegistrado) throw errorRegistrado; comprobarOriginal(); };
    const terminado = finished(destino);
    const error = new Promise((resolve, reject) => {
        fallo = causa => { errorRegistrado ??= causa; reject(causa); };
        destino.on('error', fallo);
        libro.zip.on('error', fallo);
    });
    // Observar errores desde el inicio (antes del commit/finalize de ExcelJS).
    terminado.catch(fallo);
    const hojas = [];
    try {
        await Promise.race([error, (async () => {
            const resumen = libro.addWorksheet('Resumen'); hojas.push(resumen);
            resumen.columns = [{ width: 38 }, { width: 100 }];
            const desde = filtros.periodo?.desde ?? filtros.desde ?? 'sin límite inferior';
            const hasta = filtros.periodo?.hasta ?? filtros.hasta ?? 'sin límite superior';
            const camposFiltro = fuente === 'MOVIMIENTOS' ? ['idMedicamento', 'idExistencia', 'direccion', 'motivo']
                : fuente === 'PERDIDAS' ? ['motivo'] : ['estadoOperacion'];
            const metadatos = [['Identidad', 'CADEFAR'], ['Título', `${fuente} / ${filtros.presentacion}`],
                ['Modalidad', filtros.periodo?.modalidad ?? 'Filtros abiertos CU40'],
                ['Desde', desde], ['Hasta', hasta], ['Zona horaria', 'America/La_Paz'], ['Generación civil', generacion],
                ...camposFiltro.map(c => [`Filtro.${c}`, filtros[c] ?? 'todos']),
                ...(estadistica ? [['Granularidad', filtros.granularidad], ['Disponibilidad', 'Datos internos sin gráfica; no descarga pública']] : []),
                ['Cantidad de ' + (fuente === 'MOVIMIENTOS' ? 'movimientos' : 'filas'), String(filas)],
                ['Nota', 'Estado actual del snapshot; catálogos actuales, no cierre histórico.'],
                ...(fuente === 'PERDIDAS' ? [['Pérdidas', 'Retiros originales brutos; RN91 redondeada por movimiento; reversiones no descontadas.']] : []),
                ['Exactitud', 'IDs, códigos, fechas civiles, dinero, costos y agregados son texto @; nulos vacíos. Sin fórmulas ni sumas automáticas sobre textos.']];
            for (const par of metadatos) await agregar(resumen, par, [], comprobar);
            for (const par of aplanar(metadata.resumen, 'resumen')) await agregar(resumen, par, ['', par[0]], comprobar);
            if (estadistica) for (const par of aplanar(metadata.distribuciones, 'distribuciones')) await agregar(resumen, par, ['', par[0]], comprobar);
            if (fuente !== 'MOVIMIENTOS') {
                await agregar(resumen, ['Columna', 'Tipo / representación'], [], comprobar, true);
                for (const c of columnas) await agregar(resumen, [c, 'string @; valor literal exacto; null = celda vacía'], [], comprobar);
            }
            resumen.commit();
            const detalle = libro.addWorksheet(estadistica ? 'Estadisticas' : 'Detalle', {
                views: [{ state: 'frozen', ySplit: 1 }], pageSetup: { printTitlesRow: '1:1' }
            }); hojas.push(detalle);
            detalle.columns = columnas.map(c => ({ width: /^id/.test(c) ? 14 : /fecha|desde|hasta|intervalo/i.test(c)
                ? c === 'fechaCompra' || ['desde', 'hasta', 'intervalo'].includes(c) ? 12 : 22
                : magnitud(c) ? 28 : /nombre/i.test(c) ? 36 : 24 }));
            await agregar(detalle, columnas, columnas, comprobar, true);
            let cantidad = 0;
            for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) {
                if (++cantidad > (estadistica ? 9600 : 1000000)) throw errorLimiteExportacion();
                await agregar(detalle, columnas.map(c => fila[c]), columnas, comprobar);
            }
            if (cantidad !== filas) throw new Error('Artefacto incompleto');
            detalle.autoFilter = { from: { row: 1, column: 1 }, to: { row: cantidad + 1, column: columnas.length } };
            detalle.commit();
            await libro.commit();
            await terminado;
            comprobar();
        })()]);
    } catch (causa) {
        libro.zip.abort();
        for (const hoja of hojas) hoja.stream.destroy(causa);
        destino.destroy(causa);
        await terminado.catch(() => {});
        throw causa;
    }
};
