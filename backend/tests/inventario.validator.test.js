import test from 'node:test';
import assert from 'node:assert/strict';
import { inventarioValidator } from '../src/business/validators/inventario.validator.js';

const precondiciones = () => ({ idExistencia: 1, stockObservado: 10, ultimoMovimientoObservado: 7 });
const ajuste = () => ({ ...precondiciones(), saldoContado: 11, observacion: '  Conteo físico  ', costoUnitario: '0.1' });
const retiro = () => ({ ...precondiciones(), cantidad: 2, observacion: '  Unidades dañadas  ' });

test('CU23: normaliza costo exacto y observación sin mutar; admite entrada, salida y conciliación cero', () => {
    const body = ajuste(), anterior = structuredClone(body);
    assert.deepEqual(inventarioValidator.validateAjuste(body).data,
        { ...body, observacion: 'Conteo físico', costoUnitario: '0.100000' });
    assert.deepEqual(body, anterior);
    for (const saldoContado of [0, 9, 10]) {
        const { costoUnitario, ...sinCosto } = body;
        assert.equal(inventarioValidator.validateAjuste({ ...sinCosto, saldoContado }).success, true);
        const result = inventarioValidator.validateAjuste({ ...body, saldoContado });
        assert.equal(result.success, false);
        assert.ok(result.error.issues.some(issue => issue.path[0] === 'costoUnitario'));
    }
    const { costoUnitario, ...sinCosto } = body;
    assert.equal(inventarioValidator.validateAjuste(sinCosto).success, false);
    assert.equal(inventarioValidator.validateAjuste({ ...body, stockObservado: 0,
        ultimoMovimientoObservado: null }).success, true);
    assert.equal(inventarioValidator.validateAjuste({ ...sinCosto, stockObservado: 0,
        saldoContado: 0, ultimoMovimientoObservado: null }).success, true);
});

test('CU23: costo como cadena positiva dentro de DECIMAL(14,6), sin coerción ni pérdida de precisión', () => {
    for (const costoUnitario of ['0.000001', '99999999.999999', '00001.2']) {
        const result = inventarioValidator.validateAjuste({ ...ajuste(), costoUnitario });
        assert.equal(result.success, true);
        assert.equal(result.data.costoUnitario,
            costoUnitario === '00001.2' ? '1.200000' : costoUnitario);
    }
    for (const costoUnitario of ['0', '0.000000', '100000000', '99999999.9999999', '0.0000001',
        '-1', '+1', '1e2', '0x10', '1,25', '.5', '1.', ' 1', '1 ', '', 'NaN', 'Infinity',
        1, null, true, [], {}]) {
        assert.equal(inventarioValidator.validateAjuste({ ...ajuste(), costoUnitario }).success, false,
            `Costo inválido: ${JSON.stringify(costoUnitario)}`);
    }
});

test('Escrituras: precondiciones obligatorias, marcador nullable e INT estricto para cuerpos JSON', () => {
    for (const [validar, body] of [
        [inventarioValidator.validateAjuste, ajuste()],
        [inventarioValidator.validateRetiroVencimiento, retiro()],
        [inventarioValidator.validateRetiroDano, retiro()]
    ]) {
        for (const campo of ['idExistencia', 'stockObservado', 'ultimoMovimientoObservado']) {
            const incompleto = { ...body };
            delete incompleto[campo];
            assert.equal(validar(incompleto).success, false, `Falta ${campo}`);
            for (const valor of [undefined, '1', true, [], {}, -1, 1.5, 2147483648, NaN, Infinity]) {
                assert.equal(validar({ ...body, [campo]: valor }).success, false, campo);
            }
        }
        for (const campo of ['idExistencia', 'ultimoMovimientoObservado']) {
            assert.equal(validar({ ...body, [campo]: 0 }).success, false);
        }
        assert.equal(validar({ ...body, idExistencia: null }).success, false);
        assert.equal(validar({ ...body, stockObservado: null }).success, false);
        assert.equal(validar({ ...body, ultimoMovimientoObservado: null }).success, true);
        assert.equal(validar({ ...body, idExistencia: 2147483647,
            ultimoMovimientoObservado: 2147483647 }).success, true);
        // Una cantidad válida no decide si hay stock, ni el marcador decide si
        // es actual: esas reglas se comprobarán en el Service bajo bloqueo.
        assert.equal(validar({ ...body, stockObservado: 0 }).success, true);
    }
    const { costoUnitario, ...sinCosto } = ajuste();
    assert.equal(inventarioValidator.validateAjuste({ ...sinCosto,
        saldoContado: 2147483647, stockObservado: 2147483647 }).success, true);
    for (const saldoContado of [undefined, null, '0', -1, 1.5, 2147483648, true]) {
        assert.equal(inventarioValidator.validateAjuste({ ...ajuste(), saldoContado }).success, false);
    }
});

