import PDFDocument from 'pdfkit';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { COLUMNAS_REPORTE } from '../../business/services/reporte.plantillas.js';
import { leerSpool, errorLimiteExportacion } from './reporte-archivos.js';
import { planGrafica, validarTextoEstadistico, comprobarTablaEstadistica } from './reporte-grafica.js';
import { pasadaPdfEstadistica } from './reporte-pdf-estadistica.js';

export const MIME_PDF = 'application/pdf';
export const FUENTE_PDF = fileURLToPath(new URL('../resources/fonts/NotoSans-Regular.ttf', import.meta.url));
export const LAYOUT_PDF = Object.freeze({ ancho: 841.89, alto: 595.28, margen: 12 * 72 / 25.4, fuente: 8, linea: 12 });
const { ancho, alto, margen, fuente: tamano, linea } = LAYOUT_PDF;
const util = ancho - 2 * margen, fondo = alto - margen - 24;
const grafemas = new Intl.Segmenter('es', { granularity: 'grapheme' });
const labels = {
    idVenta: 'ID venta', idCompra: 'ID compra', idMovimiento: 'ID movimiento', idExistencia: 'ID existencia',
    idMedicamento: 'ID medicamento', idProveedorLaboratorio: 'ID proveedor/laboratorio', estadoOperacion: 'Estado', categoria: 'Categoría',
    fechaReferencia: 'Fecha referencia', fechaRegistro: 'Fecha registro', fechaVenta: 'Fecha venta', fechaCompra: 'Fecha compra', fechaAnulacion: 'Fecha anulación',
    total: 'Total', codigoExistencia: 'Código existencia', codigoMedicamento: 'Código medicamento', nombreComercial: 'Nombre comercial',
    idUsuario: 'ID usuario', nombreUsuario: 'Nombre usuario', motivo: 'Motivo', direccion: 'Dirección', fechaMovimiento: 'Fecha movimiento',
    cantidad: 'Cantidad', costoUnitarioAplicado: 'Costo unitario aplicado', perdida: 'Pérdida', idDetalleCompra: 'ID detalle compra',
    idDetalleVenta: 'ID detalle venta', idMovimientoOriginal: 'ID movimiento original', idMovimientoReversion: 'ID movimiento reversión'
};
const primarias = {
    VENTAS: [['idVenta'], ['estadoOperacion', 'categoria'], ['fechaReferencia'], ['total'], []],
    COMPRAS: [['idCompra'], ['estadoOperacion'], ['fechaReferencia'], ['total'], ['idProveedorLaboratorio']],
    PERDIDAS: [['idMovimiento'], ['fechaReferencia'], ['codigoExistencia'], ['motivo'], ['cantidad'], ['costoUnitarioAplicado', 'perdida']],
    MOVIMIENTOS: [['idMovimiento'], ['fechaMovimiento'], ['codigoExistencia'], ['direccion', 'motivo'], ['cantidad'], ['costoUnitarioAplicado']]
};
const aplanar = function* (objeto, prefijo = '') {
    for (const [k, v] of Object.entries(objeto ?? {})) {
        const clave = prefijo ? `${prefijo}.${k}` : k;
        if (v !== null && typeof v === 'object') yield* aplanar(v, clave);
        else yield `${clave}: ${v}`;
    }
};
const documento = estadistica => new PDFDocument({ autoFirstPage: false, bufferPages: false, fontLayoutCache: false,
    font: FUENTE_PDF, fontSize: tamano, size: estadistica ? [alto, ancho] : [ancho, alto], margins: { top: margen, bottom: margen, left: margen, right: margen },
    info: { Title: `CADEFAR / reporte ${estadistica ? 'estadístico' : 'tabular'}`, Author: 'CADEFAR', Creator: 'CADEFAR' } }).fontSize(tamano);

