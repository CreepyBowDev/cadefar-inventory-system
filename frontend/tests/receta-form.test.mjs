import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formularioRecetaInicial, prepararReceta, prepararRevision, revisionPendiente, leerConsultaRecetas } from '../src/features/recetas/utils/recetaForm.js';
import { getNavigationForRole, getActiveSidebarItem, getPageTitle } from '../src/constants/navigation.js';
import { ROLES } from '../src/constants/roles.js';

const venta = { idVenta: 8, estadoOperacion: 'PENDIENTE', detalles: [
  { idDetalleVenta: 11, idVenta: 8, idReceta: null }, { idDetalleVenta: 12, idVenta: 8, idReceta: null }, { idDetalleVenta: 13, idVenta: 8, idReceta: 4 }
] };
const form = { ...formularioRecetaInicial(), fechaReceta: '2026-11-02', nombrePaciente: ' Paciente de prueba ',
  documentoPaciente: ' PRUEBA ', nombreMedico: ' Médico de prueba ', modalidad: ' Consulta ', idsDetallesVenta: [11, 12] };

test('Formulario respeta campos reales, normaliza texto y vincula varios detalles de la misma venta', () => {
  const data = prepararReceta({ ...form, archivoReceta: 'no-enviar', resultadoRevision: 'APROBADA' }, venta);
  assert.deepEqual(data, { numeroReceta: null, fechaReceta: '2026-11-02', nombrePaciente: 'Paciente de prueba', documentoPaciente: 'PRUEBA',
    nombreMedico: 'Médico de prueba', modalidad: 'Consulta', observacion: null, idsDetallesVenta: [11, 12] });
  assert.notEqual(data.idsDetallesVenta, form.idsDetallesVenta);
});
test('Sin selección se omiten los vínculos: no se inventan productos respaldados', () => {
  assert.equal(Object.hasOwn(prepararReceta({ ...form, idsDetallesVenta: [] }, venta), 'idsDetallesVenta'), false);
});
test('Vínculos duplicados, ajenos, inexistentes, ya asociados y ventas cerradas se rechazan en UX', () => {
  for (const idsDetallesVenta of [[11, 11], [99], [13], [-1], [0], ['11']]) assert.throws(() => prepararReceta({ ...form, idsDetallesVenta }, venta));
  assert.throws(() => prepararReceta(form, { ...venta, detalles: [{ idDetalleVenta: 11, idVenta: 9, idReceta: null }] }));
  for (const estadoOperacion of ['CONFIRMADA', 'ANULADA']) assert.throws(() => prepararReceta(form, { ...venta, estadoOperacion }));
});
test('Campos obligatorios, opcionales, máximos y controles coinciden con el formulario sin archivos', () => {
  for (const [campo, maximo] of [['nombrePaciente', 150], ['documentoPaciente', 40], ['nombreMedico', 150], ['modalidad', 50], ['numeroReceta', 80], ['observacion', 500]]) {
    assert.throws(() => prepararReceta({ ...form, [campo]: 'x'.repeat(maximo + 1) }, venta));
    assert.throws(() => prepararReceta({ ...form, [campo]: 'texto\nno admitido' }, venta));
    assert.equal(prepararReceta({ ...form, [campo]: 'x'.repeat(maximo) }, venta)[campo].length, maximo);
  }
  for (const campo of ['nombrePaciente', 'documentoPaciente', 'nombreMedico', 'modalidad']) assert.throws(() => prepararReceta({ ...form, [campo]: ' ' }, venta));
  for (const fechaReceta of ['', '2026-02-29', '2026-04-31', '0999-01-01', '2026-1-01']) assert.throws(() => prepararReceta({ ...form, fechaReceta }, venta));
  assert.equal(prepararReceta({ ...form, fechaReceta: '2024-02-29' }, venta).fechaReceta, '2024-02-29');
});
test('Revisión admite solo decisiones definitivas y observación nullable sin datos controlados por API', () => {
  assert.deepEqual(prepararRevision({ resultadoRevision: 'APROBADA', observacion: ' ', idUsuarioValidador: 99 }), { resultadoRevision: 'APROBADA', observacion: null });
  assert.deepEqual(prepararRevision({ resultadoRevision: 'RECHAZADA', observacion: ' Revisar datos ' }), { resultadoRevision: 'RECHAZADA', observacion: 'Revisar datos' });
  assert.throws(() => prepararRevision({ resultadoRevision: '', observacion: '' }));
  assert.throws(() => prepararRevision({ resultadoRevision: 'PENDIENTE', observacion: '' }));
  assert.throws(() => prepararRevision({ resultadoRevision: 'APROBADA', observacion: 'x'.repeat(501) }));
});
test('Pendiente exige los tres campos nulos; una revisión parcial o definitiva no se repite', () => {
  const pendiente = { resultadoRevision: null, idUsuarioValidador: null, fechaValidacion: null };
  assert.equal(revisionPendiente(pendiente), true);
  for (const cambios of [{ resultadoRevision: 'APROBADA' }, { idUsuarioValidador: 2 }, { fechaValidacion: '2026-11-02' }, { resultadoRevision: undefined }]) assert.equal(revisionPendiente({ ...pendiente, ...cambios }), false);
});
test('Consulta de recetas solo admite paginación real, sin filtros de pacientes o estados inventados', () => {
  assert.deepEqual(leerConsultaRecetas(''), { filtros: { pagina: '1', limite: '25' }, error: '' });
  assert.equal(leerConsultaRecetas('pagina=2&limite=100').error, '');
  for (const query of ['paciente=prueba', 'resultadoRevision=APROBADA', 'pagina=0', 'pagina=01', 'limite=101', 'limite=', 'pagina=1&pagina=2']) assert.ok(leerConsultaRecetas(query).error, query);
});
test('Navegación conserva permisos y contexto: registrar para Regente/Vendedor, revisar solo Regente', () => {
  assert.equal(getNavigationForRole(ROLES.ADMINISTRADOR).some(item => item.key === 'recetas'), false);
  for (const idRol of [ROLES.REGENTE, ROLES.VENDEDOR]) {
    const items = getNavigationForRole(idRol);
    const recetas = items.find(item => item.key === 'recetas');
    assert.equal(recetas.icon, 'prescription');
    assert.equal(recetas.path, idRol === ROLES.REGENTE ? '/recetas' : '/recetas/registrar');
    assert.deepEqual(recetas.children.map(child => child.key), idRol === ROLES.REGENTE ? ['registrar-receta', 'revisar-receta'] : ['registrar-receta']);
    assert.deepEqual(getActiveSidebarItem(items, '/ventas/8/recetas/nueva'), { moduleKey: 'recetas', childKey: 'registrar-receta' });
  }
  const items = getNavigationForRole(ROLES.REGENTE);
  assert.deepEqual(getActiveSidebarItem(items, '/ventas/8/recetas/4'), { moduleKey: 'recetas', childKey: 'revisar-receta' });
  assert.deepEqual(getActiveSidebarItem(items, '/ventas/8/recetas'), { moduleKey: 'recetas', childKey: 'revisar-receta' });
  assert.equal(getPageTitle('/recetas'), 'Revisar recetas');
  assert.equal(getPageTitle('/ventas/8/recetas/nueva'), 'Registrar receta');
  assert.equal(getPageTitle('/ventas/8/recetas/4'), 'Detalle de receta');
});
