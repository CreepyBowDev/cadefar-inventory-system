import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generarClaveVenta, prepararVenta, calcularImportesVenta, advertenciasRecetasVenta } from '../src/features/ventas/utils/ventaForm.js';

const medicamentos = [{ idMedicamento: 5, estado: true }, { idMedicamento: 6, estado: false }];
const linea = { idMedicamento: '5', idExistencia: '7', existencia: { idExistencia: 7, idMedicamento: 5, vencida: true, stockVendible: 0 }, cantidad: '3', precioUnitario: '0.10' };
const form = { claveOperacion: ' VENTA_TEST ', detalles: [linea] };

test('Clave identifica la operación, es única y respeta el contrato', () => {
  const claves = Array.from({ length: 20 }, generarClaveVenta);
  assert.equal(new Set(claves).size, 20);
  claves.forEach(clave => assert.match(clave, /^venta-[a-f0-9]{32}$/));
});
test('Venta pendiente usa referencia real sin exigir saldo vendible ni inventar reserva', () => {
  assert.deepEqual(prepararVenta(form, medicamentos), { claveOperacion: 'venta_test', detalles: [
    { idMedicamento: 5, idExistencia: 7, cantidad: 3, precioUnitario: '0.10' }
  ] });
  assert.equal(form.claveOperacion, ' VENTA_TEST ');
});
test('No se aceptan referencias ficticias, ajenas, medicamento inactivo ni borrador vacío', () => {
  for (const cambios of [{ idExistencia: '' }, { existencia: null }, { idExistencia: '8' },
    { existencia: { idExistencia: 7, idMedicamento: 9 } }, { idMedicamento: '6' }, { idMedicamento: '99' }]) {
    assert.throws(() => prepararVenta({ ...form, detalles: [{ ...linea, ...cambios }] }, medicamentos));
  }
  assert.throws(() => prepararVenta({ ...form, detalles: [] }, medicamentos));
  assert.throws(() => prepararVenta({ ...form, claveOperacion: 'inválida' }, medicamentos));
});
test('Cantidad y precio se validan sin coerciones peligrosas', () => {
  for (const cantidad of ['0', '-1', '01', '1.5', '1e2', '2147483648']) {
    assert.throws(() => prepararVenta({ ...form, detalles: [{ ...linea, cantidad }] }, medicamentos));
  }
  for (const precioUnitario of ['-1', '1e2', '1,50', '1.001', '1000000000000', 'Infinity', '']) {
    assert.throws(() => prepararVenta({ ...form, detalles: [{ ...linea, precioUnitario }] }, medicamentos));
  }
  assert.equal(prepararVenta({ ...form, detalles: [{ ...linea, precioUnitario: '0' }] }, medicamentos).detalles[0].precioUnitario, '0.00');
});
test('Importes de presentación exactos, sin coma flotante ni pérdida del máximo decimal', () => {
  assert.deepEqual(calcularImportesVenta([linea, { cantidad: '2', precioUnitario: '0.20' }]), { subtotales: ['0.30', '0.40'], total: '0.70' });
  assert.equal(calcularImportesVenta([{ cantidad: '1', precioUnitario: '999999999999.99' }]).total, '999999999999.99');
  assert.throws(() => calcularImportesVenta([{ cantidad: '2', precioUnitario: '999999999999.99' }]));
  assert.throws(() => calcularImportesVenta([{ cantidad: '1', precioUnitario: '999999999999.99' }, linea]));
});
test('Líneas repetidas permanecen separadas; solo se envían campos autorizados', () => {
  const data = prepararVenta({ ...form, total: '0', estadoOperacion: 'CONFIRMADA', detalles: [linea, linea] }, medicamentos);
  assert.equal(data.detalles.length, 2);
  assert.deepEqual(Object.keys(data).sort(), ['claveOperacion', 'detalles']);
  assert.deepEqual(Object.keys(data.detalles[0]).sort(), ['cantidad', 'idExistencia', 'idMedicamento', 'precioUnitario']);
});
test('Advertencias usan solo vínculos y resultados reales, sin inferir condición de venta ausente', () => {
  const detalles = [{ idReceta: null }, { idReceta: 1 }, { idReceta: 2 }, { idReceta: 3 }, { idReceta: 4 }];
  assert.deepEqual(advertenciasRecetasVenta({ detalles, recetas: [
    { idReceta: 1, resultadoRevision: 'APROBADA' }, { idReceta: 2, resultadoRevision: null }, { idReceta: 3, resultadoRevision: 'RECHAZADA' }
  ] }), detalles.slice(2));
});