// Un único algoritmo para medir y dibujar. Solo retiene bandas del registro actual.
// Sin el wrapper implícito de PDFKit (trim, elipsis o salto automático de página).
const pasada = async ({ doc, archivos, fuente, filtros, metadata, generacion, filas, comprobar, dibujar, paginas, drenar }) => {
    const hash = createHash('sha256');
    let pagina = 0, y, registros = 0;
    const literal = v => {
        if (v === undefined || (v !== null && !['string', 'number', 'bigint'].includes(typeof v)) ||
            (typeof v === 'number' && !Number.isSafeInteger(v))) throw new Error('Campo PDF no representable');
        const texto = v === null ? '—' : String(v);
        if (!texto.isWellFormed()) throw new Error('Glifo PDF no representable');
        for (const c of texto) {
            if (c === '\n' || c === '\r') continue;
            if (/\p{C}/u.test(c) || !doc._font.font.hasGlyphForCodePoint(c.codePointAt(0))) throw new Error('Glifo PDF no representable');
        }
        return texto;
    };
    const anchoTexto = s => doc.widthOfString(s, { features: [] });
    const envolver = (valor, width) => {
        const texto = literal(valor), salida = [];
        // CR/LF son saltos de layout, no caracteres sustituidos por un glifo vacío.
        for (const parrafo of texto.split(/\r\n|\r|\n/u)) {
            let actual = '';
            for (const { segment: c } of grafemas.segment(parrafo)) {
                if (anchoTexto(actual + c) > width) {
                    if (!actual) throw new Error('Glifo PDF fuera de banda');
                    salida.push(actual); actual = '';
                }
                actual += c;
            }
            salida.push(actual);
        }
        return salida;
    };
    const texto = (s, x, posY, width, contar = true) => {
        literal(s);
        if (x < margen - 0.01 || x + width > ancho - margen + 0.01 || posY < margen || posY + linea > alto - margen || anchoTexto(s) > width + 0.01) throw new Error('Layout PDF fuera de márgenes');
        if (contar) hash.update(JSON.stringify([pagina, x, posY, width, s]));
        if (dibujar) doc.text(s, x, posY, { lineBreak: false, features: [], link: null, goTo: null, destination: null });
    };
    const nueva = async () => {
        comprobar();
        if (pagina && dibujar) { doc.flushPages(); await drenar(); }
        if (++pagina > 500) throw errorLimiteExportacion();
        if (dibujar) doc.addPage();
        texto(`CADEFAR | ${fuente} / TABULAR`, margen, margen, util);
        texto('Detalle completo / campos etiquetados', margen, margen + linea, util);
        texto(`Página ${pagina} de ${paginas ?? 500}`, margen, alto - margen - linea, util, false);
        y = margen + 3 * linea;
    };
    const lineas = async valor => {
        for (const s of envolver(valor, util)) {
            if (y + linea > fondo) await nueva();
            texto(s, margen, y, util); y += linea;
        }
    };
    await nueva();
    const campos = fuente === 'MOVIMIENTOS' ? ['idMedicamento', 'idExistencia', 'direccion', 'motivo'] : fuente === 'PERDIDAS' ? ['motivo'] : ['estadoOperacion'];
    for (const s of ['Período: ' + (filtros.periodo?.modalidad ?? 'Filtros abiertos CU40'),
        'Desde: ' + (filtros.periodo?.desde ?? filtros.desde ?? 'sin límite inferior'),
        'Hasta: ' + (filtros.periodo?.hasta ?? filtros.hasta ?? 'sin límite superior'), 'Zona: America/La_Paz',
        'Generación civil: ' + generacion, ...campos.map(c => `Filtro ${c}: ${filtros[c] ?? 'todos'}`),
        `Cantidad de ${fuente === 'MOVIMIENTOS' ? 'movimientos' : 'filas'}: ${filas}`,
        'Estado actual del snapshot; catálogos actuales, no cierre histórico.',
        ...(fuente === 'PERDIDAS' ? ['Pérdidas brutas: originales; RN91 por movimiento; reversiones no descontadas.'] : []),
        'Fechas civiles literales; dinero y costos exactos. Nulos: —.', 'Detalle']) await lineas(s);
    const principal = primarias[fuente], usadas = new Set(principal.flat());
    const secundarias = COLUMNAS_REPORTE[fuente].filter(c => !usadas.has(c));
    for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) {
        if (++registros > 10000) throw errorLimiteExportacion();
        for (const c of COLUMNAS_REPORTE[fuente]) literal(fila[c]);
        const id = literal(fila[COLUMNAS_REPORTE[fuente][0]]);
        const bandas = [{ celdas: principal, proporciones: principal.length === 5 ? [.10, .25, .25, .20, .20] : [.10, .20, .20, .20, .10, .20] }];
        for (let i = 0; i < secundarias.length; i += 2) bandas.push({ celdas: secundarias.slice(i, i + 2).map(c => [c]), proporciones: [.5, .5] });
        if (y + 3 * linea > fondo) await nueva();
        await lineas(`Registro ID ${id}`);
        for (const banda of bandas) {
            const celdas = banda.celdas.map((campos, i) => ({ width: util * banda.proporciones[i],
                lineas: campos.flatMap(c => banda === bandas[0]
                    ? [...envolver(labels[c], util * banda.proporciones[i] - 8), ...envolver(literal(fila[c]), util * banda.proporciones[i] - 8)]
                    : envolver(`${labels[c]}: ${literal(fila[c])}`, util * banda.proporciones[i] - 8)) }));
            const largo = Math.max(0, ...celdas.map(c => c.lineas.length));
            for (let i = 0; i < largo; i++) {
                comprobar();
                if (y + linea > fondo) {
                    await nueva(); await lineas(`ID ${id} / continuación`);
                    await lineas('Continúa banda: ' + banda.celdas.flat().map(c => labels[c]).join(' / '));
                }
                let x = margen;
                for (const celda of celdas) {
                    if (i < celda.lineas.length) texto(celda.lineas[i], x + 4, y, celda.width - 8);
                    x += celda.width;
                }
                y += linea;
            }
            y += 3;
        }
        y += 6;
    }
    if (registros !== filas) throw new Error('PDF incompleto');
    if (fuente !== 'MOVIMIENTOS') {
        await lineas('Resumen / totales exactos del snapshot por categoría');
        for (const s of aplanar(metadata.resumen)) await lineas(s);
        if (fuente !== 'PERDIDAS') await lineas('Solo confirmadas son realizadas; otras categorías informativas, no ingresos adicionales.');
    }
    if (dibujar) { doc.flushPages(); await drenar(); }
    return { paginas: pagina, registros, layout: hash.digest('hex') };
};

