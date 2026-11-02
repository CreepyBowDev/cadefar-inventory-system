import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerConsultaVenta, serializarConsultaVenta, validarFiltrosVenta } from '../src/features/ventas/utils/consultaVenta.js';
import { getNavigationForRole, getActiveSidebarItem, getPageTitle, NAVIGATION_ITEMS } from '../src/constants/navigation.js';
import { ROLES } from '../src/constants/roles.js';

test('Consulta de ventas usa los valores predeterminados de la API', () => {
  assert.deepEqual(leerConsultaVenta(''), { filtros: { pagina: '1', limite: '25', campoFecha: 'fechaRegistro' }, error: '' });
});

test('Filtros reales se conservan al serializar y restaurar el listado', () => {
  const filtros = { pagina: '2', limite: '10', campoFecha: 'fechaVenta', idVenta: '8', idUsuario: '3',
    estadoOperacion: 'ANULADA', desde: '2026-11-01', hasta: '2026-11-02' };
  assert.deepEqual(leerConsultaVenta(serializarConsultaVenta(filtros)), { filtros, error: '' });
  assert.equal(serializarConsultaVenta({ idVenta: ' 8 ', desde: '', paciente: 'no-enviar' }), 'idVenta=8');
});

test('URLs rechazan filtros desconocidos, duplicados, vacíos y estados no reconocidos', () => {
  for (const query of ['paciente=x', 'estadoOperacion=PENDIENTE&estadoOperacion=CONFIRMADA', 'idVenta=',
    'desde=%20', 'estadoOperacion=REALIZADA', 'campoFecha=fechaAnulacion']) {
    assert.ok(leerConsultaVenta(query).error, query);
  }
});

test('IDs y páginas rechazan decimales, ceros, exponentes y desbordamientos', () => {
  for (const campo of ['idVenta', 'idUsuario', 'pagina', 'limite']) {
    for (const valor of ['0', '-1', '01', '1.5', '1e2', '2147483648', 'Infinity']) {
      assert.ok(leerConsultaVenta(`${campo}=${valor}`).error, `${campo}=${valor}`);
    }
  }
  assert.equal(leerConsultaVenta('idVenta=2147483647&idUsuario=2147483647&limite=100').error, '');
  assert.ok(leerConsultaVenta('limite=101').error);
});

test('Fechas civiles admiten bisiestos y rechazan fechas imposibles y períodos invertidos', () => {
  assert.equal(leerConsultaVenta('desde=2024-02-29&hasta=2024-02-29').error, '');
  for (const desde of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '0999-12-31', '2026-1-01']) {
    assert.ok(validarFiltrosVenta({ desde }), desde);
  }
  assert.ok(validarFiltrosVenta({ desde: '2026-11-02', hasta: '2026-11-01' }));
});

test('Los tres estados y ambos campos de fecha son criterios válidos', () => {
  for (const estadoOperacion of ['PENDIENTE', 'CONFIRMADA', 'ANULADA']) {
    for (const campoFecha of ['fechaRegistro', 'fechaVenta']) assert.equal(validarFiltrosVenta({ estadoOperacion, campoFecha }), '');
  }
});

test('Los tres roles consultan ventas con icono, posición y estado activo conservados', () => {
  for (const idRol of [ROLES.ADMINISTRADOR, ROLES.REGENTE, ROLES.VENDEDOR]) {
    const items = getNavigationForRole(idRol);
    const ventas = items.find(item => item.key === 'ventas');
    assert.equal(ventas.icon, 'sales');
    assert.equal(ventas.available, true);
    assert.deepEqual(ventas.children.map(child => child.key), idRol === ROLES.VENDEDOR ? ['registrar-venta', 'consultar-ventas'] : idRol === ROLES.ADMINISTRADOR ? ['consultar-ventas', 'anular-venta'] : ['consultar-ventas']);
    assert.deepEqual(getActiveSidebarItem(items, '/ventas/8'), { moduleKey: 'ventas', childKey: 'consultar-ventas' });
    assert.deepEqual(getActiveSidebarItem(items, '/ventas'), { moduleKey: 'ventas', childKey: 'consultar-ventas' });
  }
  const keys = NAVIGATION_ITEMS.map(item => item.key);
  assert.equal(keys[keys.indexOf('ventas') - 1], 'compras');
  assert.equal(keys[keys.indexOf('ventas') + 1], 'inventario');
  assert.equal(NAVIGATION_ITEMS.find(item => item.key === 'recetas').available, true);
  assert.equal(getPageTitle('/ventas'), 'Ventas');
  assert.equal(getPageTitle('/ventas/8'), 'Detalle de la venta');
  assert.equal(getPageTitle('/ventas/nueva'), 'Registrar venta');
  assert.deepEqual(getActiveSidebarItem(getNavigationForRole(ROLES.VENDEDOR), '/ventas/nueva'), { moduleKey: 'ventas', childKey: 'registrar-venta' });
  assert.deepEqual(getActiveSidebarItem(getNavigationForRole(ROLES.ADMINISTRADOR), '/ventas/8', 'anular-venta'), { moduleKey: 'ventas', childKey: 'anular-venta' });
  assert.equal(getActiveSidebarItem(getNavigationForRole(ROLES.ADMINISTRADOR), '/compras/8', 'anular-venta')?.moduleKey, 'compras');
});
