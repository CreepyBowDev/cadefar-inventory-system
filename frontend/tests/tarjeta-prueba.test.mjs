import test from 'node:test';
import assert from 'node:assert/strict';
import { admiteNumeroPrueba, formatearNumeroPrueba, formatearVencimientoPrueba, validarTarjetaPrueba } from '../src/features/compras/utils/tarjetaPrueba.js';
import { errorImportePago, nombreLaboratorioPago, referenciaPagoVisible } from '../src/features/compras/utils/pagoCompra.js';

test('Tarjeta: nombres libres, 13 a 19 dígitos y CVV de 3 o 4 dígitos, solo formato', () => {
  for (const [titular, numero, vencimiento, cvv] of [
    ['Ana Ejemplo', '1234567890123', '07/35', '314'],
    ['José Prueba-López', '9876543210123456', '01/30', '5926'],
    ['María del Carmen', '1234567890123456789', '12/40', '001']
  ]) {
    const datos = { titular, numero: formatearNumeroPrueba(numero), vencimiento, cvv };
    assert.deepEqual(validarTarjetaPrueba(datos), {});
    assert.equal(admiteNumeroPrueba(numero), true);
  }
  assert.equal(formatearNumeroPrueba('1234567890123456789'), '1234 5678 9012 3456 789');
  assert.equal(formatearVencimientoPrueba('1299'), '12/99');
  assert.equal(formatearVencimientoPrueba('12'), '12');
});
test('Tarjeta: campos obligatorios y formatos inválidos sin validación bancaria', () => {
  for (const numero of ['1'.repeat(20), 'texto', '1234-5678']) {
    assert.equal(admiteNumeroPrueba(numero), false);
  }
  const base = { titular: 'Persona Inventada', numero: '1234567890123', vencimiento: '06/32', cvv: '123' };
  for (const [campo, valor] of [['titular', '  '], ['titular', 'A'.repeat(101)], ['vencimiento', '00/30'],
    ['vencimiento', '13/30'], ['vencimiento', '1/30'], ['cvv', '12'], ['cvv', '12345'], ['cvv', 'a23'],
    ['numero', ''], ['numero', '1'.repeat(12)], ['numero', '1'.repeat(20)], ['numero', '123456789012a']]) {
    assert.ok(validarTarjetaPrueba({ ...base, [campo]: valor })[campo]);
  }
});
test('Presentación local oculta etiquetas técnicas sin modificar los datos', () => {
  const nombre = 'Laboratorio CADEFAR · PRUEBA_LOCAL';
  assert.equal(nombreLaboratorioPago(nombre, true), 'Laboratorio CADEFAR');
  assert.equal(nombreLaboratorioPago(nombre, false), nombre);
  const pago = { esPrueba: true, referenciaExterna: 'PRUEBA_LOCAL_REF_42' };
  assert.equal(referenciaPagoVisible(pago), 'LOCAL-42');
  assert.equal(pago.referenciaExterna, 'PRUEBA_LOCAL_REF_42');
});
test('Importes: abonos parciales/completos, precisión exacta, cero, negativos y sobrepago', () => {
  for (const importe of ['200', '200.00', '500.00', '0.01']) assert.equal(errorImportePago(importe, '500.00'), '');
  for (const importe of ['', '0', '-1', '1.001', 'NaN', 'Infinity', '1e2', '200,00', '500.01']) assert.ok(errorImportePago(importe, '500.00'));
  assert.equal(errorImportePago('999999999999.99', '999999999999.99'), '');
  assert.ok(errorImportePago('0.30', '0.29'));
});
