import test from 'node:test';
import assert from 'node:assert/strict';
import { construirIntervalos, materializarEstadisticas } from '../src/business/services/reporte.estadisticas.js';
import { reporteValidator as v } from '../src/business/validators/reporte.validator.js';
import { decimalAEntero, enteroADecimal } from '../src/shared/utils/decimal.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'estadisticas_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_estadisticas_tests';
const { default: db } = await import('../src/data/models/index.js');
const { app } = await import('../src/app.js');
const { authService } = await import('../src/business/services/auth.service.js');
const { reporteService } = await import('../src/business/services/reporte.service.js');
const { reporteRepository } = await import('../src/data/repositories/reporte.repository.js');
const { bitacoraAuditoriaRepository } = await import('../src/data/repositories/bitacora-auditoria.repository.js');
const { generarToken } = await import('../src/shared/utils/jwt.js');
const { CATALOGO_AUDITORIA } = await import('../src/shared/constants/auditoria.js');
const { identificarOperacionAuditoria } = await import('../src/shared/constants/auditoria-operaciones.js');
const { prepararEventoAuditoria } = await import('../src/business/validators/auditoria.validator.js');

const fuentes = [['ventas', 'VENTAS', db.Venta, 'categoria'], ['compras', 'COMPRAS', db.Compra, 'estado_operacion']];
const validar = (fuente, query) => v[fuente === 'ventas' ? 'validateEstadisticasVentas' : 'validateEstadisticasCompras'](query).data;
const periodo = (desde, hasta) => ({ desde, hasta });

test('Intervalos civiles: parciales, bisiestos, cambios de año y extremos, sin año 10000', () => {
    assert.deepEqual(construirIntervalos(periodo('2026-11-15', '2026-12-05'), 'MES'), [
        { etiqueta: '2026-11', desde: '2026-11-15', hasta: '2026-11-30', parcial: true },
        { etiqueta: '2026-12', desde: '2026-12-01', hasta: '2026-12-05', parcial: true }]);
    for (const [desde, hasta, granularidad, etiquetas, parciales] of [
        ['2000-02-28', '2000-03-01', 'DIA', ['2000-02-28', '2000-02-29', '2000-03-01'], [false, false, false]],
        ['1900-02-28', '1900-03-01', 'DIA', ['1900-02-28', '1900-03-01'], [false, false]],
        ['2026-12-31', '2027-01-01', 'ANIO', ['2026', '2027'], [true, true]],
        ['1000-01-01', '1000-12-31', 'ANIO', ['1000'], [false]],
        ['9999-12-31', '9999-12-31', 'DIA', ['9999-12-31'], [false]],
        ['9999-12-01', '9999-12-31', 'MES', ['9999-12'], [false]],
        ['9999-01-01', '9999-12-31', 'ANIO', ['9999'], [false]]
    ]) {
        const result = construirIntervalos(periodo(desde, hasta), granularidad);
        assert.deepEqual(result.map(i => i.etiqueta), etiquetas);
        assert.deepEqual(result.map(i => i.parcial), parciales);
        assert.equal(result.at(-1).hasta, hasta);
    }
});

test('Límite antes de crear listas: 1200/1201 en las tres granularidades', async t => {
    t.mock.method(db.sequelize, 'transaction', () => assert.fail('No abrir snapshot'));
    for (const [granularidad, desde, hasta, exceso] of [
        ['DIA', '2000-01-01', '2003-04-14', '2003-04-15'],
        ['MES', '1000-01-31', '1099-12-01', '1100-01-01'],
        ['ANIO', '1000-12-31', '2199-01-01', '2200-01-01']
    ]) {
        assert.equal(construirIntervalos(periodo(desde, hasta), granularidad).length, 1200);
        assert.throws(() => construirIntervalos(periodo(desde, exceso), granularidad), /supera 1200 intervalos/);
        for (const metodo of ['estadisticasVentas', 'estadisticasCompras']) {
            await assert.rejects(reporteService[metodo]({ periodo: periodo(desde, exceso), granularidad }, {}), /supera 1200/);
        }
    }
});

