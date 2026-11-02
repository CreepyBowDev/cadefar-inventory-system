import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// Sustituir únicamente el transporte evita peticiones reales y permite probar
// los servicios sin Vite, secretos, navegador ni una base de datos.
const apiUrl = new URL('../src/api/api.js', import.meta.url).href;
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url === apiUrl) return {
      format: 'module', shortCircuit: true,
      source: 'export const api = { get() { throw new Error("HTTP no simulado"); }, post() { throw new Error("HTTP no simulado"); } };'
    };
    return nextLoad(url, context);
  }
});
const { api } = await import('../src/api/api.js');
const ventas = await import('../src/features/ventas/services/venta.service.js');
const recetas = await import('../src/features/recetas/services/receta.service.js');
hooks.deregister();

test('Servicios Ventas y Recetas: contratos HTTP sin acceso a red', async (t) => {
  await t.test('Ventas envía solo filtros soportados y conserva paginación', async (t) => {
    const respuesta = { data: [], paginacion: { pagina: 2, limite: 10, total: 11, totalPaginas: 2 } };
    const get = t.mock.method(api, 'get', async () => ({ data: respuesta }));
    assert.equal(await ventas.getVentas({ idVenta: 8, idUsuario: ' 3 ', estadoOperacion: 'PENDIENTE',
      campoFecha: 'fechaRegistro', desde: '2026-11-01', hasta: '2026-11-02', pagina: 2, limite: 10,
      paciente: 'No enviar', claveOperacion: 'no-soportada' }), respuesta);
    const [path, { params }] = get.mock.calls[0].arguments;
    assert.equal(path, '/ventas');
    assert.deepEqual(Object.fromEntries(params), { idVenta: '8', idUsuario: '3', estadoOperacion: 'PENDIENTE',
      campoFecha: 'fechaRegistro', desde: '2026-11-01', hasta: '2026-11-02', pagina: '2', limite: '10' });
  });

  await t.test('Consultas omiten filtros vacíos y dejan los valores predeterminados a la API', async (t) => {
    const get = t.mock.method(api, 'get', async () => ({ data: { data: [] } }));
    await ventas.getVentas();
    await ventas.getVentas({ desde: ' ', hasta: null, idUsuario: undefined });
    await recetas.getRecetas(8);
    for (const call of get.mock.calls) assert.equal(call.arguments[1].params.toString(), '');
  });

  await t.test('Detalle de venta conserva datos, recetas y estados entregados por la API', async (t) => {
    const respuesta = { data: { idVenta: 8, estadoOperacion: 'PENDIENTE', fechaVenta: null,
      recetas: [{ idReceta: 4, resultadoRevision: null }], detalles: [] } };
    const get = t.mock.method(api, 'get', async () => ({ data: respuesta }));
    assert.equal(await ventas.getVenta(8), respuesta);
    assert.deepEqual(get.mock.calls[0].arguments, ['/ventas/8']);
  });

  await t.test('Registro envía clave y detalles permitidos, sin total ni estado del cliente', async (t) => {
    const respuesta = { message: 'Venta pendiente registrada exitosamente', data: { estadoOperacion: 'PENDIENTE' } };
    const post = t.mock.method(api, 'post', async () => ({ data: respuesta }));
    const detalle = { idMedicamento: 2, idExistencia: 12, cantidad: 3, precioUnitario: '10.50' };
    assert.equal(await ventas.createVenta({ claveOperacion: 'venta_1', estadoOperacion: 'CONFIRMADA', total: '0.00',
      idUsuario: 99, detalles: [{ ...detalle, subtotal: '0.00', idReceta: 7 }] }), respuesta);
    assert.deepEqual(post.mock.calls[0].arguments, ['/ventas', { claveOperacion: 'venta_1', detalles: [detalle] }]);
  });

  await t.test('Confirmación envía cuerpo vacío y devuelve el resultado real', async (t) => {
    const respuesta = { message: 'Venta confirmada exitosamente', data: { estadoOperacion: 'CONFIRMADA' } };
    const post = t.mock.method(api, 'post', async () => ({ data: respuesta }));
    assert.equal(await ventas.confirmarVenta(8), respuesta);
    assert.deepEqual(post.mock.calls[0].arguments, ['/ventas/8/confirmar', {}]);
  });

  await t.test('Anulación solo envía el motivo', async (t) => {
    const respuesta = { data: { estadoOperacion: 'ANULADA' } };
    const post = t.mock.method(api, 'post', async () => ({ data: respuesta }));
    assert.equal(await ventas.anularVenta(8, { motivo: 'Solicitud del cliente', idUsuarioAnulador: 99 }), respuesta);
    assert.deepEqual(post.mock.calls[0].arguments, ['/ventas/8/anular', { motivo: 'Solicitud del cliente' }]);
  });

  await t.test('Recetas usa listado paginado por venta, sin filtros inventados', async (t) => {
    const respuesta = { data: [], paginacion: { pagina: 1, limite: 25, total: 0, totalPaginas: 0 } };
    const get = t.mock.method(api, 'get', async () => ({ data: respuesta }));
    assert.equal(await recetas.getRecetas(8, { pagina: ' 1 ', limite: 25, resultadoRevision: 'APROBADA' }), respuesta);
    const [path, { params }] = get.mock.calls[0].arguments;
    assert.equal(path, '/ventas/8/recetas');
    assert.deepEqual(Object.fromEntries(params), { pagina: '1', limite: '25' });
  });

  await t.test('Detalle de receta exige contexto de venta y conserva revisión pendiente nula', async (t) => {
    const respuesta = { data: { idVenta: 8, idReceta: 4, resultadoRevision: null } };
    const get = t.mock.method(api, 'get', async () => ({ data: respuesta }));
    assert.equal(await recetas.getReceta(8, 4), respuesta);
    assert.deepEqual(get.mock.calls[0].arguments, ['/ventas/8/recetas/4']);
  });

  const formulario = { fechaReceta: '2026-11-02', nombrePaciente: 'Paciente de prueba',
    documentoPaciente: 'PRUEBA', nombreMedico: 'Médico de prueba', modalidad: 'Consulta' };

  await t.test('Registro sin archivos admite vínculos múltiples y excluye campos controlados por backend', async (t) => {
    const respuesta = { data: { idReceta: 4, resultadoRevision: null } };
    const post = t.mock.method(api, 'post', async () => ({ data: respuesta }));
    const datos = { ...formulario, numeroReceta: 'TEST-1', observacion: 'Texto de prueba', idsDetallesVenta: [11, 12] };
    assert.equal(await recetas.createReceta(8, { ...datos, archivoReceta: 'no-enviar', archivo_receta: 'no-enviar',
      idVenta: 99, resultadoRevision: 'APROBADA', idUsuarioValidador: 1 }), respuesta);
    assert.deepEqual(post.mock.calls[0].arguments, ['/ventas/8/recetas', datos]);
  });

  await t.test('Registro no inventa vínculos ni campos opcionales', async (t) => {
    const post = t.mock.method(api, 'post', async () => ({ data: {} }));
    await recetas.createReceta(8, formulario);
    assert.deepEqual(post.mock.calls[0].arguments, ['/ventas/8/recetas', formulario]);
    await recetas.createReceta(8, { ...formulario, numeroReceta: null, observacion: null });
    assert.deepEqual(post.mock.calls[1].arguments[1], { ...formulario, numeroReceta: null, observacion: null });
  });

  await t.test('Revisión envía resultado y observación sin aprobar ni confirmar localmente', async (t) => {
    const respuesta = { data: { resultadoRevision: 'RECHAZADA' } };
    const post = t.mock.method(api, 'post', async () => ({ data: respuesta }));
    assert.equal(await recetas.revisarReceta(8, 4, { resultadoRevision: 'RECHAZADA', observacion: 'Revisar datos',
      idUsuarioValidador: 99, fechaValidacion: 'no-enviar' }), respuesta);
    assert.deepEqual(post.mock.calls[0].arguments, ['/ventas/8/recetas/4/revisar', {
      resultadoRevision: 'RECHAZADA', observacion: 'Revisar datos'
    }]);
  });

  await t.test('Revisión distingue observación omitida de null', async (t) => {
    const post = t.mock.method(api, 'post', async () => ({ data: {} }));
    await recetas.revisarReceta(8, 4, { resultadoRevision: 'APROBADA' });
    await recetas.revisarReceta(8, 4, { resultadoRevision: 'APROBADA', observacion: null });
    assert.deepEqual(post.mock.calls[0].arguments[1], { resultadoRevision: 'APROBADA' });
    assert.deepEqual(post.mock.calls[1].arguments[1], { resultadoRevision: 'APROBADA', observacion: null });
  });

  await t.test('Todos los servicios propagan errores HTTP y de red, sin reintentos ni éxitos falsos', async (t) => {
    const get = t.mock.method(api, 'get');
    const post = t.mock.method(api, 'post');
    const operaciones = [() => ventas.getVentas(), () => ventas.getVenta(8),
      () => ventas.createVenta({ claveOperacion: 'test', detalles: [] }), () => ventas.confirmarVenta(8),
      () => ventas.anularVenta(8, { motivo: 'Prueba' }), () => recetas.getRecetas(8),
      () => recetas.getReceta(8, 4), () => recetas.createReceta(8, formulario),
      () => recetas.revisarReceta(8, 4, { resultadoRevision: 'APROBADA' })];
    for (const status of [400, 401, 403, 404, 409, 500, undefined]) {
      const failure = status ? { response: { status, data: { message: 'Error de prueba' } } } : new Error('Sin conexión');
      get.mock.mockImplementation(async () => { throw failure; });
      post.mock.mockImplementation(async () => { throw failure; });
      for (const operacion of operaciones) {
        const antes = get.mock.callCount() + post.mock.callCount();
        await assert.rejects(operacion, (error) => error === failure);
        assert.equal(get.mock.callCount() + post.mock.callCount(), antes + 1);
      }
    }
  });
});
