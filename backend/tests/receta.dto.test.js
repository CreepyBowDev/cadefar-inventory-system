import test from 'node:test';
import assert from 'node:assert/strict';
import { toResumenReceta, toDetalleReceta } from '../src/presentation/dtos/receta.dto.js';

test('DTOs de recetas excluyen siempre referencias de archivo y campos ajenos', () => {
    const receta = { id_receta: 1, id_venta: 2, fecha_receta: '2026-11-01', modalidad: 'Presentada',
        resultado_revision: null, id_usuario_validador: null, fecha_registro: '2026-11-01 12:00:00', fecha_validacion: null,
        numero_receta: null, nombre_paciente: 'Paciente', documento_paciente: 'Documento', nombre_medico: 'Médico',
        observacion: 'Nota', archivo_receta: 'ruta_privada_no_exponer', password_hash: 'secreto_no_exponer' };
    const resumen = toResumenReceta(receta), detalle = toDetalleReceta({ get: () => receta });
    assert.equal(resumen.nombrePaciente, undefined);
    assert.equal(resumen.observacion, undefined);
    assert.equal(resumen.resultadoRevision, null);
    assert.equal(detalle.nombrePaciente, 'Paciente');
    assert.equal(detalle.numeroReceta, null);
    assert.doesNotMatch(JSON.stringify([resumen, detalle]), /ruta_privada|secreto|archivo|password/);
});