// Evaluador de fixtures, NO motor SQL. Detalles/recetas deliberadamente ignorados.
const agrupar = (filas, campo, temporal, granularidad) => {
    const grupos = new Map();
    for (const fila of filas) {
        const categoria = campo === 'categoria' && fila.estado === 'ANULADA'
            ? fila.fechaVenta ? 'ANULADA_CONFIRMADA' : 'ANULADA_SIN_CONFIRMAR' : fila.estado;
        const fecha = campo === 'categoria' ? fila.fechaVenta ?? fila.fechaRegistro : fila.fechaCompra;
        const etiqueta = fecha.slice(0, { DIA: 10, MES: 7, ANIO: 4 }[granularidad]);
        const clave = `${categoria}/${temporal ? etiqueta : ''}`;
        const grupo = grupos.get(clave) ?? { [campo]: categoria, ...(temporal ? { etiqueta } : {}), cantidad: 0n, importe: 0n };
        grupo.cantidad++;
        grupo.importe += decimalAEntero(fila.total, 2);
        grupos.set(clave, grupo);
    }
    return [...grupos.values()].map(g => ({ ...g, cantidad: String(g.cantidad), importe: enteroADecimal(g.importe, 2) }));
};
const fila = (estado, fecha, total = '12.30', confirmada = true) => ({ estado,
    fechaVenta: confirmada ? `${fecha} 23:59:59.999999` : null, fechaCompra: fecha,
    fechaRegistro: confirmada ? '2025-01-01 00:00:00' : `${fecha} 00:00:00`, total,
    fechaAnulacion: '2028-01-01', detalles: [1, 2, 3], recetas: [1, 2] });