export const generarPdf = async opciones => {
    const estadistica = opciones.filtros.presentacion === 'ESTADISTICA';
    const recorrer = estadistica ? pasadaPdfEstadistica : pasada;
    if (estadistica) {
        validarTextoEstadistico([opciones.metadata, opciones.filtros, opciones.generacion]);
        opciones = { ...opciones, plan: planGrafica(opciones.metadata, opciones.filtros) };
        await comprobarTablaEstadistica(opciones);
    }
    if (!COLUMNAS_REPORTE[opciones.fuente] || opciones.filas > 10000) throw errorLimiteExportacion();
    const medir = documento(estadistica);
    let esperado;
    try { esperado = await recorrer({ ...opciones, doc: medir, dibujar: false }); }
    finally { medir.destroy(); }
    await opciones.archivos.verificar('spool');
    opciones.comprobar();
    const destino = await opciones.archivos.escritor('pdf'), doc = documento(estadistica);
    let escritos = 0, fallo, espera;
    const consumir = (async () => {
        try {
            for await (const chunk of doc) {
                await destino.escribir(chunk); escritos += chunk.length;
                if (espera && escritos >= espera.hasta) { espera.resolve(); espera = null; }
            }
            await destino.cerrar();
        } catch (e) { fallo = e; espera?.reject(e); espera = null; throw e; }
    })();
    consumir.catch(() => {});
    const drenar = async () => {
        opciones.comprobar();
        if (fallo) throw fallo;
        if (escritos < doc._offset) await new Promise((resolve, reject) => { espera = { hasta: doc._offset, resolve, reject }; });
        opciones.comprobar();
    };
    try {
        const real = await recorrer({ ...opciones, doc, dibujar: true, paginas: esperado.paginas, drenar });
        if (JSON.stringify(real) !== JSON.stringify(esperado)) throw new Error('Paginación PDF inconsistente entre pasadas');
        await opciones.archivos.verificar('spool');
        doc.end(); await consumir; opciones.comprobar();
        return real;
    } catch (e) {
        doc.destroy(e); await consumir.catch(() => {}); throw e;
    }
};
