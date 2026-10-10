import test from 'node:test';
import assert from 'node:assert/strict';
import { compraValidator } from '../src/business/validators/compra.validator.js';
import { calcularVencimiento } from '../src/shared/utils/vencimiento.js';

const detalleValido = () => ({
    idMedicamento: 1, cantidad: 100, costoUnitario: '0.7',
    precisionVencimiento: 'DIA', fechaVencimiento: '2027-03-15'
});
const compraValida = () => ({
    claveOperacion: 'Compra-ABC_123', fechaCompra: '2026-10-31', detalles: [detalleValido()]
});

test('Anular compra: motivo obligatorio de hasta 255 caracteres, entrada estricta y normalización sin mutar', () => {
    const body = { motivo: '  Corrección documentada  ' };
    assert.deepEqual(compraValidator.validateAnular(body).data, { motivo: 'Corrección documentada' });
    assert.equal(body.motivo, '  Corrección documentada  ');
    assert.equal(compraValidator.validateAnular({ motivo: 'a'.repeat(255) }).success, true);
    for (const datos of [null, undefined, {}, [], { motivo: null }, { motivo: 1 }, { motivo: '' },
        { motivo: '\n\t ' }, { motivo: 'a'.repeat(256) }, { motivo: 'Motivo', idUsuario: 1 },
        { motivo: 'Motivo', fechaAnulacion: '2026-11-01' }]) {
        assert.equal(compraValidator.validateAnular(datos).success, false);
    }
});

test('Compra: contrato estricto, normalización y ausencia de mutación del body', () => {
    const body = compraValida();
    const before = structuredClone(body);
    const result = compraValidator.validateCreate(body);
    assert.equal(result.success, true);
    assert.deepEqual(result.data, {
        ...body, claveOperacion: 'compra-abc_123', detalles: [{ ...body.detalles[0], costoUnitario: '0.700000' }]
    });
    assert.deepEqual(body, before);
});

test('Compra: MES se almacena como último día, respetando calendario y precisión DIA', () => {
    for (const [mes, fecha] of [['2026-10', '2026-10-31'], ['2028-02', '2028-02-29'],
        ['2027-02', '2027-02-28'], ['2026-04', '2026-04-30'], ['2026-12', '2026-12-31']]) {
        const body = compraValida();
        body.detalles[0] = { ...detalleValido(), precisionVencimiento: 'MES', fechaVencimiento: mes };
        const result = compraValidator.validateCreate(body);
        assert.equal(result.success, true, mes);
        assert.equal(result.data.detalles[0].fechaVencimiento, fecha);
        assert.equal(body.detalles[0].fechaVencimiento, mes);
    }
    const mes = { ...detalleValido(), precisionVencimiento: 'MES', fechaVencimiento: '2026-10' };
    const dia = { ...detalleValido(), fechaVencimiento: '2026-10-31' };
    const result = compraValidator.validateCreate({ ...compraValida(), detalles: [dia, mes] });
    assert.equal(result.success, true);
    assert.equal(calcularVencimiento(result.data.detalles[0].fechaVencimiento, 'DIA', '2026-10-31').vencida, true);
    assert.equal(calcularVencimiento(result.data.detalles[1].fechaVencimiento, 'MES', '2026-10-31').vencida, false);
});

test('Compra: rechaza body incompleto, detalles vacíos y campos controlados por servidor', () => {
    for (const campo of ['claveOperacion', 'fechaCompra', 'detalles']) {
        const body = compraValida();
        delete body[campo];
        assert.equal(compraValidator.validateCreate(body).success, false, campo);
    }
    for (const detalles of [[], null, {}, 'detalle']) {
        assert.equal(compraValidator.validateCreate({ ...compraValida(), detalles }).success, false);
    }
    for (const campo of ['idProveedorLaboratorio', 'idUsuario', 'idCompra', 'total',
        'estadoOperacion', 'fechaRegistro', 'huellaSolicitud']) {
        assert.equal(compraValidator.validateCreate({ ...compraValida(), [campo]: 1 }).success, false, campo);
    }
    for (const campo of ['idExistencia', 'codigoExistencia', 'subtotal', 'saldoAnterior',
        'costoPromedioAnterior', 'saldo_anterior', 'costo_promedio_anterior']) {
        const body = { ...compraValida(), detalles: [{ ...detalleValido(), [campo]: 1 }] };
        assert.equal(compraValidator.validateCreate(body).success, false, campo);
    }
});

test('Compra: IDs y cantidades son números enteros positivos dentro de INT', () => {
    for (const campo of ['idMedicamento', 'cantidad']) {
        for (const valor of [0, -1, 1.5, 2147483648, NaN, Infinity, '1', null, true]) {
            const body = { ...compraValida(), detalles: [{ ...detalleValido(), [campo]: valor }] };
            assert.equal(compraValidator.validateCreate(body).success, false, `${campo}: ${valor}`);
        }
        const body = { ...compraValida(), detalles: [{ ...detalleValido(), [campo]: 2147483647 }] };
        assert.equal(compraValidator.validateCreate(body).success, true);
    }
});

test('Compra: valida costos positivos, escala y límite DECIMAL sin coerción', () => {
    for (const costoUnitario of ['0.000001', '99999999.999999', '0001.050']) {
        const body = { ...compraValida(), detalles: [{ ...detalleValido(), costoUnitario }] };
        assert.equal(compraValidator.validateCreate(body).success, true, costoUnitario);
    }
    for (const costoUnitario of ['0', '0.000000', '-1', '+1', '100000000', '0.7000000',
        '0.0000001', '1e2', '0,7', '.7', '1.', ' 1', '1 ', '1\n', '', 0.7, null, true]) {
        const body = { ...compraValida(), detalles: [{ ...detalleValido(), costoUnitario }] };
        const result = compraValidator.validateCreate(body);
        assert.equal(result.success, false, String(costoUnitario));
        assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'detalles.0.costoUnitario'));
    }
});

