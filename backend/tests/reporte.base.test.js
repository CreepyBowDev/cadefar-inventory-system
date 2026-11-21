import test from 'node:test';
import assert from 'node:assert/strict';
import { Op, fn, literal } from 'sequelize';
import { criteriosVentas, criteriosCompras, criteriosPerdidas, categoriaVenta,
    fechaReferenciaVenta, perdidaIndividual } from '../src/data/repositories/reporte.criterios.js';
import { materializarVenta, materializarCompra, materializarPerdida,
    materializarResumenVentas, materializarResumenCompras,
    materializarResumenPerdidas } from '../src/business/services/reporte.materializacion.js';
import { reporteValidator as v } from '../src/business/validators/reporte.validator.js';

test('Fase 2: predicados extraídos iguales a los contratos previos, sin mutación', () => {
    const filtros = Object.freeze(v.validateVentas({ mes: '2000-02', estadoOperacion: 'ANULADA' }).data);
    const rango = () => ({
        [Op.gte]: fn('STR_TO_DATE', filtros.desdeFechaHora, '%Y-%m-%d %H:%i:%s'),
        [Op.lte]: fn('STR_TO_DATE', filtros.hastaFechaHora, '%Y-%m-%d %H:%i:%s.%f')
    });
    assert.deepEqual(criteriosVentas(filtros), { [Op.or]: [
        { estado_operacion: 'CONFIRMADA', fecha_venta: rango() },
        { estado_operacion: 'PENDIENTE', fecha_registro: rango() },
        { estado_operacion: 'ANULADA', fecha_venta: { [Op.ne]: null, ...rango() } },
        { estado_operacion: 'ANULADA', fecha_venta: null, fecha_registro: rango() }
    ], estado_operacion: 'ANULADA' });
    assert.deepEqual(criteriosCompras(filtros), { fecha_compra: {
        [Op.gte]: '2000-02-01', [Op.lte]: '2000-02-29' }, estado_operacion: 'ANULADA' });
    assert.deepEqual(criteriosPerdidas(filtros), { direccion: 'SALIDA',
        motivo: { [Op.in]: ['VENCIMIENTO', 'DAÑO'] }, id_movimiento_original: null, fecha_movimiento: rango() });
    assert.equal(criteriosPerdidas({ ...filtros, motivo: 'DAÑO' }).motivo, 'DAÑO');
    const sinFiltro = v.validateVentas({ dia: '9999-12-31' }).data;
    assert.equal('estado_operacion' in criteriosVentas(sinFiltro), false);
    assert.equal('estado_operacion' in criteriosCompras(sinFiltro), false);
    assert.equal(criteriosVentas(sinFiltro)[Op.or][0].fecha_venta[Op.lte].args[0], '9999-12-31 23:59:59.999999');
    assert.deepEqual(categoriaVenta, literal(`CASE WHEN estado_operacion = 'ANULADA' THEN
    CASE WHEN fecha_venta IS NULL THEN 'ANULADA_SIN_CONFIRMAR' ELSE 'ANULADA_CONFIRMADA' END
    ELSE estado_operacion END`));
    assert.deepEqual(fechaReferenciaVenta, literal(`CASE WHEN estado_operacion = 'PENDIENTE'
    OR (estado_operacion = 'ANULADA' AND fecha_venta IS NULL)
    THEN fecha_registro ELSE fecha_venta END`));
    assert.equal(perdidaIndividual.val,
        'ROUND(CAST(`MovimientoInventario`.`cantidad` AS DECIMAL(10,0)) * `MovimientoInventario`.`costo_unitario_aplicado`, 2)');
});

