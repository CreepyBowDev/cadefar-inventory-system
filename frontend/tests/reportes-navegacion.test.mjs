import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActiveSidebarItem, getNavigationForRole, getPageTitle } from '../src/constants/navigation.js';
import { ROLES } from '../src/constants/roles.js';

test('Reportes completo: CU38/CU39/CU40/CU41 por rol y sin landing', () => {
  for (const role of [ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR]) {
    const items = getNavigationForRole(role);
    const reportes = items.find(item => item.key === 'reportes');
    if (role === ROLES.VENDEDOR) { assert.equal(reportes, undefined); continue; }
    const admin = role === ROLES.ADMINISTRADOR;
    assert.equal(reportes.path, admin ? '/reportes/ventas' : '/inventario/movimientos');
    assert.deepEqual(reportes.children.map(child => child.key), admin ? ['reporte-ventas', 'reporte-compras', 'reporte-historial', 'reporte-perdidas'] : ['reporte-historial', 'reporte-perdidas']);
    assert.equal(reportes.icon, 'report'); assert.equal(reportes.available, true);
    assert.deepEqual(getActiveSidebarItem(items, '/inventario/movimientos', 'reporte-historial'), { moduleKey: 'reportes', childKey: 'reporte-historial' });
    assert.deepEqual(getActiveSidebarItem(items, '/inventario/movimientos'), { moduleKey: 'inventario', childKey: 'consultar-movimientos' });
    assert.deepEqual(getActiveSidebarItem(items, '/inventario/movimientos', 'consultar-movimientos'), { moduleKey: 'inventario', childKey: 'consultar-movimientos' });
    assert.equal(items.flatMap(item => item.children || []).some(child => child.path === '/reportes'), false);
    assert.deepEqual(getActiveSidebarItem(items, '/reportes/perdidas'), { moduleKey: 'reportes', childKey: 'reporte-perdidas' });
    assert.equal(reportes.children.some(child => child.path === '/reportes/compras'), admin);
    if (admin) assert.deepEqual(getActiveSidebarItem(items, '/reportes/compras'), { moduleKey: 'reportes', childKey: 'reporte-compras' });
  }
  assert.equal(getPageTitle('/reportes/ventas'), 'Reporte de ventas');
  assert.equal(getPageTitle('/reportes/compras'), 'Reporte de compras');
  assert.equal(getPageTitle('/reportes/perdidas'), 'Consulta de pérdidas');
});
