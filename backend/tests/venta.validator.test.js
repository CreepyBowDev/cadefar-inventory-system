import test from 'node:test';
import assert from 'node:assert/strict';
import { ventaValidator } from '../src/business/validators/venta.validator.js';

test('Ventas: filtros predeterminados y fechas explícitas de registro/venta', () => {
    assert.deepEqual(ventaValidator.validateFiltros({}).data,
        { campoFecha: 'fechaRegistro', pagina: 1, limite: 25 });
    for (const estadoOperacion of ['PENDIENTE', 'CONFIRMADA', 'ANULADA']) {
        assert.equal(ventaValidator.validateFiltros({ estadoOperacion }).success, true);
    }
    assert.deepEqual(ventaValidator.validateFiltros({ idVenta: '5', idUsuario: '3',
        campoFecha: 'fechaVenta', desde: '2028-02-29', hasta: '2028-03-01',
        pagina: '2', limite: '100' }).data, {
        idVenta: 5, idUsuario: 3, campoFecha: 'fechaVenta', desde: '2028-02-29',
        hasta: '2028-03-01', pagina: 2, limite: 100
    });
});

const invalidos = [
    { desde: '2026-02-29' }, { hasta: '2026-13-01' }, { desde: '2026-1-01' },
    { desde: '2026-11-02', hasta: '2026-11-01' }, { desde: '0999-01-01' },
    { estadoOperacion: 'TODAS' }, { campoFecha: 'fechaAnulacion' },
    { pagina: '0' }, { pagina: '-1' }, { pagina: '1.5' }, { pagina: '2147483648' },
    { limite: '101' }, { limite: '0' }, { pagina: ['1', '2'] }, { pagina: 1 },
    { idUsuario: ' 3' }, { idUsuario: '03' }, { idUsuario: '1e2' },
    { idVenta: '2147483648' }, { idVenta: '0' }, { estadoOperacion: ['PENDIENTE'] },
    { campoFecha: { tipo: 'fechaVenta' } }, { desconocido: 'valor' }
];
for (const filtros of invalidos) {
    test(`Ventas: rechaza filtros ${JSON.stringify(filtros)}`, () => {
        assert.equal(ventaValidator.validateFiltros(filtros).success, false);
    });
}

test('Ventas: ID y consulta de detalle estrictos', () => {
    assert.deepEqual(ventaValidator.validateId({ idVenta: '2147483647' }).data, { idVenta: 2147483647 });
    for (const idVenta of ['0', '-1', '01', '1.0', '1e2', 'abc', '2147483648', ['1', '2']]) {
        assert.equal(ventaValidator.validateId({ idVenta }).success, false);
    }
    assert.equal(ventaValidator.validateId({ idVenta: '1', otro: '2' }).success, false);
    assert.equal(ventaValidator.validateSinFiltros({}).success, true);
    assert.equal(ventaValidator.validateSinFiltros({ campoFecha: 'fechaVenta' }).success, false);
});

const pendienteValida = () => ({ claveOperacion: 'VENTA-ABC_01',
    detalles: [{ idMedicamento: 1, idExistencia: 2, cantidad: 3, precioUnitario: '0.10' }] });

test('Pendiente: contrato estricto, clave canónica y precios decimales exactos, incluido cero', () => {
    const body = pendienteValida();
    body.detalles.push({ idMedicamento: 2, idExistencia: 3, cantidad: 2147483647, precioUnitario: '0' });
    const result = ventaValidator.validateCreate(body);
    assert.equal(result.success, true);
    assert.equal(result.data.claveOperacion, 'venta-abc_01');
    assert.equal(result.data.detalles[1].precioUnitario, '0.00');
    body.detalles[0].precioUnitario = '999999999999.99';
    assert.equal(ventaValidator.validateCreate(body).success, true);
});

for (const precioUnitario of ['-1', '1.001', '1e2', '1,20', ' 1', '1 ', 'NaN', '',
    '1000000000000.00', 1, null]) {
    test(`Pendiente: rechaza precio ${JSON.stringify(precioUnitario)}`, () => {
        const body = pendienteValida(); body.detalles[0].precioUnitario = precioUnitario;
        assert.equal(ventaValidator.validateCreate(body).success, false);
    });
}

test('Pendiente: rechaza identidades, fechas, totales, recetas y estado impuestos por cliente', () => {
    for (const campo of ['idVenta', 'idUsuario', 'fechaRegistro', 'fechaVenta', 'estadoOperacion', 'total', 'recetas']) {
        assert.equal(ventaValidator.validateCreate({ ...pendienteValida(), [campo]: 'arbitrario' }).success, false);
    }
    for (const campo of ['idReceta', 'subtotal', 'archivoReceta', 'estado']) {
        const body = pendienteValida(); body.detalles[0][campo] = 'arbitrario';
        assert.equal(ventaValidator.validateCreate(body).success, false);
    }
});

test('Pendiente: cantidades, IDs y clave obligatorios dentro de sus límites', () => {
    for (const claveOperacion of ['', 'con espacios', ' x', 'x ', 'x'.repeat(65), null]) {
        assert.equal(ventaValidator.validateCreate({ ...pendienteValida(), claveOperacion }).success, false);
    }
    for (const campo of ['idMedicamento', 'idExistencia', 'cantidad']) {
        for (const valor of [0, -1, 1.5, 2147483648, '1', null, undefined]) {
            const body = pendienteValida(); body.detalles[0][campo] = valor;
            assert.equal(ventaValidator.validateCreate(body).success, false);
        }
    }
    assert.equal(ventaValidator.validateCreate({ ...pendienteValida(), detalles: [] }).success, false);
    assert.equal(ventaValidator.validateCreate({ claveOperacion: 'x' }).success, false);
});

test('Confirmación: sin cuerpo o con objeto vacío; no admite precios, recetas, fechas o existencias del cliente', () => {
    assert.equal(ventaValidator.validateConfirmar(undefined).success, true);
    assert.equal(ventaValidator.validateConfirmar({}).success, true);
    for (const body of [null, [], 'confirmar', { total: '0.00' }, { idUsuario: 3 }, { fechaVenta: '2026-11-01' },
        { detalles: [] }, { idExistencia: 1 }, { idReceta: 1 }, { estadoOperacion: 'CONFIRMADA' }]) {
        assert.equal(ventaValidator.validateConfirmar(body).success, false);
    }
});

test('Anulación: motivo obligatorio y acotado, sin identidad, fechas ni cambios de inventario del cliente', () => {
    assert.deepEqual(ventaValidator.validateAnular({ motivo: '  Error de registro  ' }).data, { motivo: 'Error de registro' });
    assert.equal(ventaValidator.validateAnular({ motivo: 'x'.repeat(255) }).success, true);
    for (const motivo of [undefined, null, '', '   ', 'x'.repeat(256), 123, 'control\u0000interno']) {
        assert.equal(ventaValidator.validateAnular({ motivo }).success, false);
    }
    assert.equal(ventaValidator.validateAnular(undefined).success, false);
    for (const campo of ['idUsuario', 'idUsuarioAnulador', 'fechaAnulacion', 'estadoOperacion', 'total',
        'cantidad', 'saldoFinal', 'costoUnitarioPromedio', 'idMovimientoOriginal', 'detalles']) {
        assert.equal(ventaValidator.validateAnular({ motivo: 'Error', [campo]: 'arbitrario' }).success, false);
    }
});
