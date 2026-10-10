import test from 'node:test';
import assert from 'node:assert/strict';
import { inventarioValidator } from '../src/business/validators/inventario.validator.js';

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