test('Fase 2: materialización explícita preserva fechas civiles, nulos y grandes exactos', () => {
    const total = '12345678901234567890.12';
    const venta = Object.freeze({ id_venta: 1, estado_operacion: 'ANULADA', categoria: 'ANULADA_SIN_CONFIRMAR',
        fecha_referencia: '1000-01-01 00:00:00', fecha_registro: '1000-01-01 00:00:00',
        fecha_venta: null, fecha_anulacion: '9999-12-31 23:59:59', total,
        observacion: 'privado', nombre_paciente: 'privado' });
    assert.deepEqual(materializarVenta(venta), { idVenta: 1, estadoOperacion: 'ANULADA',
        categoria: 'ANULADA_SIN_CONFIRMAR', fechaReferencia: '1000-01-01 00:00:00',
        fechaRegistro: '1000-01-01 00:00:00', fechaVenta: null, fechaAnulacion: '9999-12-31 23:59:59', total });
    assert.deepEqual(materializarCompra(Object.freeze({ id_compra: 2, id_proveedor_laboratorio: 3,
        estado_operacion: 'CONFIRMADA', fecha_compra: '1000-01-01', fecha_registro: '9999-12-31 23:59:59',
        fecha_anulacion: null, total, observacion: 'privado' })), {
        idCompra: 2, idProveedorLaboratorio: 3, estadoOperacion: 'CONFIRMADA', fechaReferencia: '1000-01-01',
        fechaCompra: '1000-01-01', fechaRegistro: '9999-12-31 23:59:59', fechaAnulacion: null, total });
});

test('Fase 2: RN91 materializada individualmente y resumen bruto exacto', () => {
    const fila = Object.freeze({ id_movimiento: 1, id_existencia: 2, id_medicamento: 3,
        codigo_existencia: 'X-001', codigo_medicamento: 'X', nombre_comercial: 'Sintético', id_usuario: 4,
        motivo: 'VENCIMIENTO', fecha_movimiento: '2000-02-29 23:59:59', cantidad: 1,
        costo_unitario_aplicado: '0.005000', observacion: 'privado', costo_unitario_promedio: '999.000000' });
    const perdida = materializarPerdida(fila);
    assert.deepEqual(perdida, { idMovimiento: 1, idExistencia: 2, idMedicamento: 3,
        codigoExistencia: 'X-001', codigoMedicamento: 'X', nombreComercial: 'Sintético', idUsuario: 4,
        motivo: 'VENCIMIENTO', fechaReferencia: '2000-02-29 23:59:59', fechaMovimiento: '2000-02-29 23:59:59',
        cantidad: 1, costoUnitarioAplicado: '0.005000', perdida: '0.01', idMovimientoReversion: null });
    assert.equal(materializarPerdida({ ...fila, id_movimiento_reversion: 9 }).perdida, '0.01');
    assert.equal(materializarPerdida({ ...fila, id_movimiento_reversion: 9 }).idMovimientoReversion, 9);
    assert.equal(materializarPerdida({ ...fila, costo_unitario_aplicado: '0.000000' }).perdida, '0.00');
    const { resumen, total } = materializarResumenPerdidas([
        { motivo: 'VENCIMIENTO', cantidad_retiros: '2', cantidad_retirada: '2', perdida: '0.02' },
        { motivo: 'DAÑO', cantidad_retiros: '1', cantidad_retirada: '9007199254740993', perdida: '12345678901234567890.12' }
    ]);
    assert.equal(total, 3);
    assert.equal(resumen.vencimiento.perdida, '0.02');
    assert.equal(resumen.cantidadRetirada, '9007199254740995');
    assert.equal(resumen.perdidaTotal, '12345678901234567890.14');
});

