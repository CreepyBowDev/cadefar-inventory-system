import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { materializarEstadisticas, construirIntervalos } from '../src/business/services/reporte.estadisticas.js';
import { materializarResumenPerdidas } from '../src/business/services/reporte.materializacion.js';
import { reporteValidator as v } from '../src/business/validators/reporte.validator.js';
import { decimalAEntero, enteroADecimal, dividirYRedondear } from '../src/shared/utils/decimal.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../src/shared/utils/auditoria-error.js';

process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'perdidas_estadisticas_sin_conexion';
process.env.JWT_SECRET = 'clave_sintetica_perdidas_estadisticas_tests';
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
const { Op } = db.Sequelize;
const categorias = ['VENCIMIENTO', 'DAÑO'];
const metricas = [['CANTIDAD_RETIROS', 'RETIROS'], ['CANTIDAD_RETIRADA', 'UNIDADES_INVENTARIO_HETEROGENEAS'],
    ['PERDIDA', 'IMPORTE_MONETARIO']];
const validar = query => v.validateEstadisticasPerdidas(query).data;
const fila = (id, motivo = 'VENCIMIENTO', fecha = '2026-11-15 12:00:00', cantidad = 1, costo = '0.005000') => ({
    id_movimiento: id, motivo, fecha_movimiento: fecha, cantidad, costo_unitario_aplicado: costo,
    direccion: 'SALIDA', id_movimiento_original: null, id_medicamento: id,
    existencia: { cantidad_fisica: 0, costo_unitario_promedio: '999.000000', medicamento: { estado: false } }
});
const cumple = (row, where) => Reflect.ownKeys(where).every(key => {
    const valor = where[key];
    if (valor === null || typeof valor !== 'object') return row[key] === valor;
    return Reflect.ownKeys(valor).every(op => op === Op.in ? valor[op].includes(row[key])
        : op === Op.gte ? row[key] >= valor[op].args[0] : row[key] <= valor[op].args[0]);
});
// Evaluador JS de fixtures, no intérprete SQL ni evidencia de ejecución MySQL.
const agrupar = (filas, temporal, granularidad) => {
    const grupos = new Map();
    for (const f of filas) {
        const etiqueta = f.fecha_movimiento.slice(0, { DIA: 10, MES: 7, ANIO: 4 }[granularidad]);
        const clave = `${f.motivo}/${temporal ? etiqueta : ''}`;
        const g = grupos.get(clave) ?? { motivo: f.motivo, ...(temporal ? { etiqueta } : {}),
            cantidad_retiros: 0n, cantidad_retirada: 0n, perdida: 0n };
        g.cantidad_retiros++;
        g.cantidad_retirada += BigInt(f.cantidad);
        g.perdida += dividirYRedondear(BigInt(f.cantidad) * decimalAEntero(f.costo_unitario_aplicado, 6), 10000n);
        grupos.set(clave, g);
    }
    return [...grupos.values()].map(g => ({ ...g, cantidad_retiros: String(g.cantidad_retiros),
        cantidad_retirada: String(g.cantidad_retirada), perdida: enteroADecimal(g.perdida, 2) }));
};
const conciliar = data => {
    for (const s of data.series) {
        const leer = valor => s.metrica === 'PERDIDA' ? decimalAEntero(valor, 2) : BigInt(valor);
        assert.equal(s.valores.reduce((a, b) => a + leer(b), 0n), leer(s.total));
        const d = data.distribuciones.find(d => d.metrica === s.metrica);
        assert.equal(d.categorias.find(c => c.categoria === s.categoria).valor, s.total);
    }
    assert.deepEqual(data.distribuciones.map(d => d.total), [String(data.resumen.cantidadRetiros),
        data.resumen.cantidadRetirada, data.resumen.perdidaTotal]);
};

