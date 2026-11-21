import { createHash } from 'node:crypto';
import { leerSpool, errorLimiteExportacion } from './reporte-archivos.js';
import { generarPanel } from './reporte-grafica.js';
import { TITULOS_REPORTE, etiquetaRuta, explicarCodigo, notasFuente, alcanceGrafica, leyendaCodigos } from './reporte-presentacion.js';

const margen = 12 * 72 / 25.4, linea = 12, ancho = 595.28, alto = 841.89, util = ancho - 2 * margen;
const grafemas = new Intl.Segmenter('es', { granularity: 'grapheme' });
const aplanar = function* (obj, prefijo = '') {
    for (const [k, v] of Object.entries(obj ?? {})) {
        const nombre = prefijo ? `${prefijo}.${k}` : k;
        if (v !== null && typeof v === 'object') yield* aplanar(v, nombre);
        else yield `${etiquetaRuta(nombre)} — ${nombre}: ${v}`;
    }
};
// Mismo recorrido en medición/dibujo; una página a la vez, no bufferPages.
export const pasadaPdfEstadistica = async opciones => {
    const { doc, archivos, fuente, filtros, metadata, generacion, filas, comprobar, dibujar, paginas, drenar, plan } = opciones;
    let pagina = 0, y, registros = 0, seccion = 'Indicadores';
    const hash = createHash('sha256');
    const dibujarTexto = (s, posY, contar = true) => {
        if (doc.widthOfString(s, { features: [] }) > util + .01 || posY + linea > alto - margen) throw new Error('Layout estadístico fuera de márgenes');
        if (contar) hash.update(JSON.stringify([pagina, posY, s]));
        if (dibujar) doc.text(s, margen, posY, { lineBreak: false, features: [], link: null, goTo: null, destination: null });
    };
    const nueva = async () => {
        comprobar();
        if (pagina && dibujar) { doc.flushPages(); await drenar(); }
        if (++pagina > 500) throw errorLimiteExportacion();
        if (dibujar) doc.addPage();
        doc.fontSize(12);
        if (dibujar) doc.fillColor('#126782');
        dibujarTexto(`CADEFAR | ${TITULOS_REPORTE[fuente]}`, margen);
        doc.fontSize(8);
        if (dibujar) doc.fillColor('#172b3a');
        dibujarTexto(seccion, margen + 18);
        dibujarTexto(`Página ${pagina} de ${paginas ?? 500}`, alto - margen - linea, false);
        y = margen + 3 * linea;
        if (seccion.startsWith('Tabla completa')) {
            dibujarTexto('Fila | intervalo | desde | hasta | parcial', y); y += linea;
            dibujarTexto('categoría | métrica | unidad | valor exacto', y); y += linea;
            dibujarTexto(fuente === 'PERDIDAS' ? 'PERDIDA: pérdida bruta; CANTIDAD_RETIROS: retiros; CANTIDAD_RETIRADA: unidades.'
                : 'CANTIDAD: operaciones; IMPORTE: importe histórico, no siempre realizado.', y); y += linea;
            dibujarTexto('Importes: 2 decimales, sin moneda especificada. Consultar categorías en el resumen.', y); y += linea;
        }
    };
    const texto = async valor => {
        for (const parrafo of String(valor).split(/\r\n|\r|\n/u)) {
            let actual = '';
            const emitir = async () => {
                comprobar(); if (y + linea > alto - margen - 24) await nueva();
                dibujarTexto(actual, y); y += linea;
            };
            if (doc.widthOfString(parrafo, { features: [] }) <= util) {
                actual = parrafo; await emitir(); continue;
            }
            for (const { segment } of grafemas.segment(parrafo)) {
                if (doc.widthOfString(actual + segment, { features: [] }) > util) {
                    if (!actual) throw new Error('Glifo estadístico fuera de márgenes');
                    await emitir(); actual = '';
                }
                actual += segment;
            }
            await emitir();
        }
    };
    await nueva();
    for (const s of ['Presentación estadística / criterios aplicados', `Período: ${explicarCodigo(filtros.periodo.modalidad)}`, `Desde: ${filtros.periodo.desde}`, `Hasta: ${filtros.periodo.hasta}`,
        'Zona: America/La_Paz', `Generación civil: ${generacion}`,
        `Filtro ${fuente === 'PERDIDAS' ? 'motivo del retiro' : 'estado de la operación'}: ${filtros[fuente === 'PERDIDAS' ? 'motivo' : 'estadoOperacion'] ?? 'todos'}`,
        `Granularidad: ${explicarCodigo(filtros.granularidad)}; gráfica: ${explicarCodigo(filtros.grafico)}; métrica: ${explicarCodigo(filtros.metrica)}`,
        `Intervalos: ${metadata.intervalos.length}; filas: ${filas}`,
        'Estado actual del snapshot; catálogos actuales, no cierre histórico.',
        ...notasFuente(fuente), 'Categorías / códigos: ' + leyendaCodigos(fuente),
        'Alcance: todas las categorías, métricas, intervalos y ceros; no solo el panel visible.',
        ...(metadata.sinDatos ? ['Sin operaciones'] : []), 'Indicadores / totales exactos por categoría', ...aplanar(metadata.resumen)]) await texto(s);
    seccion = 'Distribuciones / valores absolutos exactos'; await texto(seccion);
    for (const d of metadata.distribuciones) {
        await texto(`${explicarCodigo(d.metrica)} / ${explicarCodigo(d.unidad)}`);
        await texto(`${d.metrica} / ${d.unidad} / total informativo: ${d.total}`);
        for (const c of d.categorias) await texto(`${explicarCodigo(c.categoria)} — ${c.categoria}: ${c.valor}`);
    }
    seccion = 'Gráfica elegida / geometría aproximada';
    for (let panel = 0; panel < plan.paneles; panel++) {
        await nueva();
        await texto(`Panel ${panel + 1} de ${plan.paneles} / ${filtros.grafico} / ${filtros.metrica}`);
        await texto(alcanceGrafica(metadata, filtros, panel));
        await texto(`Unidad: ${explicarCodigo(plan.unidad)}. Leyenda: todas las categorías del reporte.`);
        await texto(`Escala relativa aproximada, referencia exacta S=${plan.referencia} / ${plan.unidad}`);
        await texto(plan.resolucion ? 'Valores positivos inferiores a resolución; no son cero. Consultar tabla exacta.' : 'Datos exactos completos en tabla. Sin porcentajes.');
        if (dibujar) {
            const ruta = await generarPanel(opciones, plan, panel);
            doc.image(ruta, margen, y, { width: util, height: util * 2 / 3 });
            doc.flushPages(); await drenar();
            // PDFKit conserva la clave de imagen; no retener imágenes de paneles anteriores.
            delete doc._imageRegistry[ruta];
            await archivos.quitarTemporal(`png${panel}`);
        }
        hash.update(JSON.stringify(['imagen', pagina, y, panel, plan.referencia]));
        y += util * 2 / 3;
    }
    seccion = 'Tabla completa de series / todas las métricas y ceros'; await nueva();
    await texto('Parcial: true = intervalo limitado por el período; false = intervalo natural completo.');
    await texto('Importes: 2 decimales exactos. Cantidades: valores enteros; cero no significa ausencia.');
    for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) {
        registros++;
        if (registros > 9600) throw errorLimiteExportacion();
        const bandas = [`${registros} | ${fila.intervalo} | ${fila.desde} | ${fila.hasta} | ${fila.parcial}`,
            `${fila.categoria} | ${fila.metrica} | ${fila.unidad} | ${fila.valor}`];
        // No separar las dos bandas de un registro que cabe en una página.
        const altoRegistro = bandas.reduce((n, s) => {
            if (doc.widthOfString(s, { features: [] }) <= util) return n + linea;
            let lineas = 1, actual = '';
            for (const { segment } of grafemas.segment(s)) {
                if (doc.widthOfString(actual + segment, { features: [] }) > util) { lineas++; actual = ''; }
                actual += segment;
            }
            return n + lineas * linea;
        }, 0);
        if (altoRegistro <= alto - 2 * margen - 9 * linea && y + altoRegistro > alto - margen - 24) await nueva();
        if (dibujar && registros % 2) doc.save().fillColor('#edf4f6')
            .rect(margen, y, util, Math.max(0, Math.min(altoRegistro, alto - margen - 24 - y))).fill().restore();
        for (const banda of bandas) await texto(banda);
        y += 2;
    }
    if (registros !== filas) throw new Error('PDF estadístico incompleto');
    if (dibujar) { doc.flushPages(); await drenar(); }
    return { paginas: pagina, registros, layout: hash.digest('hex') };
};