for (const [ruta, fuente, modelo, campo] of fuentes) {
    test(`${fuente}: HTTP montado, snapshot simulado, contrato y auditoría independiente`, async t => {
        let filas = [], activo = false, lecturas = [], eventos = [], intercalar, fallo, falloAuditor = false;
        t.mock.method(console, 'error', () => {});
        t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
        t.mock.method(authService, 'getSessionUsuario', async id => ({ idUsuario: id, idRol: id, nombreUsuario: `actor${id}` }));
        t.mock.method(db.sequelize, 'transaction', async (options, callback) => {
            if (typeof options === 'function') {
                assert.equal(activo, false);
                return options({ auditor: true });
            }
            assert.equal(options.isolationLevel, db.Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ);
            activo = true;
            try {
                const resultado = await callback({ snapshot: structuredClone(filas) });
                if (fallo === 'cierre') throw new Error('privado_SQL');
                return resultado;
            } finally { activo = false; }
        });
        t.mock.method(bitacoraAuditoriaRepository, 'create', async ({ data, transaction }) => {
            assert.equal(activo, false);
            assert.equal(transaction.auditor, true);
            eventos.push(data);
            if (falloAuditor) throw new Error('privado_SQL');
            return eventos.length;
        });
        t.mock.method(modelo, 'findAll', async options => {
            assert.equal(activo, true);
            assert.equal(options.include, undefined);
            assert.equal(options.limit, undefined);
            assert.equal(options.lock, undefined);
            assert.ok(options.group);
            lecturas.push(options);
            if (fallo === 'consulta') throw new Error('SELECT privado_SQL');
            const temporal = options.group.length === 2;
            if (temporal) {
                assert.equal(options.transaction, lecturas.at(-2).transaction);
                assert.equal(options.where, lecturas.at(-2).where);
            }
            const desde = ruta === 'compras' ? options.where.fecha_compra[db.Sequelize.Op.gte]
                : options.where[db.Sequelize.Op.or][0].fecha_venta[db.Sequelize.Op.gte].args[0].slice(0, 10);
            const hasta = ruta === 'compras' ? options.where.fecha_compra[db.Sequelize.Op.lte]
                : options.where[db.Sequelize.Op.or][0].fecha_venta[db.Sequelize.Op.lte].args[0].slice(0, 10);
            const seleccion = options.transaction.snapshot.filter(f => {
                const fecha = (ruta === 'compras' ? f.fechaCompra : f.fechaVenta ?? f.fechaRegistro).slice(0, 10);
                return fecha >= desde && fecha <= hasta && (!options.where.estado_operacion || f.estado === options.where.estado_operacion);
            });
            const formato = temporal ? options.attributes.find(a => a[1] === 'etiqueta')[0].args[1] : '%Y-%m-%d';
            const granularidad = { '%Y-%m-%d': 'DIA', '%Y-%m': 'MES', '%Y': 'ANIO' }[formato];
            const grupos = agrupar(seleccion, campo, temporal, granularidad);
            if (!temporal && intercalar) { intercalar(); intercalar = undefined; }
            if (fallo === 'conteo') return [{ [campo]: 'CONFIRMADA', cantidad: '9007199254740992', importe: '0.00', etiqueta: desde }];
            if (temporal && fallo === 'conciliacion') return [];
            if (temporal && fallo === 'materializacion') return [{ [campo]: 'CONFIRMADA', cantidad: '1', importe: 'privado_SQL', etiqueta: desde }];
            return grupos;
        });
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const request = async (query = 'dia=2026-11-15&granularidad=DIA', status = 200, rol = 1, method = 'GET', invalido = false) => {
            const antes = eventos.length;
            const token = invalido ? 'invalido' : rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null;
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/${ruta}/estadisticas?${query}`, {
                method, headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000) });
            const body = method === 'HEAD' ? null : await response.json();
            assert.equal(response.status, status, JSON.stringify(body));
            assert.doesNotMatch(JSON.stringify(body), /privado_SQL|SELECT|password|stack/);
            if (method !== 'HEAD') {
                assert.equal(eventos.length, antes + 1);
                if (status !== 200) assert.equal(eventos.at(-1).metadatos.operacionOrigen, `REPORTES.ESTADISTICAS_${fuente}`);
            } else {
                assert.equal(response.headers.get('allow'), 'GET');
                assert.equal(eventos.length, antes);
            }
            return body;
        };
        try {
            await t.test('401/403 y HEAD 405 sin lecturas ni éxito', async () => {
                await request('', 401, null);
                await request('', 401, 1, 'GET', true);
                await request('', 403, 2);
                await request('', 403, 3);
                await request('', 405, 1, 'HEAD');
                assert.equal(lecturas.length, 0);
            });
            await t.test('400 query estricta y traducción exacta del límite antes del snapshot', async () => {
                for (const query of ['', 'dia=2026-11-15', 'dia=2026-11-15&granularidad=dia',
                    'dia=2026-11-15&granularidad=DIA&granularidad=DIA', 'dia=2026-11-15&dia=2026-11-15&granularidad=DIA',
                    'dia=2026-11-15&mes=2026-11&granularidad=DIA', 'dia=2026-02-29&granularidad=DIA',
                    ...['pagina=1', 'limite=25', 'formato=CSV', 'grafico=BARRAS', 'metrica=IMPORTE', 'foo=x', 'estadoOperacion=OTRO']
                        .map(extra => `dia=2026-11-15&granularidad=DIA&${extra}`)]) {
                    assert.equal((await request(query, 400)).message, 'Datos inválidos');
                }
                for (const [granularidad, desde, hasta] of [['DIA', '2000-01-01', '2003-04-15'],
                    ['MES', '1000-01-31', '1100-01-01'], ['ANIO', '1000-12-31', '2200-01-01']]) {
                    assert.equal((await request(`desde=${desde}&hasta=${hasta}&granularidad=${granularidad}`, 400)).message,
                        'La consulta supera 1200 intervalos; elija otra granularidad o un período menor');
                    assert.equal(eventos.at(-1).tipo_evento, 'VALIDACION_RECHAZADA');
                }
                assert.equal(lecturas.length, 0);
            });
            await t.test('Contrato completo exacto, vacío y operación cero no son equivalentes', async () => {
                const vacio = await request();
                assert.deepEqual(Object.keys(vacio), ['data']);
                assert.deepEqual(Object.keys(vacio.data), ['fuente', 'periodo', 'filtros', 'granularidad', 'sinDatos', 'resumen', 'intervalos', 'series', 'distribuciones']);
                assert.equal(vacio.data.sinDatos, true);
                assert.ok(vacio.data.series.every(s => s.valores[0] === (s.metrica === 'CANTIDAD' ? '0' : '0.00')));
                filas = [fila('CONFIRMADA', '2026-11-15')];
                const body = await request('desde=2026-11-15&hasta=2026-11-20&granularidad=MES');
                const categorias = ruta === 'ventas' ? ['CONFIRMADA', 'PENDIENTE', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR'] : ['CONFIRMADA', 'ANULADA'];
                const resumen = ruta === 'ventas' ? { confirmadas: { cantidad: 1, importe: '12.30' }, pendientes: { cantidad: 0, importe: '0.00' },
                    anuladasConfirmadas: { cantidad: 0, importe: '0.00' }, anuladasSinConfirmar: { cantidad: 0, importe: '0.00' }, totalVentasRealizadas: '12.30' }
                    : { confirmadas: { cantidad: 1, importe: '12.30' }, anuladas: { cantidad: 0, importe: '0.00' }, totalComprasRealizadas: '12.30' };
                assert.deepEqual(body, { data: { fuente,
                    periodo: { modalidad: 'PERIODO', desde: '2026-11-15', hasta: '2026-11-20', zonaHoraria: 'America/La_Paz' },
                    filtros: { estadoOperacion: null }, granularidad: 'MES', sinDatos: false, resumen,
                    intervalos: [{ etiqueta: '2026-11', desde: '2026-11-15', hasta: '2026-11-20', parcial: true }],
                    series: categorias.flatMap((categoria, i) => [['CANTIDAD', 'OPERACIONES'], ['IMPORTE', 'IMPORTE_MONETARIO']].map(([metrica, unidad], m) => {
                        const total = i === 0 ? m === 0 ? '1' : '12.30' : m === 0 ? '0' : '0.00';
                        return { categoria, metrica, unidad, valores: [total], total };
                    })),
                    distribuciones: [['CANTIDAD', 'OPERACIONES'], ['IMPORTE', 'IMPORTE_MONETARIO']].map(([metrica, unidad], m) => ({
                        metrica, unidad, total: m === 0 ? '1' : '12.30', categorias: categorias.map((categoria, i) => ({ categoria,
                            valor: i === 0 ? m === 0 ? '1' : '12.30' : m === 0 ? '0' : '0.00' })) })) } });
                assert.deepEqual(eventos.at(-1).metadatos, { granularidad: 'MES', cantidadIntervalos: 1 });
                assert.equal(eventos.at(-1).tipo_evento, `REPORTE_${fuente}_ESTADISTICAS`);
                filas = [fila('CONFIRMADA', '2026-11-15', '0.00')];
                assert.equal((await request()).data.sinDatos, false);
            });
            await t.test('ANULADA, fechas de referencia/adquisición, categorías excluidas cero', async () => {
                filas = [fila('ANULADA', '2026-11-15', '10.00'), fila('ANULADA', '2026-11-16', '5.00', false),
                    fila('CONFIRMADA', '2026-11-15', '90.00'), fila('ANULADA', '2026-12-01', '99.00')];
                const body = await request('mes=2026-11&granularidad=DIA&estadoOperacion=ANULADA');
                assert.equal(body.data.distribuciones[0].total, '2');
                assert.equal(body.data.distribuciones[1].total, '15.00');
                assert.equal(body.data.resumen[ruta === 'ventas' ? 'totalVentasRealizadas' : 'totalComprasRealizadas'], '0.00');
                assert.equal(body.data.series[0].total, '0');
                if (ruta === 'ventas') {
                    assert.equal(body.data.series[5].valores[14], '10.00');
                    assert.equal(body.data.series[7].valores[15], '5.00');
                }
            });
            await t.test('Mismo snapshot ante cambio intercalado, importes iguales, múltiples detalles y enormes exactos', async () => {
                filas = [fila('CONFIRMADA', '2026-11-15'), fila('CONFIRMADA', '2026-11-15')];
                intercalar = () => { filas[0].estado = 'ANULADA'; };
                assert.equal((await request()).data.resumen.confirmadas.importe, '24.60');
                assert.equal((await request()).data.resumen.confirmadas.importe, '12.30');
                filas = [fila('CONFIRMADA', '2026-11-15', '12345678901234567890.12'), fila('CONFIRMADA', '2026-11-15', '0.20')];
                assert.equal((await request()).data.series[1].total, '12345678901234567890.32');
            });
            await t.test('1200 intervalos y extremos vacíos realmente materializados', async () => {
                filas = [];
                for (const query of ['desde=2000-01-01&hasta=2003-04-14&granularidad=DIA',
                    'desde=1000-01-31&hasta=1099-12-01&granularidad=MES', 'desde=1000-12-31&hasta=2199-01-01&granularidad=ANIO']) {
                    const body = await request(query);
                    assert.equal(body.data.intervalos.length, 1200);
                    assert.ok(body.data.series.every(s => s.valores.length === 1200));
                }
                for (const dia of ['1000-01-01', '9999-12-31', '2000-02-29']) await request(`dia=${dia}&granularidad=DIA`);
            });
            await t.test('500 seguro sin éxito ante consulta, materialización, conteo o conciliación; auditor caído independiente', async () => {
                filas = [fila('CONFIRMADA', '2026-11-15')];
                for (fallo of ['consulta', 'materializacion', 'conteo', 'conciliacion', 'cierre']) {
                    assert.deepEqual(await request(undefined, 500), { message: 'Error interno del servidor' });
                    assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
                    assert.equal(activo, false);
                }
                fallo = undefined;
                falloAuditor = true;
                await request();
                await request('', 400);
                fallo = 'consulta';
                await request(undefined, 500);
            });
        } finally { await new Promise(resolve => server.close(resolve)); }
    });
}

test('SQL Sequelize generado, NO MySQL: cabeceras, CASE compartido, adquisición y datos escapados', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const queries = [], transaction = new db.Sequelize.Transaction(db.sequelize, {});
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.transaction, transaction);
        queries.push(sql);
        return [];
    });
    for (const [ruta] of fuentes) for (const granularidad of ['DIA', 'MES', 'ANIO']) {
        const filtros = validar(ruta, { mes: '2026-11', granularidad, estadoOperacion: 'ANULADA' });
        await reporteRepository[ruta === 'ventas' ? 'estadisticasVentas' : 'estadisticasCompras'](filtros, { transaction });
        const [resumen, temporal] = queries.slice(-2);
        for (const sql of [resumen, temporal]) {
            assert.match(sql, /CAST\(COUNT\(`id_(venta|compra)`\) AS CHAR\)/);
            assert.match(sql, /CAST\(SUM\(`total`\) AS CHAR\)/);
            assert.doesNotMatch(sql, /JOIN|DISTINCT|LIMIT|FOR UPDATE|receta|detalle/i);
            assert.match(sql, /GROUP BY/);
        }
        assert.equal(resumen.split(' WHERE ')[1].split(' GROUP BY ')[0], temporal.split(' WHERE ')[1].split(' GROUP BY ')[0]);
        assert.ok(temporal.includes({ DIA: '%Y-%m-%d', MES: '%Y-%m', ANIO: '%Y' }[granularidad]));
        if (ruta === 'ventas') {
            assert.match(temporal, /ANULADA_SIN_CONFIRMAR/);
            assert.match(temporal, /THEN fecha_registro ELSE fecha_venta END/);
            assert.match(temporal, /23:59:59.999999/);
        } else {
            assert.match(temporal, /DATE_FORMAT\(`fecha_compra`/);
            assert.doesNotMatch(temporal, /fecha_registro|fecha_anulacion/);
        }
        const ataque = "' OR 1=1 --";
        await reporteRepository[ruta === 'ventas' ? 'estadisticasVentas' : 'estadisticasCompras']({ ...filtros, estadoOperacion: ataque }, { transaction });
        for (const sql of queries.slice(-2)) assert.ok(sql.includes(db.sequelize.escape(ataque)));
    }
});

test('Auditoría: catálogo/clasificación/allowlist reales, sin snapshots ni datos privados', () => {
    for (const [ruta, fuente] of fuentes) {
        const tipoEvento = `REPORTE_${fuente}_ESTADISTICAS`;
        assert.deepEqual(CATALOGO_AUDITORIA[tipoEvento], { modulo: 'REPORTES', accion: `ESTADISTICAS_${fuente}`, perfil: null, transaccionExito: false });
        for (const metodo of ['GET', 'HEAD']) assert.equal(identificarOperacionAuditoria(metodo,
            `/API/REPORTES/${ruta.toUpperCase()}/ESTADISTICAS/`), `REPORTES.ESTADISTICAS_${fuente}`);
        const base = { tipoEvento, resultado: 'EXITO', responsable: { idUsuario: 1, idRol: 1, nombreUsuario: 'admin' },
            contexto: { correlacion: 'a'.repeat(32), direccionIp: null, procedenciaIp: 'NO_DISPONIBLE' } };
        const evento = prepararEventoAuditoria({ ...base, antes: { total: '12.30' }, despues: { total: '12.30' },
            metadatos: { granularidad: 'MES', cantidadIntervalos: 1200, total: '12.30', perdida: '12.30', cantidadResultados: 10, query: 'privado', filtros: {}, series: [] } });
        assert.deepEqual(evento.metadatos, { granularidad: 'MES', cantidadIntervalos: 1200 });
        assert.equal(evento.antes, null);
        assert.equal(evento.despues, null);
        for (const cantidadIntervalos of [0, 1201, '1', 1.5]) assert.throws(() => prepararEventoAuditoria({ ...base, metadatos: { cantidadIntervalos } }));
    }
});

test('Conciliación rechaza categoría/intervalo duplicado, desconocido, filtrado y valores no representables', () => {
    for (const [ruta, fuente, , campo] of fuentes) {
        const filtros = validar(ruta, { dia: '2026-11-15', granularidad: 'DIA' });
        const grupo = { [campo]: 'CONFIRMADA', cantidad: '1', importe: '0.00' };
        const temporal = { ...grupo, etiqueta: '2026-11-15' };
        for (const agregados of [
            { grupos: [grupo, grupo], temporales: [temporal] },
            { grupos: [grupo], temporales: [temporal, temporal] },
            { grupos: [grupo], temporales: [{ ...temporal, etiqueta: '2026-11-16' }] },
            { grupos: [grupo], temporales: [{ ...temporal, [campo]: 'OTRA' }] },
            { grupos: [{ ...grupo, cantidad: '9007199254740992' }], temporales: [] },
            { grupos: [grupo], temporales: [{ ...temporal, cantidad: '-1' }] }
        ]) assert.throws(() => materializarEstadisticas(fuente, filtros, agregados));
        assert.throws(() => materializarEstadisticas(fuente, { ...filtros, estadoOperacion: 'ANULADA' }, { grupos: [grupo], temporales: [temporal] }));
    }
});

test('Todas las categorías y métricas concilian exactamente a través de intervalos parciales y ceros', () => {
    for (const [ruta, fuente, , campo] of fuentes) {
        const filtros = validar(ruta, { desde: '2026-11-15', hasta: '2027-01-05', granularidad: 'MES' });
        const filas = [fila('CONFIRMADA', '2026-11-15', '0.10'), fila('CONFIRMADA', '2027-01-05', '0.20'),
            fila('ANULADA', '2026-11-30', '10.00'), fila('ANULADA', '2027-01-01', '5.00', false),
            ...(ruta === 'ventas' ? [fila('PENDIENTE', '2027-01-02', '0.00', false)] : [])];
        const data = materializarEstadisticas(fuente, filtros, {
            grupos: agrupar(filas, campo, false, 'MES'), temporales: agrupar(filas, campo, true, 'MES') });
        assert.deepEqual(data.intervalos.map(i => i.parcial), [true, false, true]);
        assert.deepEqual(data.series[1].valores, ['0.10', '0.00', '0.20']);
        assert.equal(data.resumen.confirmadas.importe, '0.30');
        assert.equal(data.distribuciones[1].total, '15.30');
        for (const serie of data.series) {
            const convertir = s => serie.metrica === 'CANTIDAD' ? BigInt(s) : decimalAEntero(s, 2);
            assert.equal(serie.valores.reduce((a, b) => a + convertir(b), 0n), convertir(serie.total));
            const distribucion = data.distribuciones.find(d => d.metrica === serie.metrica);
            assert.equal(distribucion.categorias.find(c => c.categoria === serie.categoria).valor, serie.total);
        }
        assert.equal(data.distribuciones[0].total, ruta === 'ventas' ? '5' : '4');
        if (ruta === 'ventas') {
            assert.equal(data.resumen.pendientes.cantidad, 1);
            assert.deepEqual(data.series[2].valores, ['0', '0', '1']);
        }
    }
});