test('Pérdidas estadísticas: HTTP real montado y snapshot/auditor simulados, sin MySQL', async t => {
    let filas = [], activo = false, intercalar, fallo, falloAuditor = false, sesionInvalida = false, forzado;
    const lecturas = [], eventos = [], diagnosticos = [];
    t.mock.method(console, 'error', d => diagnosticos.push(d));
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    t.mock.method(authService, 'getSessionUsuario', async id => {
        if (sesionInvalida) throw anotarErrorAuditoria(new AppError('Sesión inválida', 401),
            { tipoEvento: 'SESION_INVALIDA', causa: 'SESION_INVALIDA' });
        return { idUsuario: id, idRol: id, nombreUsuario: `actor${id}` };
    });
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
    t.mock.method(db.MovimientoInventario, 'findAll', async options => {
        assert.equal(activo, true);
        for (const campo of ['include', 'limit', 'offset', 'lock']) assert.equal(options[campo], undefined);
        assert.ok(options.group);
        lecturas.push(options);
        if (fallo === 'consulta') throw new Error('SELECT privado_SQL');
        const temporal = options.group.length === 2;
        if (temporal) {
            assert.equal(options.transaction, lecturas.at(-2).transaction);
            assert.equal(options.where, lecturas.at(-2).where);
        }
        const formato = temporal ? options.attributes.find(a => a[1] === 'etiqueta')[0].args[1] : '%Y-%m-%d';
        const granularidad = { '%Y-%m-%d': 'DIA', '%Y-%m': 'MES', '%Y': 'ANIO' }[formato];
        const grupos = agrupar(options.transaction.snapshot.filter(f => cumple(f, options.where)), temporal, granularidad);
        if (!temporal && intercalar) { intercalar(); intercalar = undefined; }
        if (forzado) return [{ ...forzado, ...(temporal ? { etiqueta: '2026-11-15' } : {}) }];
        if (fallo === 'conteo') return [{ motivo: 'VENCIMIENTO', cantidad_retiros: '9007199254740992', cantidad_retirada: '0', perdida: '0.00' }];
        if (temporal && fallo === 'conciliacion') return [];
        if (temporal && fallo === 'materializacion') return [{ motivo: 'VENCIMIENTO', etiqueta: '2026-11-15',
            cantidad_retiros: '1', cantidad_retirada: '1', perdida: 'privado_SQL' }];
        return grupos;
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (query = 'dia=2026-11-15&granularidad=DIA', status = 200, rol = 1, method = 'GET', tokenEspecial) => {
        const antes = eventos.length;
        const token = tokenEspecial ?? (rol ? generarToken({ idUsuario: rol, idRol: rol, versionCredenciales: 0 }) : null);
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reportes/perdidas/estadisticas?${query}`, {
            method, headers: token ? { Cookie: `token=${token}` } : {}, signal: AbortSignal.timeout(10000) });
        const body = method === 'HEAD' ? null : await response.json();
        assert.equal(response.status, status, JSON.stringify(body));
        assert.doesNotMatch(JSON.stringify(body), /privado_SQL|SELECT|password|stack|promedio/);
        if (status === 405) {
            assert.equal(response.headers.get('allow'), 'GET');
            assert.equal(eventos.length, antes);
        } else {
            assert.equal(eventos.length, antes + 1, 'Único evento, nunca éxito interno por agregado');
            if (status !== 200) assert.equal(eventos.at(-1).metadatos.operacionOrigen, 'REPORTES.ESTADISTICAS_PERDIDAS');
            else {
                assert.deepEqual(Object.keys(body), ['data']);
                conciliar(body.data);
            }
        }
        return body;
    };
    try {
        await t.test('Sesión/roles: 401 ausente, inválido, expirado y sesión revocada; 403 Vendedor; HEAD explícito', async () => {
            await request('', 401, null);
            await request('', 401, 1, 'GET', 'invalido');
            await request('', 401, 1, 'GET', jwt.sign({ idUsuario: 1, idRol: 1, exp: 1 }, process.env.JWT_SECRET));
            assert.equal(eventos.at(-1).tipo_evento, 'TOKEN_EXPIRADO');
            sesionInvalida = true;
            await request('', 401);
            sesionInvalida = false;
            await request('', 403, 3);
            await request('', 401, null, 'HEAD');
            await request('', 403, 3, 'HEAD');
            for (const rol of [1, 2]) await request('', 405, rol, 'HEAD');
            assert.equal(lecturas.length, 0);
            for (const rol of [1, 2]) await request(undefined, 200, rol);
        });
        await t.test('400 query estricta, obligatoria, desconocidos/repetidos, paginación y límite exacto sin consultas', async () => {
            const antes = lecturas.length;
            for (const query of ['', 'dia=2026-11-15', 'dia=2026-11-15&granularidad=dia',
                'dia=2026-02-29&granularidad=DIA', 'dia=0999-12-31&granularidad=DIA',
                'desde=2026-11-15&granularidad=DIA', 'dia=2026-11-15&mes=2026-11&granularidad=DIA',
                ...['pagina=1', 'limite=25', 'formato=CSV', 'grafico=BARRAS', 'metrica=PERDIDA', 'foo=x',
                    'motivo=DANO', 'motivo=AJUSTE', 'motivo=', 'motivo=DA%C3%91O&motivo=DA%C3%91O',
                    'granularidad=DIA', 'dia=2026-11-15', 'estadoOperacion=ANULADA']
                    .map(extra => `dia=2026-11-15&granularidad=DIA&${extra}`)]) {
                assert.equal((await request(query, 400)).message, 'Datos inválidos');
                assert.equal(eventos.at(-1).tipo_evento, 'VALIDACION_RECHAZADA');
            }
            for (const [granularidad, desde, hasta] of [['DIA', '2000-01-01', '2003-04-15'],
                ['MES', '1000-01-31', '1100-01-01'], ['ANIO', '1000-12-31', '2200-01-01']]) {
                assert.equal((await request(`desde=${desde}&hasta=${hasta}&granularidad=${granularidad}`, 400)).message,
                    'La consulta supera 1200 intervalos; elija otra granularidad o un período menor');
            }
            assert.equal(lecturas.length, antes);
        });
        await t.test('Contrato JSON exacto completo, RN91 0.02, categorías/métricas/unidades y auditoría mínima', async () => {
            filas = [fila(1), fila(2)];
            const { data } = await request();
            assert.deepEqual(data, { fuente: 'PERDIDAS',
                periodo: { modalidad: 'DIA', desde: '2026-11-15', hasta: '2026-11-15', zonaHoraria: 'America/La_Paz' },
                filtros: { motivo: null }, granularidad: 'DIA', sinDatos: false,
                resumen: { vencimiento: { cantidadRetiros: 2, cantidadRetirada: '2', perdida: '0.02' },
                    dano: { cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' },
                    cantidadRetiros: 2, cantidadRetirada: '2', perdidaTotal: '0.02' },
                intervalos: [{ etiqueta: '2026-11-15', desde: '2026-11-15', hasta: '2026-11-15', parcial: false }],
                series: categorias.flatMap((categoria, i) => metricas.map(([metrica, unidad], m) => {
                    const total = i === 0 ? ['2', '2', '0.02'][m] : ['0', '0', '0.00'][m];
                    return { categoria, metrica, unidad, valores: [total], total };
                })),
                distribuciones: metricas.map(([metrica, unidad], m) => ({ metrica, unidad, total: ['2', '2', '0.02'][m],
                    categorias: categorias.map((categoria, i) => ({ categoria, valor: i === 0 ? ['2', '2', '0.02'][m] : ['0', '0', '0.00'][m] })) })) });
            const evento = eventos.at(-1);
            assert.equal(evento.tipo_evento, 'REPORTE_PERDIDAS_ESTADISTICAS');
            assert.equal(evento.modulo, 'REPORTES');
            assert.equal(evento.accion, 'ESTADISTICAS_PERDIDAS');
            assert.deepEqual(evento.metadatos, { granularidad: 'DIA', cantidadIntervalos: 1 });
            for (const campo of ['antes', 'despues', 'referencias', 'tipo_registro', 'id_registro']) assert.equal(evento[campo], null);
        });
        await t.test('Brutos, reversiones dentro/fuera, ajustes/compensaciones excluidos, inclusivos e inactivos/agotados', async () => {
            filas = [fila(1, 'VENCIMIENTO', '2026-11-15 00:00:00'), fila(2, 'VENCIMIENTO', '2026-11-15 23:59:59.999999'),
                fila(3, 'DAÑO', undefined, 2, '1.500000'), fila(4, 'AJUSTE'), fila(5, 'VENTA'), fila(6, 'ANULACION_COMPRA'),
                { ...fila(7), direccion: 'ENTRADA', id_movimiento_original: 1 },
                { ...fila(8, 'ANULACION_VENTA', '2027-01-01 00:00:00'), id_movimiento_original: 2 },
                { ...fila(9), id_movimiento_original: 99 }, { ...fila(10), direccion: 'ENTRADA' },
                fila(11, 'DAÑO', '2026-11-14 23:59:59.999999'), fila(12, 'DAÑO', '2026-11-16 00:00:00')];
            const data = (await request()).data;
            assert.deepEqual(data.resumen, materializarResumenPerdidas(agrupar(filas.slice(0, 3), false, 'DIA')).resumen);
            assert.equal(data.resumen.perdidaTotal, '3.02');
            for (const motivo of categorias) {
                const filtrado = (await request(`dia=2026-11-15&granularidad=DIA&motivo=${encodeURIComponent(motivo)}`)).data;
                assert.deepEqual(filtrado.filtros, { motivo });
                assert.ok(filtrado.series.filter(s => s.categoria !== motivo).every(s => s.total === (s.metrica === 'PERDIDA' ? '0.00' : '0')));
            }
        });
        await t.test('Vacío y costo cero distintos, costos históricos extremos y agregados enormes textuales exactos', async () => {
            filas = [];
            assert.equal((await request()).data.sinDatos, true);
            filas = [fila(1, 'DAÑO', undefined, 2147483647, '0.000000')];
            const cero = (await request()).data;
            assert.equal(cero.sinDatos, false);
            assert.equal(cero.distribuciones[2].total, '0.00');
            filas.push(fila(2, 'DAÑO', undefined, 2147483647, '99999999.999999'));
            assert.equal((await request()).data.series[5].total, '214748364699997852.52');
            forzado = { motivo: 'DAÑO', cantidad_retiros: '5000000', cantidad_retirada: '10737418235000000', perdida: '1073741823499989262600.00' };
            const grande = (await request()).data;
            assert.equal(grande.series[4].total, forzado.cantidad_retirada);
            assert.equal(grande.series[5].total, forzado.perdida);
            forzado = undefined;
        });
        await t.test('Snapshot común ante cambio intercalado; nueva petición ve el cambio, no éxito interno', async () => {
            filas = [fila(1)];
            intercalar = () => filas.push(fila(2, 'DAÑO'));
            assert.equal((await request()).data.resumen.perdidaTotal, '0.01');
            assert.equal((await request()).data.resumen.perdidaTotal, '0.02');
        });
        await t.test('1200 intervalos, calendario parcial/bisiesto/cambio de año y extremos en HTTP', async () => {
            filas = [];
            for (const query of ['desde=2000-01-01&hasta=2003-04-14&granularidad=DIA',
                'desde=1000-01-31&hasta=1099-12-01&granularidad=MES', 'desde=1000-12-31&hasta=2199-01-01&granularidad=ANIO']) {
                const data = (await request(query)).data;
                assert.equal(data.intervalos.length, 1200);
                assert.ok(data.series.every(s => s.valores.length === 1200));
            }
            for (const dia of ['1000-01-01', '9999-12-31', '2000-02-29']) {
                filas = [fila(1, 'DAÑO', `${dia} 23:59:59.999999`)];
                assert.equal((await request(`dia=${dia}&granularidad=DIA`)).data.resumen.cantidadRetiros, 1);
            }
            for (const granularidad of ['MES', 'ANIO']) {
                filas = [fila(1, 'DAÑO', '9999-12-31 23:59:59.999999')];
                assert.equal((await request(`mes=9999-12&granularidad=${granularidad}`)).data.resumen.cantidadRetiros, 1);
            }
            filas = [];
            const parcial = (await request('desde=2026-11-15&hasta=2027-01-05&granularidad=MES')).data;
            assert.deepEqual(parcial.intervalos.map(i => i.parcial), [true, false, true]);
            assert.equal((await request('desde=2000-02-28&hasta=2000-03-01&granularidad=DIA')).data.intervalos.length, 3);
        });
        await t.test('500 seguro y ningún éxito ante consulta/materialización/conteo/conciliación/cierre; auditor exclusivo conserva respuesta', async () => {
            filas = [fila(1)];
            for (fallo of ['consulta', 'materializacion', 'conteo', 'conciliacion', 'cierre']) {
                assert.deepEqual(await request(undefined, 500), { message: 'Error interno del servidor' });
                assert.equal(eventos.at(-1).tipo_evento, 'ERROR_TECNICO');
                assert.equal(activo, false);
            }
            fallo = undefined;
            falloAuditor = true;
            await request();
            await request('', 400);
            await request('', 401, null);
            await request('', 403, 3);
            fallo = 'consulta';
            await request(undefined, 500);
            const propios = diagnosticos.filter(d => d.categoria === 'AUDITORIA_PERSISTENCIA_NO_CONFIRMADA');
            assert.equal(propios.length, 5);
            assert.doesNotMatch(JSON.stringify(propios), /privado_SQL|SELECT/);
        });
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Pérdidas: límite antes de snapshot/listas y conciliación pura multintervalo/motivo exacta', async t => {
    t.mock.method(db.sequelize, 'transaction', () => assert.fail('No abrir snapshot'));
    for (const [granularidad, desde, hasta] of [['DIA', '2000-01-01', '2003-04-15'],
        ['MES', '1000-01-31', '1100-01-01'], ['ANIO', '1000-12-31', '2200-01-01']]) {
        const periodo = { desde, hasta };
        assert.throws(() => construirIntervalos(periodo, granularidad), /supera 1200/);
        await assert.rejects(reporteService.estadisticasPerdidas({ periodo, granularidad }, {}), /supera 1200/);
    }
    const filtros = validar({ desde: '2026-11-15', hasta: '2027-01-05', granularidad: 'MES' });
    const filas = [fila(1), fila(2), fila(3, 'DAÑO', '2027-01-05 12:00:00', 3, '0.015000')];
    const grupos = agrupar(filas, false, 'MES'), temporales = agrupar(filas, true, 'MES');
    const data = materializarEstadisticas('PERDIDAS', filtros, { grupos, temporales });
    conciliar(data);
    assert.deepEqual(data.resumen, materializarResumenPerdidas(grupos).resumen);
    assert.deepEqual(data.series[2].valores, ['0.02', '0.00', '0.00']);
    assert.deepEqual(data.series[5].valores, ['0.00', '0.00', '0.05']);
    assert.equal(data.resumen.perdidaTotal, '0.07');
});

test('Pérdidas: rechazar agregados duplicados/desconocidos/excluidos, cantidades/conteos inválidos y falta de conciliación', () => {
    const filtros = validar({ dia: '2026-11-15', granularidad: 'DIA' });
    const g = { motivo: 'VENCIMIENTO', cantidad_retiros: '1', cantidad_retirada: '1', perdida: '0.01' };
    const temporal = { ...g, etiqueta: '2026-11-15' };
    for (const agregados of [
        { grupos: [g, g], temporales: [temporal] }, { grupos: [g], temporales: [temporal, temporal] },
        { grupos: [{ ...g, motivo: 'AJUSTE' }], temporales: [] },
        { grupos: [g], temporales: [{ ...temporal, motivo: 'OTRO' }] },
        { grupos: [g], temporales: [{ ...temporal, etiqueta: '2026-11-16' }] },
        { grupos: [{ ...g, cantidad_retiros: '9007199254740992' }], temporales: [] },
        { grupos: [{ ...g, cantidad_retiros: String(Number.MAX_SAFE_INTEGER) }, { ...g, motivo: 'DAÑO' }], temporales: [] },
        { grupos: [{ ...g, cantidad_retiros: '0' }], temporales: [] },
        { grupos: [g], temporales: [{ ...temporal, cantidad_retirada: '-1' }] },
        { grupos: [g], temporales: [{ ...temporal, cantidad_retirada: '1.0' }] },
        { grupos: [g], temporales: [{ ...temporal, cantidad_retiros: 1 }] },
        { grupos: [g], temporales: [{ ...temporal, perdida: '0.02' }] },
        { grupos: [g], temporales: [{ ...temporal, cantidad_retirada: '2' }] },
        { grupos: [g], temporales: [] }
    ]) assert.throws(() => materializarEstadisticas('PERDIDAS', filtros, agregados));
    assert.throws(() => materializarEstadisticas('PERDIDAS', { ...filtros, motivo: 'DAÑO' }, { grupos: [g], temporales: [temporal] }));
});

test('Pérdidas: SQL Sequelize generado, agrupación/RN91/selector compartidos, sin motor ni concatenación cliente', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const queries = [], transaction = new db.Sequelize.Transaction(db.sequelize, {});
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.transaction, transaction);
        queries.push(sql);
        return [];
    });
    for (const granularidad of ['DIA', 'MES', 'ANIO']) for (const motivo of [undefined, ...categorias]) {
        const query = { dia: '9999-12-31', granularidad, ...(motivo ? { motivo } : {}) };
        const filtros = validar(query);
        await reporteRepository.estadisticasPerdidas(filtros, { transaction });
        const [resumen, temporal] = queries.slice(-2);
        for (const sql of [resumen, temporal]) {
            assert.match(sql, /CAST\(COUNT\(`id_movimiento`\) AS CHAR\)/);
            assert.match(sql, /CAST\(SUM\(`cantidad`\) AS CHAR\)/);
            assert.match(sql, /SUM\(ROUND\(CAST\(`MovimientoInventario`.`cantidad` AS DECIMAL\(10,0\)\) \* `MovimientoInventario`.`costo_unitario_aplicado`, 2\)\)/);
            assert.match(sql, /`direccion` = 'SALIDA'/);
            assert.match(sql, /`id_movimiento_original` IS NULL/);
            assert.match(sql, /9999-12-31 23:59:59.999999/);
            assert.doesNotMatch(sql, /JOIN|DISTINCT|LIMIT|FOR UPDATE|promedio|medicamento|cantidad_fisica|10000-01-01/i);
            assert.match(sql, /GROUP BY/);
        }
        assert.ok(temporal.includes({ DIA: '%Y-%m-%d', MES: '%Y-%m', ANIO: '%Y' }[granularidad]));
        assert.match(temporal, /DATE_FORMAT\(`fecha_movimiento`/);
        const predicado = sql => sql.split(' WHERE ')[1].split(' GROUP BY ')[0];
        assert.equal(predicado(resumen), predicado(temporal));
        const { granularidad: ignorada, ...ordinaria } = query;
        await reporteRepository.consultarPerdidas(v.validatePerdidas(ordinaria).data, { transaction });
        assert.equal(predicado(resumen), predicado(queries.at(-2)));
        const ataque = "' OR 1=1 --";
        await reporteRepository.estadisticasPerdidas({ ...filtros, motivo: ataque }, { transaction });
        for (const sql of queries.slice(-2)) assert.ok(sql.includes(db.sequelize.escape(ataque)));
    }
});

test('Pérdidas: catálogo, clasificador GET/HEAD y allowlist específica sin monetarios/filtros/snapshots', () => {
    const tipoEvento = 'REPORTE_PERDIDAS_ESTADISTICAS';
    assert.deepEqual(CATALOGO_AUDITORIA[tipoEvento], { modulo: 'REPORTES', accion: 'ESTADISTICAS_PERDIDAS', perfil: null, transaccionExito: false });
    for (const metodo of ['GET', 'HEAD']) assert.equal(identificarOperacionAuditoria(metodo,
        '/API/REPORTES/PERDIDAS/ESTADISTICAS/'), 'REPORTES.ESTADISTICAS_PERDIDAS');
    const base = { tipoEvento, resultado: 'EXITO', responsable: { idUsuario: 2, idRol: 2, nombreUsuario: 'regente' },
        contexto: { correlacion: 'a'.repeat(32), direccionIp: null, procedenciaIp: 'NO_DISPONIBLE' } };
    const evento = prepararEventoAuditoria({ ...base, antes: { perdida: '12.30' }, despues: { perdida: '12.30' },
        metadatos: { granularidad: 'MES', cantidadIntervalos: 1200, perdidaTotal: '12.30', cantidadResultados: 10,
            query: 'privado', filtros: {}, filas: [], motivo: 'DAÑO', operacionOrigen: 'REPORTES.ESTADISTICAS_PERDIDAS' } });
    assert.deepEqual(evento.metadatos, { granularidad: 'MES', cantidadIntervalos: 1200 });
    assert.equal(evento.antes, null);
    assert.equal(evento.despues, null);
    for (const cantidadIntervalos of [0, 1201, '1', 1.5]) assert.throws(() => prepararEventoAuditoria({ ...base, metadatos: { cantidadIntervalos } }));
});