test('Compra: rechaza fechas inexistentes, formatos cruzados y precisiones desconocidas', () => {
    for (const fechaCompra of ['2026-02-29', '2026-04-31', '0000-01-01', '2026-1-01',
        '31/10/2026', '2026-10-31\n', '2026-10-31T00:00:00Z', null]) {
        assert.equal(compraValidator.validateCreate({ ...compraValida(), fechaCompra }).success, false);
    }
    for (const [precisionVencimiento, fechaVencimiento] of [
        ['DIA', '2026-10'], ['DIA', '2026-02-29'], ['DIA', '2026-10-31\n'],
        ['MES', '2026-10-31'], ['MES', '2026-00'], ['MES', '2026-13'],
        ['MES', '0999-12'], ['MES', '2026-1'], ['MES', '2026-10\n'], ['ANIO', '2026-10']
    ]) {
        const body = { ...compraValida(), detalles: [{ ...detalleValido(), precisionVencimiento, fechaVencimiento }] };
        assert.equal(compraValidator.validateCreate(body).success, false, `${precisionVencimiento}: ${fechaVencimiento}`);
    }
    const result = compraValidator.validateCreate({ ...compraValida(), fechaCompra: '2028-02-29' });
    assert.equal(result.success, true);
});

test('Compra: no mezcla las validaciones estructurales con el día comercial de registro', () => {
    const body = { ...compraValida(), fechaCompra: '9999-12-31',
        detalles: [{ ...detalleValido(), fechaVencimiento: '1000-01-01' }] };
    assert.equal(compraValidator.validateCreate(body).success, true);
    // Su recepción se rechazará en CompraService usando el instante bajo bloqueo.
});

test('Compra: conserva multiplicidad, separación y orden de los detalles', () => {
    const primero = detalleValido();
    const segundo = { ...detalleValido(), cantidad: 50, costoUnitario: '0.9' };
    const result = compraValidator.validateCreate({ ...compraValida(), detalles: [primero, segundo, primero] });
    assert.equal(result.success, true);
    assert.equal(result.data.detalles.length, 3);
    assert.deepEqual(result.data.detalles.map(({ cantidad, costoUnitario }) => [cantidad, costoUnitario]),
        [[100, '0.700000'], [50, '0.900000'], [100, '0.700000']]);
});

test('Claves: normaliza mayúsculas y rechaza vacíos, espacios, acentos y más de 64 caracteres', () => {
    for (const claveOperacion of ['A', 'a'.repeat(64), 'COMPRA-ABC_123']) {
        assert.equal(compraValidator.validateCreate({ ...compraValida(), claveOperacion }).success, true);
        assert.equal(compraValidator.validateFiltros({ claveOperacion }).data.claveOperacion,
            claveOperacion.toLowerCase());
    }
    for (const claveOperacion of ['', 'a'.repeat(65), ' a', 'a ', 'a\n', 'a b', 'comprá', 'a/b', null, ['a']]) {
        assert.equal(compraValidator.validateCreate({ ...compraValida(), claveOperacion }).success, false);
        assert.equal(compraValidator.validateFiltros({ claveOperacion }).success, false);
    }
});

test('Consultas: IDs estrictos y filtros previstos, sin usuario controlado por cliente', () => {
    assert.deepEqual(compraValidator.validateId({ idCompra: '2147483647' }).data, { idCompra: 2147483647 });
    assert.deepEqual(compraValidator.validateFiltros({ idProveedorLaboratorio: '2',
        estadoOperacion: 'ANULADA', claveOperacion: 'COMPRA-X' }).data,
    { idProveedorLaboratorio: 2, estadoOperacion: 'ANULADA', claveOperacion: 'compra-x' });
    assert.equal(compraValidator.validateFiltros({}).success, true);
    for (const id of ['', '0', '-1', '1.5', '1e2', '0x10', ' 1 ', '1\n', '2147483648', ['1'], 1, true]) {
        assert.equal(compraValidator.validateId({ idCompra: id }).success, false);
        assert.equal(compraValidator.validateFiltros({ idProveedorLaboratorio: id }).success, false);
    }
    for (const filtros of [{ idUsuario: '1' }, { estado: 'true' }, { estadoOperacion: 'confirmada' },
        { estadoOperacion: ['CONFIRMADA'] }, { claveOperacion: ['a', 'b'] }]) {
        assert.equal(compraValidator.validateFiltros(filtros).success, false);
    }
    assert.equal(compraValidator.validateId({ idCompra: '1', idUsuario: '1' }).success, false);
});

test('Consultas: fechas civiles inclusivas y rango ordenado', () => {
    for (const filtros of [{ desde: '2028-02-29' }, { hasta: '2026-10-31' },
        { desde: '2026-10-31', hasta: '2026-10-31' }, { desde: '2026-10-01', hasta: '2026-10-31' }]) {
        assert.equal(compraValidator.validateFiltros(filtros).success, true);
    }
    for (const filtros of [{ desde: '2026-02-29' }, { hasta: '2026-04-31' },
        { desde: '2026-11-01', hasta: '2026-10-31' }, { desde: '2026-10-31\n' },
        { desde: ['2026-10-01', '2026-10-02'] }]) {
        assert.equal(compraValidator.validateFiltros(filtros).success, false);
    }
});