test('Fase 2: resúmenes reutilizables, categorías cero, realizadas y conteos seguros', () => {
    const ventas = materializarResumenVentas([{ categoria: 'ANULADA_CONFIRMADA', cantidad: '1', importe: '10.00' },
        { categoria: 'ANULADA_SIN_CONFIRMAR', cantidad: '1', importe: '5.00' }]);
    assert.deepEqual(ventas, { total: 2, resumen: { confirmadas: { cantidad: 0, importe: '0.00' },
        pendientes: { cantidad: 0, importe: '0.00' }, anuladasConfirmadas: { cantidad: 1, importe: '10.00' },
        anuladasSinConfirmar: { cantidad: 1, importe: '5.00' }, totalVentasRealizadas: '0.00' } });
    assert.deepEqual(materializarResumenCompras([{ estado_operacion: 'ANULADA', cantidad: '1', importe: '5.00' }]),
        { total: 1, resumen: { confirmadas: { cantidad: 0, importe: '0.00' }, anuladas: { cantidad: 1, importe: '5.00' },
            totalComprasRealizadas: '0.00' } });
    for (const materializar of [materializarResumenVentas, materializarResumenCompras, materializarResumenPerdidas]) {
        assert.equal(materializar([]).total, 0);
        for (const cantidad of ['9007199254740992', '-1', 'NaN']) {
            assert.throws(() => materializar([{ cantidad, cantidad_retiros: cantidad }]), RangeError);
        }
    }
    assert.equal(materializarResumenCompras([{ estado_operacion: 'CONFIRMADA', cantidad: '9007199254740991',
        importe: '12345678901234567890.12' }]).resumen.totalComprasRealizadas, '12345678901234567890.12');
    assert.throws(() => materializarResumenVentas([
        { categoria: 'CONFIRMADA', cantidad: '9007199254740991', importe: '0.00' },
        { categoria: 'PENDIENTE', cantidad: '1', importe: '0.00' }
    ]), RangeError);
    assert.throws(() => materializarVenta({ total: 0.1 }), TypeError);
    assert.throws(() => materializarPerdida({ costo_unitario_aplicado: 0.005, cantidad: 1 }), TypeError);
});

// Sequelize genera SQL real pero interceptamos el transporte y prohibimos conectar.
process.env.NODE_ENV = 'test';
process.env.DB_NAME_TEST = 'reportes_base_sin_conexion';
const { default: db } = await import('../src/data/models/index.js');
const { reporteRepository } = await import('../src/data/repositories/reporte.repository.js');

test('Fase 2: Repository consume los criterios comunes en agregado/página y misma transacción', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const transaction = { snapshot: 'sintetico' };
    for (const [modelo, consultar, validar, criterios] of [
        [db.Venta, reporteRepository.consultarVentas, v.validateVentas, criteriosVentas],
        [db.Compra, reporteRepository.consultarCompras, v.validateCompras, criteriosCompras],
        [db.MovimientoInventario, reporteRepository.consultarPerdidas, v.validatePerdidas, criteriosPerdidas]
    ]) {
        const llamadas = [];
        t.mock.method(modelo, 'findAll', async options => { llamadas.push(options); return []; });
        const filtros = validar({ desde: '1000-01-01', hasta: '9999-12-31', pagina: '2' }).data;
        assert.deepEqual(await consultar(filtros, { transaction }), { grupos: [], rows: [] });
        assert.equal(llamadas.length, 2);
        assert.deepEqual(llamadas[0].where, criterios(filtros));
        assert.equal(llamadas[0].where, llamadas[1].where);
        for (const options of llamadas) {
            assert.equal(options.transaction, transaction);
            assert.equal(options.raw, true);
            assert.equal(options.lock, undefined);
        }
    }
});

test('Fase 2: valores SQL separados de literales; escape ORM, no concatenación ni motor', async t => {
    t.mock.method(db.sequelize.connectionManager, 'getConnection', () => { throw new Error('MySQL prohibido'); });
    const queries = [];
    const transaction = new db.Sequelize.Transaction(db.sequelize, {});
    t.mock.method(db.sequelize, 'query', async (sql, options) => {
        assert.equal(options.transaction, transaction);
        queries.push(sql);
        return [];
    });
    const ataque = "' OR 1=1 --";
    // Defensa en profundidad: el validator público rechaza este dato; incluso
    // saltándolo, Sequelize lo trata como valor escapado, nunca como literal.
    assert.equal(v.validateVentas({ dia: '2026-11-20', estadoOperacion: ataque }).success, false);
    const filtros = v.validateVentas({ dia: '2026-11-20' }).data;
    await reporteRepository.consultarVentas({ ...filtros, estadoOperacion: ataque }, { transaction });
    await reporteRepository.consultarCompras({ ...filtros, estadoOperacion: ataque }, { transaction });
    await reporteRepository.consultarPerdidas({ ...filtros, motivo: ataque }, { transaction });
    assert.equal(queries.length, 6);
    for (const sql of queries) {
        assert.ok(sql.includes(db.sequelize.escape(ataque)));
        assert.match(sql, /^SELECT /);
        assert.doesNotMatch(sql, /SUM\(DISTINCT|FOR UPDATE/);
    }
});
