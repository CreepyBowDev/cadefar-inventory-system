import { Worker } from 'node:worker_threads';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import { crc32, inflateSync } from 'node:zlib';
import { decimalAEntero, dividirYRedondear, enteroADecimal } from './decimal.js';
import { errorLimiteExportacion, leerSpool } from './reporte-archivos.js';
import { filasEstadisticas } from '../../business/services/reporte.plantillas.js';

const fuente = fileURLToPath(new URL('../resources/fonts/NotoSans-Regular.ttf', import.meta.url));
const colores = ['#126782', '#b65c00', '#7142a3', '#286b37'];
export const DIMENSION_GRAFICA = Object.freeze({ ancho: 1200, alto: 800, bytes: 8 * 1024 * 1024 });
export const validarTextoEstadistico = valor => {
    const doc = new PDFDocument({ autoFirstPage: false, font: fuente, fontLayoutCache: false });
    const visitar = v => {
        if (v !== null && typeof v === 'object') { for (const x of Object.values(v)) visitar(x); return; }
        const s = String(v);
        if (!s.isWellFormed()) throw new Error('Glifo estadístico no representable');
        for (const c of s) if (c !== '\r' && c !== '\n' && (/\p{C}/u.test(c) || !doc._font.font.hasGlyphForCodePoint(c.codePointAt(0)))) throw new Error('Glifo estadístico no representable');
    };
    try { visitar(valor); } finally { doc.destroy(); }
};
// Solo geometría relativa: la división/redondeo sucede ANTES de Number.
export const coordenadaGrafica = (valor, escala) => escala === 0n ? 0 : Number(dividirYRedondear(valor * 1000000n, escala)) / 1000000;
export const planGrafica = (data, filtros) => {
    if (!['BARRAS', 'LINEAS', 'SECTORES'].includes(filtros.grafico) ||
        !(data.fuente === 'PERDIDAS' ? ['CANTIDAD_RETIROS', 'PERDIDA'] : ['CANTIDAD', 'IMPORTE']).includes(filtros.metrica)) throw new Error('Selector gráfico inválido');
    if (!data.intervalos.length || data.intervalos.length > 1200 || !data.series.length || data.series.length > 8) throw errorLimiteExportacion();
    const series = data.series.filter(s => s.metrica === filtros.metrica);
    const distribucion = data.distribuciones.find(d => d.metrica === filtros.metrica);
    if (!series.length || series.length > 4 || !distribucion || series.some(s => s.valores.length !== data.intervalos.length || s.unidad !== distribucion.unidad)) throw new Error('Gráfica inconsistente');
    const decimales = distribucion.unidad === 'IMPORTE_MONETARIO' ? 2 : 0;
    const entero = s => { if (!(decimales ? /^(0|[1-9]\d*)\.\d{2}$/ : /^(0|[1-9]\d*)$/).test(s)) throw new Error('Valor gráfico inválido'); return decimalAEntero(s, decimales); };
    const valores = series.map(s => s.valores.map(entero));
    const sectores = distribucion.categorias.map(c => entero(c.valor));
    const sector = filtros.grafico === 'SECTORES';
    const escala = sector ? sectores.reduce((a, b) => a + b, 0n) : valores.reduce((a, s) => s.reduce((m, v) => v > m ? v : m, a), 0n);
    const resolucion = (sector ? sectores : valores.flat()).some(v => v > 0n && coordenadaGrafica(v, escala) < 1 / 380);
    return { series, distribucion, valores, sectores, escala, referencia: enteroADecimal(escala, decimales),
        unidad: distribucion.unidad, resolucion, paneles: sector ? 1 : Math.ceil(data.intervalos.length / 60) };
};
// La tabla del spool debe coincidir campo por campo con TODA la representación,
// no solo con la métrica elegida o un conteo. No hay extracción adicional.
export const comprobarTablaEstadistica = async ({ archivos, metadata, filas, comprobar }) => {
    const esperado = filasEstadisticas(metadata); let n = 0;
    for await (const fila of leerSpool(archivos.rutas.spool, comprobar)) {
        const siguiente = esperado.next();
        if (siguiente.done || JSON.stringify(fila) !== JSON.stringify(siguiente.value)) throw new Error('Tabla estadística inconsistente');
        n++;
    }
    if (!esperado.next().done || n !== filas || n > 9600) throw new Error('Tabla estadística incompleta');
    await archivos.verificar('spool');
};
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export const svgPanel = (data, filtros, plan, panel) => {
    if (panel < 0 || panel >= plan.paneles) throw new Error('Panel inválido');
    const partes = ['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="white"/>'];
    const texto = (s, x, y, size = 20) => partes.push(`<text x="${x}" y="${y}" font-family="Noto Sans" font-size="${size}" fill="#172b3a">${xml(s)}</text>`);
    texto(`CADEFAR | ${data.fuente} | ${filtros.grafico} | Panel ${panel + 1} de ${plan.paneles}`, 30, 30, 22);
    texto(`${filtros.metrica} / ${plan.unidad}`, 30, 60);
    // Referencia exacta también se incluye como texto completo en PDF/XLSX.
    const referencia = `Escala relativa aproximada, referencia exacta S=${plan.referencia}`;
    const ref = referencia.length <= 210 ? referencia : 'Escala relativa aproximada; referencia exacta S completa en el texto adjunto del documento.';
    for (let i = 0; i < ref.length; i += 90) texto(ref.slice(i, i + 90), 30, 90 + i / 90 * 26);
    const inicio = panel * 60, fin = Math.min(inicio + 60, data.intervalos.length), n = fin - inicio;
    if (plan.escala === 0n) texto('Sin valor para graficar', 330, 390, 28);
    if (filtros.grafico === 'SECTORES') {
        let acumulado = 0n;
        plan.sectores.forEach((v, i) => {
            if (!v) return;
            const a = coordenadaGrafica(acumulado, plan.escala) * 2 * Math.PI; acumulado += v;
            const b = coordenadaGrafica(acumulado, plan.escala) * 2 * Math.PI;
            if (v === plan.escala) partes.push(`<circle cx="600" cy="385" r="180" fill="${colores[i]}"/>`);
            else if (b > a) partes.push(`<path d="M600 385 L${600 + 180 * Math.cos(a)} ${385 + 180 * Math.sin(a)} A180 180 0 ${b - a > Math.PI ? 1 : 0} 1 ${600 + 180 * Math.cos(b)} ${385 + 180 * Math.sin(b)} Z" fill="${colores[i]}"/>`);
        });
    } else {
        partes.push('<path d="M70 200 V580 H1160" fill="none" stroke="#172b3a"/>');
        texto('S', 35, 210); texto('0', 35, 580);
        plan.valores.forEach((vs, j) => {
            const puntos = [];
            for (let i = inicio; i < fin; i++) {
                const x = 80 + (i - inicio + .5) * 1070 / n, y = 580 - coordenadaGrafica(vs[i], plan.escala) * 380;
                if (filtros.grafico === 'BARRAS') {
                    const w = 1070 / n / (plan.series.length + 1);
                    partes.push(`<rect x="${x - 1070 / n / 2 + (j + .5) * w}" y="${y}" width="${w}" height="${580 - y}" fill="${colores[j]}"/>`);
                } else { puntos.push(`${x},${y}`); partes.push(`<circle cx="${x}" cy="${y}" r="2" fill="${colores[j]}"/>`); }
            }
            if (filtros.grafico === 'LINEAS') partes.push(`<polyline points="${puntos.join(' ')}" stroke="${colores[j]}" stroke-width="2" fill="none"/>`);
        });
        const paso = Math.max(1, Math.ceil(n / 6));
        for (let i = inicio; i < fin; i++) if ((i - inicio) % paso === 0 || i === fin - 1) {
            const x = 80 + (i - inicio + .5) * 1070 / n;
            partes.push(`<text x="${x}" y="610" text-anchor="middle" font-family="Noto Sans" font-size="19">${xml(data.intervalos[i].etiqueta)}</text>`);
        }
    }
    plan.series.forEach((s, j) => {
        partes.push(`<rect x="30" y="${640 + j * 28}" width="18" height="18" fill="${colores[j]}"/>`);
        const valor = filtros.grafico === 'SECTORES' ? `: ${plan.distribucion.categorias[j].valor}` : '';
        texto(s.categoria + valor, 60, 656 + j * 28);
    });
    texto(plan.resolucion ? 'Valores positivos inferiores a resolución: consultar tabla exacta; no son cero.' : 'Geometría aproximada; datos exactos completos en tabla. Sin porcentajes.', 30, 785, 19);
    partes.push('</svg>'); return partes.join('');
};
export const rasterizadorGrafica = {
    async png(svg, comprobar) {
        comprobar();
        const worker = new Worker(new URL('./reporte-grafica.worker.js', import.meta.url), { workerData: svg,
            execArgv: [] });
        let timer;
        try {
            return await new Promise((resolve, reject) => {
                timer = setInterval(() => { try { comprobar(); } catch (e) { reject(e); } }, 25);
                worker.once('message', bytes => { try { comprobar(); resolve(Buffer.from(bytes)); } catch (e) { reject(e); } });
                worker.once('error', reject);
                worker.once('exit', code => reject(new Error(`Rasterización incompleta (${code})`)));
            });
        } finally { clearInterval(timer); await worker.terminate(); }
    }
};
export const comprobarPng = png => {
    if (png.length > DIMENSION_GRAFICA.bytes) throw errorLimiteExportacion();
    if (png.length < 45 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 800 || png.subarray(-8, -4).toString() !== 'IEND') throw new Error('PNG inválida');
    let pos = 8; const datos = []; let ihdr = false, fin = false;
    while (pos < png.length) {
        const n = png.readUInt32BE(pos), hasta = pos + 12 + n;
        if (hasta > png.length) throw new Error('PNG truncada');
        const tipo = png.subarray(pos + 4, pos + 8).toString();
        if (crc32(png.subarray(pos + 4, pos + 8 + n)) !== png.readUInt32BE(pos + 8 + n)) throw new Error('PNG CRC inválido');
        if (tipo === 'IHDR') {
            if (ihdr || pos !== 8 || n !== 13 || png[pos + 16] !== 8 || png[pos + 17] !== 6 || png[pos + 18] || png[pos + 19] || png[pos + 20]) throw new Error('PNG no representable');
            ihdr = true;
        } else if (tipo === 'IDAT') datos.push(png.subarray(pos + 8, pos + 8 + n));
        else if (tipo === 'IEND') { if (n || hasta !== png.length) throw new Error('PNG inválida'); fin = true; }
        pos = hasta;
    }
    if (!ihdr || !fin || !datos.length || inflateSync(Buffer.concat(datos), { maxOutputLength: 3840800 }).length !== 3840800) throw new Error('PNG incompleta');
};
export const generarPanel = async (opciones, plan, panel) => {
    const png = await rasterizadorGrafica.png(svgPanel(opciones.metadata, opciones.filtros, plan, panel), opciones.comprobar);
    comprobarPng(png);
    const tipo = `png${panel}`;
    opciones.archivos.agregarTemporal(tipo, `panel-${panel}.png`);
    const escritor = await opciones.archivos.escritor(tipo);
    await escritor.escribir(png); await escritor.cerrar(); await opciones.archivos.verificar(tipo);
    return opciones.archivos.rutas[tipo];
};
