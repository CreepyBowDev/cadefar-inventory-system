import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import os from 'node:os';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { COLUMNAS_REPORTE, filasEstadisticas } from '../../src/business/services/reporte.plantillas.js';

// Lector independiente del serializador; conserva separadores y saltos citados.
function csv(bytes) {
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
    const s = bytes.toString('utf8').slice(1), filas = []; let i = 0;
    while (i < s.length) {
        const fila = [];
        for (;;) {
            assert.equal(s[i++], '"'); let valor = '';
            for (;;) {
                assert.ok(i < s.length, 'CSV completo');
                const c = s[i++];
                if (c !== '"') valor += c;
                else if (s[i] === '"') { valor += '"'; i++; }
                else break;
            }
            fila.push(valor);
            if (s[i] === ';') { i++; continue; }
            assert.equal(s.slice(i, i + 2), '\r\n'); i += 2; break;
        }
        filas.push(fila);
    }
    return filas;
}
const compacto = s => String(s).normalize('NFC').replace(/\s/gu, '');
const aplanar = (o, p = '') => Object.entries(o ?? {}).flatMap(([k, v]) => {
    const nombre = p ? `${p}.${k}` : k;
    return v !== null && typeof v === 'object' ? aplanar(v, nombre) : [[nombre, String(v)]];
});
async function pdf(bytes, columnas, esperado, estadistica) {
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true });
    const doc = await task.promise, items = []; let imagenes = 0;
    try {
        for (let n = 1; n <= doc.numPages; n++) {
            const p = await doc.getPage(n), content = await p.getTextContent({ disableNormalization: true });
            assert.ok(content.items.some(x => x.str === `Página ${n} de ${doc.numPages}`));
            items.push(...content.items.filter(x => x.str && !/^CADEFAR \||^Página \d+ de \d+$|^Detalle completo|^Tabla completa|^Fila \||^categoría \|/.test(x.str)));
            const ops = await p.getOperatorList();
            imagenes += ops.fnArray.filter(x => x === OPS.paintImageXObject).length;
            p.cleanup();
        }
        const texto = compacto(items.map(x => x.str).join('\n'));
        if (estadistica) {
            esperado.forEach((r, i) => assert.ok(texto.includes(compacto(`${i + 1}|${r.intervalo}|${r.desde}|${r.hasta}|${r.parcial}${r.categoria}|${r.metrica}|${r.unidad}|${r.valor}`))));
            assert.ok(imagenes > 0, 'Imagen realmente incrustada en PDF');
        } else {
            const inicios = items.flatMap((x, i) => /^Registro ID \d+$/.test(x.str) ? [i] : []);
            assert.equal(inicios.length, esperado.length);
            esperado.forEach((row, i) => {
                const porX = new Map();
                for (const x of items.slice(inicios[i], inicios[i + 1] ?? items.length)) porX.set(x.transform[4], (porX.get(x.transform[4]) ?? '') + x.str);
                assert.equal(items[inicios[i]].str, `Registro ID ${row[columnas[0]]}`);
                const registro = compacto([...porX.values()].join('\n'));
                columnas.forEach(c => assert.ok(registro.includes(compacto(row[c] ?? '—')), `Campo PDF ${c}`));
            });
        }
        return texto;
    } finally { await doc.cleanup(); await task.destroy(); }
}

