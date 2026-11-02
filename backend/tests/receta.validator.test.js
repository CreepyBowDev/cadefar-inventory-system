import test from 'node:test';
import assert from 'node:assert/strict';
import { recetaValidator } from '../src/business/validators/receta.validator.js';

const datos = () => ({ fechaReceta: '2028-02-29', nombrePaciente: 'Paciente sintético',
    documentoPaciente: 'DOC-TEST', nombreMedico: 'Médico sintético', modalidad: 'Presentada' });

test('Receta: datos obligatorios, fecha civil y opcionales conforme al modelo', () => {
    assert.deepEqual(recetaValidator.validateCreate(datos()).data, datos());
    const body = { ...datos(), numeroReceta: null, observacion: null, idsDetallesVenta: [2, 1] };
    assert.deepEqual(recetaValidator.validateCreate(body).data, body);
    const result = recetaValidator.validateCreate({ ...datos(), numeroReceta: '  R-1  ', observacion: '  Nota  ' });
    assert.equal(result.data.numeroReceta, 'R-1');
    assert.equal(result.data.observacion, 'Nota');
});

for (const campo of ['archivoReceta', 'archivo_receta', 'url', 'ruta', 'file', 'idArchivo', 'archivoVerificado',
    'idVenta', 'idReceta', 'idUsuarioValidador', 'fechaValidacion', 'fechaRegistro', 'resultadoRevision', 'aprobada']) {
    test(`Receta: no acepta ${campo} proporcionado por el cliente`, () => {
        assert.equal(recetaValidator.validateCreate({ ...datos(), [campo]: 'arbitrario' }).success, false);
    });
}

test('Receta: obligatoriedad, nulabilidad, longitudes y controles', () => {
    for (const [campo, limite] of Object.entries({ nombrePaciente: 150, documentoPaciente: 40,
        nombreMedico: 150, modalidad: 50, numeroReceta: 80, observacion: 500 })) {
        assert.equal(recetaValidator.validateCreate({ ...datos(), [campo]: 'x'.repeat(limite) }).success, true);
        for (const valor of ['', '  ', 'control\u0000interno', 'x'.repeat(limite + 1), 123]) {
            assert.equal(recetaValidator.validateCreate({ ...datos(), [campo]: valor }).success, false);
        }
    }
    for (const campo of ['fechaReceta', 'nombrePaciente', 'documentoPaciente', 'nombreMedico', 'modalidad']) {
        const body = datos(); delete body[campo];
        assert.equal(recetaValidator.validateCreate(body).success, false);
        assert.equal(recetaValidator.validateCreate({ ...datos(), [campo]: null }).success, false);
    }
    for (const fechaReceta of ['2026-02-29', '2026-13-01', '0999-01-01', '2026-1-01', '2026-11-01T00:00:00Z']) {
        assert.equal(recetaValidator.validateCreate({ ...datos(), fechaReceta }).success, false);
    }
});

test('Receta: detalles opcionales, IDs positivos únicos e INT válido', () => {
    for (const idsDetallesVenta of [[], [1, 1], [0], [-1], [1.5], ['1'], [2147483648], null, '1']) {
        assert.equal(recetaValidator.validateCreate({ ...datos(), idsDetallesVenta }).success, false);
    }
    assert.equal(recetaValidator.validateCreate({ ...datos(), idsDetallesVenta: [2147483647] }).success, true);
});

test('Receta: parámetro de venta y query estrictos', () => {
    assert.deepEqual(recetaValidator.validateVentaId({ idVenta: '1' }).data, { idVenta: 1 });
    for (const idVenta of ['0', '-1', '01', '1e2', '2147483648', ' 1', ['1']]) {
        assert.equal(recetaValidator.validateVentaId({ idVenta }).success, false);
    }
    assert.equal(recetaValidator.validateVentaId({ idVenta: '1', otro: '2' }).success, false);
    assert.equal(recetaValidator.validateSinFiltros({}).success, true);
    assert.equal(recetaValidator.validateSinFiltros({ archivo: 'arbitrario' }).success, false);
});

test('Revisión: solo resultados reales y observación opcional, sin identidad o fechas del cliente', () => {
    for (const resultadoRevision of ['APROBADA', 'RECHAZADA']) {
        assert.equal(recetaValidator.validateRevision({ resultadoRevision }).success, true);
        assert.equal(recetaValidator.validateRevision({ resultadoRevision, observacion: null }).success, true);
    }
    assert.equal(recetaValidator.validateRevision({ resultadoRevision: 'RECHAZADA', observacion: ' Nota ' }).data.observacion, 'Nota');
    for (const resultadoRevision of ['PENDIENTE', 'aprobada', '', null, undefined]) {
        assert.equal(recetaValidator.validateRevision({ resultadoRevision }).success, false);
    }
    for (const campo of ['idVenta', 'idReceta', 'idUsuarioValidador', 'fechaValidacion', 'archivoReceta', 'nombrePaciente']) {
        assert.equal(recetaValidator.validateRevision({ resultadoRevision: 'RECHAZADA', [campo]: 'arbitrario' }).success, false);
    }
    for (const observacion of ['', ' ', 'x'.repeat(501), 123]) {
        assert.equal(recetaValidator.validateRevision({ resultadoRevision: 'RECHAZADA', observacion }).success, false);
    }
});

test('Consulta de recetas: paginación e IDs estrictos', () => {
    assert.deepEqual(recetaValidator.validateConsulta({}).data, { pagina: 1, limite: 25 });
    assert.deepEqual(recetaValidator.validateConsulta({ pagina: '2', limite: '100' }).data, { pagina: 2, limite: 100 });
    for (const filtros of [{ pagina: '0' }, { limite: '101' }, { limite: 2 }, { otro: '1' }, { pagina: ['1', '2'] }]) {
        assert.equal(recetaValidator.validateConsulta(filtros).success, false);
    }
    assert.deepEqual(recetaValidator.validateRecetaId({ idVenta: '1', idReceta: '2' }).data, { idVenta: 1, idReceta: 2 });
    for (const idReceta of ['0', '-1', '01', '1e2', '2147483648', ['1']]) {
        assert.equal(recetaValidator.validateRecetaId({ idVenta: '1', idReceta }).success, false);
    }
});
