import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepararAnulacionVenta } from '../src/features/ventas/utils/ventaAnulacion.js';
import { getNavigationForRole } from '../src/constants/navigation.js';
import { ROLES } from '../src/constants/roles.js';

test('Anulación envía solo el motivo normalizado y conserva hasta 255 caracteres', () => {
  assert.deepEqual(prepararAnulacionVenta('  Solicitud del cliente  '), { motivo: 'Solicitud del cliente' });
  assert.equal(prepararAnulacionVenta('x'.repeat(255)).motivo.length, 255);
});
test('Motivo obligatorio, límite y controles coinciden con el contrato vigente', () => {
  for (const motivo of ['', '   ', '\n\t', 'x'.repeat(256), 'primera\nsegunda', 'texto\tcon tabulación', 'texto\u0000invisible', 'texto\u007fcontrol']) {
    assert.throws(() => prepararAnulacionVenta(motivo));
  }
});
test('Anular venta es una selección contextual del listado, exclusiva del Administrador', () => {
  const ventas = getNavigationForRole(ROLES.ADMINISTRADOR).find(item => item.key === 'ventas');
  assert.equal(ventas.children.find(child => child.key === 'anular-venta').path, '/ventas');
  for (const role of [ROLES.REGENTE, ROLES.VENDEDOR]) {
    assert.equal(getNavigationForRole(role).find(item => item.key === 'ventas').children.some(child => child.key === 'anular-venta'), false);
  }
});
