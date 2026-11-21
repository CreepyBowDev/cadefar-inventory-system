import { createHash } from 'node:crypto';
import { leerSpool, errorLimiteExportacion } from './reporte-archivos.js';
import { generarPanel } from './reporte-grafica.js';

const margen = 12 * 72 / 25.4, linea = 12, ancho = 595.28, alto = 841.89, util = ancho - 2 * margen;
const grafemas = new Intl.Segmenter('es', { granularity: 'grapheme' });
const aplanar = function* (obj, prefijo = '') {
    for (const [k, v] of Object.entries(obj ?? {})) {
        const nombre = prefijo ? `${prefijo}.${k}` : k;
        if (v !== null && typeof v === 'object') yield* aplanar(v, nombre);
        else yield `${nombre}: ${v}`;
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
        dibujarTexto(`CADEFAR | ${fuente} / ESTADISTICA`, margen);
        dibujarTexto(seccion, margen + linea);
        dibujarTexto(`Página ${pagina} de ${paginas ?? 500}`, alto - margen - linea, false);
        y = margen + 3 * linea;
        if (seccion.startsWith('Tabla completa')) {
            dibujarTexto('Fila | intervalo | desde | hasta | parcial', y); y += linea;
            dibujarTexto('categoría | métrica | unidad | valor exacto', y); y += linea;
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
    for (const s of [`Período: ${filtros.periodo.modalidad}`, `Desde: ${filtros.periodo.desde}`, `Hasta: ${filtros.periodo.hasta}`,
        'Zona: America/La_Paz', `Generación civil: ${generacion}`,
        `Filtro ${fuente === 'PERDIDAS' ? 'motivo' : 'estadoOperacion'}: ${filtros[fuente === 'PERDIDAS' ? 'motivo' : 'estadoOperacion'] ?? 'todos'}`,
        `Granularidad: ${filtros.granularidad}; gráfica: ${filtros.grafico}; métrica: ${filtros.metrica}`,
        `Intervalos: ${metadata.intervalos.length}; filas: ${filas}`,
        'Estado actual del snapshot; catálogos actuales, no cierre histórico.',
        ...(fuente === 'PERDIDAS' ? ['Pérdidas brutas: originales; RN91 por movimiento; reversiones no descontadas.']
            : ['Solo confirmadas son realizadas; categorías informativas no son ingresos adicionales.']),
        ...(metadata.sinDatos ? ['Sin operaciones'] : []), 'Indicadores / totales exactos por categoría', ...aplanar(metadata.resumen)]) await texto(s);
    seccion = 'Distribuciones / valores absolutos exactos'; await texto(seccion);
    for (const d of metadata.distribuciones) {
        await texto(`${d.metrica} / ${d.unidad} / total informativo: ${d.total}`);
        for (const c of d.categorias) await texto(`${c.categoria}: ${c.valor}`);
    }
    seccion = 'Gráfica elegida / geometría aproximada';
    for (let panel = 0; panel < plan.paneles; panel++) {
        await nueva();
        await texto(`Panel ${panel + 1} de ${plan.paneles} / ${filtros.grafico} / ${filtros.metrica}`);
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
    for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) {
        registros++;
        if (registros > 9600) throw errorLimiteExportacion();
        await texto(`${registros} | ${fila.intervalo} | ${fila.desde} | ${fila.hasta} | ${fila.parcial}`);
        await texto(`${fila.categoria} | ${fila.metrica} | ${fila.unidad} | ${fila.valor}`);
    }
    if (registros !== filas) throw new Error('PDF estadístico incompleto');
    if (dibujar) { doc.flushPages(); await drenar(); }
    return { paginas: pagina, registros, layout: hash.digest('hex') };
};
