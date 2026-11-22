import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

const fuente = fileURLToPath(new URL('../resources/fonts/NotoSans-Regular.ttf', import.meta.url));

// Documento propio, sin dependencias del exportador masivo de reportes.
export const generarComprobantePdf = documento => new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, font: fuente,
        info: { Title: `CADEFAR · ${documento.numero}`, Author: 'CADEFAR', Creator: 'CADEFAR' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    try {
        const ancho = doc.page.width - 84, limite = doc.page.height - 64;
        let y = 42, pagina = 0, cabeceraTabla = null;
        const cabecera = () => {
            pagina++;
            doc.fillColor('#16645c').fontSize(23).text('CADEFAR', 42, 42);
            doc.fillColor('#172b36').fontSize(13).text(`${documento.titulo} · ${documento.numero}`, 42, 78);
            doc.fontSize(9).fillColor('#52636b').text(documento.esPrueba ? 'Prueba local · Sin valor bancario ni fiscal' : 'Comprobante interno · No sustituye una factura fiscal', 42, 102);
            doc.fontSize(8).text(`CADEFAR · Página ${pagina}`, 42, doc.page.height - 54, { width: ancho, lineBreak: false, align: 'right' });
            y = 132;
        };
        cabecera();
        const nuevaPagina = () => { doc.addPage(); cabecera(); };
        // Se fragmentan las celdas por líneas para no perder filas ni textos largos.
        const envolver = (valor, width) => {
            const lineas = []; let linea = '';
            for (const c of String(valor)) {
                if (c === '\n' || doc.widthOfString(linea + c) > width) { lineas.push(linea); linea = c === '\n' ? '' : c; }
                else linea += c;
            }
            lineas.push(linea); return lineas;
        };
        const fila = (valores, proporciones, encabezado = false, numericas = false) => {
            doc.fontSize(9);
            const celdas = valores.map((valor, i) => envolver(valor, ancho * proporciones[i] - 14));
            const largo = Math.max(...celdas.map(c => c.length));
            for (let linea = 0; linea < largo; linea++) {
                if (y + 20 > limite) {
                    nuevaPagina();
                    if (cabeceraTabla && !encabezado) fila(cabeceraTabla, proporciones, true, true);
                }
                if (encabezado) doc.rect(42, y, ancho, 19).fill('#e8f1ef');
                let x = 42;
                celdas.forEach((celda, i) => {
                    doc.fillColor('#172b36').fontSize(9).text(celda[linea] || '', x + 7, y + 3, { width: ancho * proporciones[i] - 14, lineBreak: false, align: numericas && i > 0 ? 'right' : 'left' });
                    x += ancho * proporciones[i];
                });
                y += 19;
            }
            doc.moveTo(42, y).lineTo(42 + ancho, y).lineWidth(0.4).strokeColor('#d8e1e4').stroke();
        };
        documento.datos.forEach(par => fila(par, [.36, .64]));
        y += 16;
        if (documento.columnas.length) {
            const proporciones = [.43, .12, .24, .21];
            cabeceraTabla = documento.columnas;
            fila(documento.columnas, proporciones, true, true);
            documento.filas.forEach(valores => fila(valores, proporciones, false, true));
            cabeceraTabla = null;
            y += 16;
        }
        documento.totales.forEach(par => fila(par, [.60, .40], true, true));
        y += 16;
        documento.notas.forEach(nota => fila([nota], [1]));
        doc.end();
    } catch (error) { doc.destroy(); reject(error); }
});