export async function verificarFase10(t, ctx) {
    const { db, base, server, cookies, usuarios, request, snapshot, sqlReal, venta, compra, movimiento, existencia, v, auditor, logs } = ctx;
    const { reporteExportacionService: servicio } = await import('../../src/business/services/reporte.exportacion.service.js');
    const { reporteExtraccionRepository: extraccion } = await import('../../src/data/repositories/reporte.extraccion.repository.js');
    // Los modelos YA están fijados a la base aleatoria test. Desarrollo solamente
    // activa el perfil LOCAL existente, sin reemplazar checker, RAM, disco o SQL.
    assert.match(db.sequelize.config.database, /^cadefar_reportes_f6_[a-f0-9]{16}$/);
    assert.equal(db.sequelize.config.host, '127.0.0.1');
    const anterior = process.env.NODE_ENV;
    const raiz = await mkdtemp(join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'cadefar-fase10-'));
    await writeFile(join(raiz, 'vecino'), 'preservado');
    const tmp = t.mock.method(os, 'tmpdir', () => raiz);
    process.env.NODE_ENV = 'development';
    const rutas = ['reportes/ventas', 'reportes/compras', 'reportes/perdidas', 'inventario/movimientos'];
    const fuentes = ['VENTAS', 'COMPRAS', 'PERDIDAS', 'MOVIMIENTOS'];
    let responseActual, ultimo;
    const observar = (req, res) => { responseActual = res; };
    server.on('request', observar);
    const preparar = servicio.preparar;
    const envoltura = t.mock.method(servicio, 'preparar', async function (...args) {
        const res = responseActual, artefacto = await preparar.apply(this, args);
        let terminar;
        const limpio = new Promise(r => { terminar = r; });
        const limpiar = artefacto.limpiar;
        artefacto.limpiar = async () => { try { await limpiar(); } finally { terminar(); } };
        ultimo = { artefacto, res, limpio };
        return artefacto;
    });
    const crear = auditor.create.bind(auditor);
    const observarAuditoria = t.mock.method(auditor, 'create', async args => {
        if (args.data.tipo_evento.endsWith('_EXPORTAR') && args.data.resultado === 'EXITO') {
            assert.equal(ultimo.res.writableFinished, true, 'EXITO únicamente después de finish real');
            assert.equal(ultimo.res.getHeader('Content-Length'), String(ultimo.artefacto.bytes));
        }
        return crear(args);
    });
    const descargar = async (ruta, query, rol = 1) => {
        const antes = await db.BitacoraAuditoria.count();
        const r = await fetch(`${base}/${ruta}/exportar?${new URLSearchParams(query)}`, {
            headers: { Cookie: cookies[rol] }, signal: AbortSignal.timeout(60000) });
        assert.equal(r.status, 200, 'Descarga real disponible');
        const bytes = Buffer.from(await r.arrayBuffer()), capturado = ultimo;
        await capturado.limpio;
        assert.equal(Number(r.headers.get('content-length')), bytes.length);
        assert.equal(bytes.length, capturado.artefacto.bytes);
        assert.equal(r.headers.get('cache-control'), 'no-store');
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(r.headers.get('content-type'), { CSV: 'text/csv; charset=utf-8', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', PDF: 'application/pdf' }[query.formato]);
        assert.match(r.headers.get('content-disposition'), /^attachment; filename="cadefar-(ventas|compras|perdidas|movimientos)-(tabular|estadistica)-\d{8}-\d{6}-[a-f0-9]{32}\.(csv|xlsx|pdf)"$/);
        assert.equal(await db.BitacoraAuditoria.count(), antes + 1);
        const evento = await db.BitacoraAuditoria.findOne({ order: [['id_evento', 'DESC']], raw: true });
        assert.equal(evento.resultado, 'EXITO');
        assert.equal(evento.metadatos.estadoEntrega, 'FINALIZADA_SERVIDOR');
        assert.equal(evento.metadatos.cantidadFilas, String(capturado.artefacto.cantidadFilas));
        assert.equal(await db.BitacoraAuditoria.count({ where: { correlacion: evento.correlacion } }), 1);
        assert.deepEqual(await readdir(raiz), ['vecino']);
        return { bytes, ...capturado };
    };
    try {
        assert.ok(await servicio.comprobarDisponibilidad({ direccionRemota: '127.0.0.1' }), 'Preflight local real');
        await t.test('F10 sesiones inválida/expirada/revocada, roles, queries y HEAD sin generación', async () => {
            const generar = preparar;
            let generaciones = 0;
            const contador = t.mock.method(servicio, 'preparar', (...args) => { generaciones++; return generar.apply(servicio, args); });
            try {
                for (const [i, ruta] of rutas.entries()) {
                    const q = `${i < 3 ? 'dia=2026-11-10&' : ''}formato=CSV&presentacion=TABULAR`;
                    for (const rol of [0, 2, 3]) {
                        if (rol === 2 && i > 1) continue;
                        await request(`/${ruta}/exportar?${q}`, rol, rol ? 403 : 401);
                    }
                    const head = await fetch(`${base}/${ruta}/exportar?${q}`, { method: 'HEAD', headers: { Cookie: cookies[1] } });
                    assert.equal(head.status, 405); assert.equal(head.headers.get('allow'), 'GET');
                    assert.equal((await head.arrayBuffer()).byteLength, 0);
                    await request(`/${ruta}/exportar?${q}&limite=1`, 1, 400);
                    if (i === 3) await request(`/${ruta}/exportar?formato=CSV&presentacion=ESTADISTICA&granularidad=DIA`, 1, 400);
                    if (i < 3) {
                        await request(`/${ruta}/estadisticas?dia=2026-11-10&granularidad=INVALIDA`, 1, 400);
                        const h = await fetch(`${base}/${ruta}/estadisticas?dia=2026-11-10&granularidad=DIA`, { method: 'HEAD', headers: { Cookie: cookies[1] } });
                        assert.equal(h.status, 405); assert.equal(h.headers.get('allow'), 'GET');
                    }
                }
                const previa = cookies[1];
                try {
                    for (const token of ['invalido', jwt.sign({ idUsuario: usuarios[0].id_usuario, idRol: 1, versionCredenciales: 0 }, process.env.JWT_SECRET, { expiresIn: -1 })]) {
                        cookies[1] = `token=${token}`;
                        for (const ruta of rutas) await request(`/${ruta}/exportar?dia=2026-11-10&formato=CSV&presentacion=TABULAR`, 1, 401);
                    }
                    cookies[1] = previa;
                    await db.Usuario.update({ version_credenciales: 1 }, { where: { id_usuario: usuarios[0].id_usuario } });
                    for (const ruta of rutas) await request(`/${ruta}/exportar?dia=2026-11-10&formato=CSV&presentacion=TABULAR`, 1, 401);
                } finally {
                    cookies[1] = previa;
                    await db.Usuario.update({ version_credenciales: 0 }, { where: { id_usuario: usuarios[0].id_usuario } });
                }
                assert.equal(generaciones, 0);
                assert.deepEqual(await readdir(raiz), ['vecino']);
            } finally { contador.mock.restore(); }
        });
        // Más de una receta y detalle: agregados de cabecera no deben multiplicarse.
        await db.Receta.create({ id_venta: v[0].id_venta, fecha_receta: '2026-11-10', nombre_paciente: 'SINTETICO_F10',
            documento_paciente: 'SINTETICO_F10', nombre_medico: 'SINTETICO_F10', modalidad: 'Fixture', archivo_receta: null });
        await t.test('F10 estadísticas SQL conocidas, intervalos parciales, ceros, filtros, series/distribuciones', async () => {
            for (const ruta of rutas.slice(0, 3)) {
                const normal = await request(`/${ruta}?dia=2026-11-10`);
                for (const granularidad of ['DIA', 'MES', 'ANIO']) {
                    const s = (await request(`/${ruta}/estadisticas?desde=2026-11-09&hasta=2026-11-11&granularidad=${granularidad}`)).data;
                    assert.deepEqual(s.resumen, normal.data.resumen); assert.equal(s.sinDatos, false);
                    assert.equal(s.intervalos.length, granularidad === 'DIA' ? 3 : 1);
                    if (granularidad !== 'DIA') assert.equal(s.intervalos[0].parcial, true);
                    for (const serie of s.series) {
                        const centavos = serie.total.includes('.');
                        const entero = x => BigInt(x.replace('.', ''));
                        assert.equal(serie.valores.reduce((a, x) => a + entero(x), 0n), entero(serie.total));
                        if (granularidad === 'DIA') assert.deepEqual([serie.valores[0], serie.valores[2]], centavos ? ['0.00', '0.00'] : ['0', '0']);
                        assert.equal(s.distribuciones.find(d => d.metrica === serie.metrica).categorias.find(c => c.categoria === serie.categoria).valor, serie.total);
                    }
                }
                const vacio = (await request(`/${ruta}/estadisticas?dia=2099-01-01&granularidad=DIA`)).data;
                assert.equal(vacio.sinDatos, true);
                assert.ok(vacio.series.every(s => BigInt(s.total.replace('.', '')) === 0n));
                const filtro = ruta.endsWith('perdidas') ? 'motivo=DA%C3%91O' : 'estadoOperacion=ANULADA';
                const filtrada = (await request(`/${ruta}/estadisticas?dia=2026-11-10&granularidad=DIA&${filtro}`)).data;
                if (ruta.endsWith('perdidas')) { assert.equal(filtrada.sinDatos, false); assert.equal(filtrada.resumen.perdidaTotal, '0.00'); }
                else assert.equal(filtrada.resumen.confirmadas.cantidad, 0);
            }
        });
        const antesNegocio = await snapshot(), inicioSql = sqlReal.length;
        for (const [i, ruta] of rutas.entries()) for (const presentacion of i === 3 ? ['TABULAR'] : ['TABULAR', 'ESTADISTICA']) {
            const normal = await request(`/${ruta}${i === 3 ? '' : '?dia=2026-11-10'}`);
            const estadistica = presentacion === 'ESTADISTICA' ? (await request(`/${ruta}/estadisticas?dia=2026-11-10&granularidad=DIA`)).data : null;
            const esperado = estadistica ? [...filasEstadisticas(estadistica)] : i === 3 ? normal.data.map(r => ({
                ...r, idMedicamento: r.existencia.medicamento.idMedicamento, codigoExistencia: r.existencia.codigoExistencia,
                codigoMedicamento: r.existencia.medicamento.codigoMedicamento, nombreComercial: r.existencia.medicamento.nombreComercial,
                nombreUsuario: r.usuario?.nombreUsuario,
                idCompra: r.compra?.idCompra ?? null, idVenta: r.venta?.idVenta ?? null
            })) : normal.data.detalle;
            const columnas = COLUMNAS_REPORTE[estadistica ? 'ESTADISTICA' : fuentes[i]];
            for (const formato of ['CSV', 'XLSX', 'PDF']) await t.test(`F10 equivalencia GET/archivo ${fuentes[i]}/${presentacion}/${formato}`, async () => {
                const q = { formato, presentacion, ...(i < 3 ? { dia: '2026-11-10' } : {}),
                    ...(estadistica ? { granularidad: 'DIA', ...(formato !== 'CSV' ? { grafico: 'BARRAS', metrica: i === 2 ? 'PERDIDA' : 'IMPORTE' } : {}) } : {}) };
                const { bytes, artefacto } = await descargar(ruta, q, i > 1 ? 2 : 1);
                if (i < 3) assert.deepEqual(artefacto.metadata.resumen, normal.data.resumen);
                if (estadistica) assert.deepEqual(artefacto.metadata, estadistica);
                assert.equal(artefacto.cantidadFilas, esperado.length);
                if (formato === 'CSV') {
                    const filas = csv(bytes); assert.deepEqual(filas.shift(), columnas);
                    assert.deepEqual(filas, esperado.map(r => columnas.map(c => r[c] == null ? '' : String(r[c]))));
                } else if (formato === 'XLSX') {
                    const libro = new ExcelJS.Workbook(); await libro.xlsx.load(bytes);
                    const hoja = libro.getWorksheet(estadistica ? 'Estadisticas' : 'Detalle');
                    assert.equal(hoja.rowCount, esperado.length + 1);
                    esperado.forEach((r, n) => columnas.forEach((c, j) => {
                        const celda = hoja.getRow(n + 2).getCell(j + 1);
                        assert.equal(celda.value, r[c] == null ? null : String(r[c]), c);
                        assert.equal(celda.numFmt, '@'); assert.equal(celda.formula, undefined); assert.equal(celda.hyperlink, undefined);
                    }));
                    const resumen = new Map(libro.getWorksheet('Resumen').getSheetValues().filter(Boolean).map(r => [r[1], r[2]]));
                    for (const [k, valor] of aplanar(artefacto.metadata.resumen, 'resumen')) assert.equal(resumen.get(k), valor);
                    if (estadistica) {
                        assert.equal(libro.getWorksheet('Grafica').getImages().length, 1);
                        const imagen = libro.getImage(libro.getWorksheet('Grafica').getImages()[0].imageId);
                        assert.equal(Buffer.from(imagen.buffer).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
                        for (const [k, valor] of aplanar(estadistica.distribuciones, 'distribuciones')) assert.equal(resumen.get(k), valor);
                    }
                } else {
                    const texto = await pdf(bytes, columnas, esperado, estadistica);
                    for (const [k, valor] of aplanar(artefacto.metadata.resumen)) assert.ok(texto.includes(compacto(`${k}: ${valor}`)));
                }
                assert.doesNotMatch(bytes.toString('utf8'), /PRIVADO_F6|SINTETICO_F10/);
            });
        }
        assert.equal(await snapshot(), antesNegocio);
        for (const sql of sqlReal.slice(inicioSql).filter(s => /\b(INSERT INTO|UPDATE `|DELETE FROM|REPLACE INTO)\b/i.test(s))) assert.match(sql, /INSERT INTO `bitacora_auditoria`/);
        await t.test('F10 auditor: rechazo SQL exclusivo no destruye descarga válida', async () => {
            const fallo = t.mock.method(auditor, 'create', args => crear({ ...args, data: { ...args.data, resultado: 'INVALIDO_FIXTURE' } }));
            const antes = await db.BitacoraAuditoria.count();
            try {
                const r = await fetch(`${base}/reportes/ventas/exportar?dia=2026-11-10&formato=XLSX&presentacion=TABULAR`, { headers: { Cookie: cookies[1] } });
                assert.equal(r.status, 200); const bytes = Buffer.from(await r.arrayBuffer()); await ultimo.limpio;
                assert.equal(bytes.length, Number(r.headers.get('content-length')));
                const libro = new ExcelJS.Workbook(); await libro.xlsx.load(bytes); assert.equal(libro.getWorksheet('Detalle').rowCount, 5);
                assert.equal(await db.BitacoraAuditoria.count(), antes);
                assert.ok(logs.some(e => e?.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA'));
                assert.deepEqual(await readdir(raiz), ['vecino']);
            } finally { fallo.mock.restore(); }
        });
        await t.test('F10 concurrencia y aborto HTTP con SELECT real pendiente: rollback/cupo/terminal/cleanup', async () => {
            let avisar, terminar;
            const iniciado = new Promise(r => { avisar = r; }), terminado = new Promise(r => { terminar = r; });
            let tx, sqlTerminado = false, primera = true;
            const bloque = extraccion.bloque.bind(extraccion);
            const hook = t.mock.method(extraccion, 'bloque', async (...args) => {
                const filas = await bloque(...args);
                if (primera) {
                    primera = false; tx = args[2].transaction;
                    // SQL acotado de prueba en la conexión temporal, nunca KILL
                    // ni bloqueo de recursos de otra base/conexión ajena.
                    const pendiente = db.sequelize.query('SELECT SLEEP(0.5)', { transaction: tx });
                    avisar(); await pendiente; sqlTerminado = true;
                    assert.equal(tx.finished, undefined, 'No devolver conexión con SQL pendiente');
                }
                return filas;
            });
            const actual = servicio.preparar;
            const seguimiento = t.mock.method(servicio, 'preparar', async function (...args) {
                try { return await actual.apply(this, args); }
                finally { if (args[0] === 'VENTAS') terminar(); }
            });
            const antes = await db.BitacoraAuditoria.count();
            const abortar = new AbortController();
            const peticion = fetch(`${base}/reportes/ventas/exportar?dia=2026-11-10&formato=CSV&presentacion=TABULAR`, {
                headers: { Cookie: cookies[1] }, signal: abortar.signal });
            // Instalar rechazo antes de abortar: sin unhandled rejection.
            const rechazada = assert.rejects(peticion, e => e.name === 'AbortError');
            try {
                await iniciado;
                const ocupada = await fetch(`${base}/reportes/compras/exportar?dia=2026-11-10&formato=PDF&presentacion=TABULAR`, { headers: { Cookie: cookies[1] } });
                assert.equal(ocupada.status, 503); assert.equal(ocupada.headers.get('retry-after'), '5');
                assert.match((await ocupada.json()).message, /ocupada/);
                abortar.abort(); await rechazada; await terminado;
                assert.equal(sqlTerminado, true); assert.equal(tx.finished, 'rollback');
                assert.equal(await db.BitacoraAuditoria.count(), antes + 2);
                const eventos = await db.BitacoraAuditoria.findAll({ order: [['id_evento', 'DESC']], limit: 2, raw: true });
                assert.deepEqual(eventos.map(e => e.causa).sort(), ['CANCELACION_CLIENTE', 'RECURSO_NO_DISPONIBLE']);
                assert.ok(eventos.every(e => e.resultado !== 'EXITO'));
                for (const e of eventos) assert.equal(await db.BitacoraAuditoria.count({ where: { correlacion: e.correlacion } }), 1);
                assert.deepEqual(await readdir(raiz), ['vecino']);
            } finally { abortar.abort(); await terminado; hook.mock.restore(); seguimiento.mock.restore(); }
            await descargar(rutas[0], { dia: '2026-11-10', formato: 'CSV', presentacion: 'TABULAR' });
        });
        await t.test('F10 fallo SQL real durante bloque: 500 seguro, rollback, terminal único y cupo recuperado', async () => {
            let tx;
            const hook = t.mock.method(extraccion, 'bloque', async (fuente, f, opts) => {
                tx = opts.transaction;
                await db.sequelize.query('SELECT columna_f10_inexistente FROM venta', { transaction: tx });
            });
            const antes = await db.BitacoraAuditoria.count();
            try {
                assert.deepEqual(await request('/reportes/ventas/exportar?dia=2026-11-10&formato=CSV&presentacion=TABULAR', 1, 500), { message: 'Error interno del servidor' });
                assert.equal(tx.finished, 'rollback'); assert.equal(await db.BitacoraAuditoria.count(), antes + 1);
                const e = await db.BitacoraAuditoria.findOne({ order: [['id_evento', 'DESC']], raw: true });
                assert.equal(e.resultado, 'FALLO'); assert.equal(e.causa, 'ERROR_INTERNO');
                assert.equal(await db.BitacoraAuditoria.count({ where: { correlacion: e.correlacion } }), 1);
                assert.deepEqual(await readdir(raiz), ['vecino']);
            } finally { hook.mock.restore(); }
            await descargar(rutas[0], { dia: '2026-11-10', formato: 'CSV', presentacion: 'TABULAR' });
        });
        await t.test('F10 extremos persistidos exportados: DECIMAL/INT y años 1000/9999, sin fracciones inventadas', async () => {
            // Fechas aisladas: no alteran los fixtures históricos de la suite base.
            await venta('CONFIRMADA', '1000-01-02 00:00:00', { total: '999999999999.99' });
            await venta('CONFIRMADA', '1000-01-02 23:59:59', { total: '999999999999.99' });
            await compra('CONFIRMADA', '9999-12-30', { total: '999999999999.99' });
            for (let n = 0; n < 2; n++) await movimiento('DAÑO', '9999-12-30 23:59:59', { cantidad: 2147483647, costo_unitario_aplicado: '99999999.999999' });
            for (const [i, dia] of [[0, '1000-01-02'], [1, '9999-12-30'], [2, '9999-12-30']]) {
                const get = (await request(`/${rutas[i]}?dia=${dia}`)).data;
                if (i === 0) assert.equal(get.resumen.totalVentasRealizadas, '1999999999999.98');
                if (i === 2) assert.equal(get.resumen.cantidadRetirada, '4294967294');
                const estadistica = (await request(`/${rutas[i]}/estadisticas?dia=${dia}&granularidad=DIA`)).data;
                assert.deepEqual(estadistica.resumen, get.resumen);
                for (const presentacion of ['TABULAR', 'ESTADISTICA']) for (const formato of ['CSV', 'XLSX', 'PDF']) {
                    const s = presentacion === 'ESTADISTICA';
                    const esperado = s ? [...filasEstadisticas(estadistica)] : get.detalle;
                    const columnas = COLUMNAS_REPORTE[s ? 'ESTADISTICA' : fuentes[i]];
                    const q = { dia, formato, presentacion, ...(s ? { granularidad: 'DIA', ...(formato === 'CSV' ? {} : { grafico: 'SECTORES', metrica: i === 2 ? 'PERDIDA' : 'IMPORTE' }) } : {}) };
                    const { bytes } = await descargar(rutas[i], q);
                    if (formato === 'CSV') {
                        const filas = csv(bytes); assert.deepEqual(filas.shift(), columnas);
                        assert.deepEqual(filas, esperado.map(r => columnas.map(c => r[c] == null ? '' : String(r[c]))));
                    } else if (formato === 'XLSX') {
                        const libro = new ExcelJS.Workbook(); await libro.xlsx.load(bytes);
                        const hoja = libro.getWorksheet(s ? 'Estadisticas' : 'Detalle');
                        assert.equal(hoja.rowCount, esperado.length + 1);
                        esperado.forEach((r, n) => columnas.forEach((c, j) => {
                            const celda = hoja.getRow(n + 2).getCell(j + 1);
                            assert.equal(celda.value, r[c] == null ? null : String(r[c])); assert.equal(celda.numFmt, '@');
                        }));
                    } else await pdf(bytes, columnas, esperado, s);
                }
            }
        });
        // Solo 1002 registros por fuente, no ensayo de carga ni máximos arbitrarios.
        for (const [i, fuente] of fuentes.entries()) await t.test(`F10 keyset/snapshot multibloque ${fuente}: COMMIT externo entre bloques`, async () => {
            const fecha = `2027-01-${String(i + 1).padStart(2, '0')}`;
            const crearFila = () => i === 0 ? venta('CONFIRMADA', `${fecha} 12:00:00`) : i === 1 ? compra('CONFIRMADA', fecha) : movimiento('DAÑO', `${fecha} 12:00:00`);
            const ids = [];
            for (let n = 0; n < 1002; n++) {
                const row = await crearFila(); ids.push(row[i === 0 ? 'id_venta' : i === 1 ? 'id_compra' : 'id_movimiento']);
            }
            const original = extraccion.bloque.bind(extraccion);
            let bloques = 0, tx, lector, escritor, nuevo;
            const hook = t.mock.method(extraccion, 'bloque', async (f, filtros, opts) => {
                const filas = await original(f, filtros, opts);
                assert.equal(f, fuente); assert.equal(opts.limite, 1000);
                if (!tx) tx = opts.transaction; else assert.equal(opts.transaction, tx);
                if (++bloques === 1) {
                    assert.equal(filas.length, 1000);
                    const [id] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { transaction: tx }); lector = id[0].id;
                    await db.sequelize.transaction(async transaction => {
                        const [id2] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { transaction }); escritor = id2[0].id;
                        const modelo = i === 0 ? db.Venta : i === 1 ? db.Compra : db.MovimientoInventario;
                        await modelo.update(i < 2 ? { estado_operacion: 'ANULADA' } : { costo_unitario_aplicado: '1.000000' }, {
                            where: { [modelo.primaryKeyAttribute]: ids[0] }, transaction });
                        if (i > 1) {
                            const row = await db.MovimientoInventario.create({ id_usuario: usuarios[1].id_usuario,
                                id_existencia: existencia.id_existencia, direccion: 'ENTRADA', motivo: 'DAÑO', cantidad: 1,
                                costo_unitario_aplicado: '0.005000', fecha_movimiento: db.Sequelize.fn('STR_TO_DATE', `${fecha} 13:00:00`, '%Y-%m-%d %H:%i:%s'),
                                id_movimiento_original: ids[0] }, { transaction }); nuevo = row.id_movimiento;
                        }
                    });
                }
                return filas;
            });
            const q = { formato: 'CSV', presentacion: 'TABULAR', ...(i < 3 ? { dia: fecha } : { desde: fecha, hasta: fecha }) };
            let archivo;
            try { archivo = await descargar(rutas[i], q); } finally { hook.mock.restore(); }
            assert.equal(bloques, 3); assert.notEqual(lector, escritor);
            assert.equal(tx.options.isolationLevel, 'REPEATABLE READ'); assert.equal(tx.finished, 'commit');
            const tabla = csv(archivo.bytes), columnas = tabla.shift();
            assert.deepEqual(tabla.map(r => Number(r[0])), [...ids].reverse());
            assert.equal(new Set(tabla.map(r => r[0])).size, 1002);
            const ultima = tabla.at(-1);
            assert.equal(ultima[columnas.indexOf(i < 2 ? 'estadoOperacion' : 'costoUnitarioAplicado')], i < 2 ? 'CONFIRMADA' : '0.005000');
            if (i > 1) assert.equal(ultima[columnas.indexOf('idMovimientoReversion')], '');
            const nueva = csv((await descargar(rutas[i], q)).bytes); nueva.shift();
            const cambiada = nueva.find(r => Number(r[0]) === ids[0]);
            assert.equal(cambiada[columnas.indexOf(i < 2 ? 'estadoOperacion' : 'costoUnitarioAplicado')], i < 2 ? 'ANULADA' : '1.000000');
            if (i > 1) assert.equal(cambiada[columnas.indexOf('idMovimientoReversion')], String(nuevo));
            assert.equal(nueva.length, i === 3 ? 1003 : 1002);
            t.diagnostic(`${fuente}: 1000+2+0 filas, lector ${lector}, escritor ${escritor}; snapshot conservado, siguiente petición ve COMMIT`);
            if (i < 3) {
                const antes = (await request(`/${rutas[i]}/estadisticas?dia=${fecha}&granularidad=DIA`)).data;
                const modelo = i === 0 ? db.Venta : i === 1 ? db.Compra : db.MovimientoInventario;
                const findAll = modelo.findAll.bind(modelo);
                let primera = true, snapshotStats, lectorStats, escritorStats;
                const estadisticas = t.mock.method(modelo, 'findAll', async opts => {
                    const filas = await findAll(opts);
                    if (opts.transaction && opts.group) {
                        if (!snapshotStats) snapshotStats = opts.transaction;
                        else assert.equal(opts.transaction, snapshotStats);
                        if (primera) {
                            primera = false;
                            const [id] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { transaction: opts.transaction }); lectorStats = id[0].id;
                            await db.sequelize.transaction(async transaction => {
                                const [id2] = await db.sequelize.query('SELECT CONNECTION_ID() AS id', { transaction }); escritorStats = id2[0].id;
                                await modelo.update(i < 2 ? { estado_operacion: 'ANULADA' } : { costo_unitario_aplicado: '2.000000' }, {
                                    where: { [modelo.primaryKeyAttribute]: ids[1] }, transaction });
                            });
                        }
                    }
                    return filas;
                });
                try {
                    const { artefacto } = await descargar(rutas[i], { dia: fecha, formato: 'XLSX', presentacion: 'ESTADISTICA', granularidad: 'DIA', grafico: 'LINEAS', metrica: i === 2 ? 'PERDIDA' : 'IMPORTE' });
                    assert.deepEqual(artefacto.metadata, antes, 'Agregado y series del mismo snapshot previo al COMMIT externo');
                    assert.notEqual(lectorStats, escritorStats); assert.equal(snapshotStats.finished, 'commit');
                } finally { estadisticas.mock.restore(); }
                const siguiente = (await request(`/${rutas[i]}/estadisticas?dia=${fecha}&granularidad=DIA`)).data;
                assert.notDeepEqual(siguiente.resumen, antes.resumen);
                t.diagnostic(`${fuente}: agregado → COMMIT conexión ${escritorStats} → series conexión ${lectorStats}; XLSX conserva snapshot y siguiente GET ve cambio`);
            }
        });
        t.diagnostic('F10: preflight RAM/disco real instantáneo, sin benchmark de pico ni certificación ACL; 21 variantes reales completas, sin recepción humana acreditada');
    } finally {
        observarAuditoria.mock.restore(); envoltura.mock.restore(); server.off('request', observar);
        process.env.NODE_ENV = anterior; tmp.mock.restore();
        const residuos = await readdir(raiz);
        assert.deepEqual(residuos, ['vecino'], 'No borrar residuos no reconciliados');
        assert.equal(await readFile(join(raiz, 'vecino'), 'utf8'), 'preservado');
        await rm(raiz, { recursive: true });
        await assert.rejects(stat(raiz), { code: 'ENOENT' });
        t.diagnostic('Limpieza F10 verificada: directorio propio sin trabajos residuales; vecino sintético preservado hasta cierre');
    }
}