test('Retiros: cantidad positiva, observación opcional solo para vencimiento y ningún costo del cliente', () => {
    for (const validar of [inventarioValidator.validateRetiroVencimiento, inventarioValidator.validateRetiroDano]) {
        const body = retiro(), anterior = structuredClone(body);
        assert.deepEqual(validar(body).data, { ...body, observacion: 'Unidades dañadas' });
        assert.deepEqual(body, anterior);
        assert.equal(validar({ ...body, cantidad: 2147483647 }).success, true);
        for (const cantidad of [undefined, null, 0, -1, 1.5, '1', true, 2147483648, Infinity]) {
            assert.equal(validar({ ...body, cantidad }).success, false);
        }
        assert.equal(validar({ ...body, costoUnitario: '1.000000' }).success, false);
    }
    const { observacion, ...sinObservacion } = retiro();
    const result = inventarioValidator.validateRetiroVencimiento(sinObservacion);
    assert.equal(result.success, true);
    assert.equal(Object.hasOwn(result.data, 'observacion'), false);
    assert.equal(inventarioValidator.validateRetiroDano(sinObservacion).success, false);
});

test('Escrituras: observaciones de 1–500 caracteres tras trim y cuerpos estrictos sin campos calculados', () => {
    for (const [validar, body] of [
        [inventarioValidator.validateAjuste, ajuste()],
        [inventarioValidator.validateRetiroVencimiento, retiro()],
        [inventarioValidator.validateRetiroDano, retiro()]
    ]) {
        assert.equal(validar({ ...body, observacion: ` ${'a'.repeat(500)} ` }).success, true);
        for (const observacion of ['', ' \n\t ', 'a'.repeat(501), null, 1, []]) {
            assert.equal(validar({ ...body, observacion }).success, false);
        }
        for (const campo of ['direccion', 'diferencia', 'motivo', 'idUsuario', 'fechaMovimiento',
            'costoUnitarioAplicado', 'perdida', 'idMovimiento', 'idDetalleCompra', 'idDetalleVenta',
            'idMovimientoOriginal', 'claveOperacion', 'estado', 'stockVendible']) {
            assert.equal(validar({ ...body, [campo]: 1 }).success, false, campo);
        }
        for (const invalido of [null, undefined, [], {}, 'texto']) assert.equal(validar(invalido).success, false);
    }
    for (const saldoContado of [0, 10]) {
        const { costoUnitario, observacion, ...body } = ajuste();
        assert.equal(inventarioValidator.validateAjuste({ ...body, saldoContado }).success, false);
    }
});

test('Inventario: acepta solo los filtros previstos y convierte IDs sin coerciones ambiguas', () => {
    assert.deepEqual(inventarioValidator.validateFiltrosInventario({
        idMedicamento: '12', codigoMedicamento: ' PAR ', nombreComercial: ' Producto '
    }).data, { idMedicamento: 12, codigoMedicamento: 'PAR', nombreComercial: 'Producto' });
    assert.equal(inventarioValidator.validateFiltrosInventario({}).success, true);
    for (const idMedicamento of ['', '0', '-1', '1.5', '1e2', '0x10', ' 1 ', '2147483648', ['1'], true]) {
        assert.equal(inventarioValidator.validateId({ idMedicamento }).success, false);
        assert.equal(inventarioValidator.validateFiltrosInventario({ idMedicamento }).success, false);
    }
    assert.deepEqual(inventarioValidator.validateId({ idMedicamento: '2147483647' }).data,
        { idMedicamento: 2147483647 });
});

test('Consultas rechazan campos desconocidos, filtros repetidos, textos vacíos y largos', () => {
    for (const filtros of [{ estado: 'true' }, { stockBajo: 'true' },
        { codigoMedicamento: ['PAR', 'IBU'] }, { codigoMedicamento: ' ' },
        { codigoMedicamento: 'x'.repeat(21) }, { nombreComercial: 'x'.repeat(151) }]) {
        assert.equal(inventarioValidator.validateFiltrosInventario(filtros).success, false);
    }
    assert.equal(inventarioValidator.validateSinFiltros({}).success, true);
    assert.equal(inventarioValidator.validateSinFiltros({ idExistencia: '1' }).success, false);
    assert.equal(inventarioValidator.validateId({ idMedicamento: '1', estado: true }).success, false);
});

test('Movimientos: valida rango civil inclusivo y permite límites individuales', () => {
    for (const filtros of [{ desde: '2028-02-29' }, { hasta: '2026-10-31' },
        { desde: '2026-10-31', hasta: '2026-10-31' }]) {
        assert.equal(inventarioValidator.validateFiltrosMovimientos(filtros).success, true);
    }
    for (const filtros of [{ desde: '2026-02-29' }, { hasta: '2026-04-31' },
        { desde: '2026-11-01', hasta: '2026-10-31' },
        { desde: '2026-10-31T00:00:00Z' }, { desde: ['2026-10-01', '2026-10-02'] }]) {
        assert.equal(inventarioValidator.validateFiltrosMovimientos(filtros).success, false);
    }
});

test('Movimientos: IDs, dirección y motivo son estrictos; no inventa un catálogo de motivos', () => {
    assert.deepEqual(inventarioValidator.validateFiltrosMovimientos({
        idMedicamento: '1', idExistencia: '2', direccion: 'SALIDA', motivo: ' Retiro por daño '
    }).data, { idMedicamento: 1, idExistencia: 2, direccion: 'SALIDA', motivo: 'Retiro por daño' });
    for (const filtros of [{ idExistencia: '1e2' }, { direccion: 'salida' },
        { direccion: ['ENTRADA', 'SALIDA'] }, { motivo: ' ' },
        { motivo: 'x'.repeat(41) }, { idUsuario: '1' }]) {
        assert.equal(inventarioValidator.validateFiltrosMovimientos(filtros).success, false);
    }
});
