import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

// api.js real, solo sustituye la variable Vite. Axios real con adapter simulado:
// sin socket, backend, DB, navegador ni activación de descargas.
const apiUrl = new URL('../src/api/api.js', import.meta.url);
const codigoApi = (await readFile(apiUrl, 'utf8')).replace('import.meta.env.VITE_API_URL', "'https://api.invalid/api'");
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url === apiUrl.href) return { format: 'module', shortCircuit: true, source: codigoApi };
    return nextLoad(url, context);
  }
});
const { api } = await import('../src/api/api.js');
const reportes = await import('../src/features/reportes/services/reporte.service.js');
const inventario = await import('../src/features/inventario/services/inventario.service.js');
const { recibirArchivo, TIMEOUT_EXPORTACION_MS } = await import('../src/utils/descargaBinaria.js');
hooks.deregister();
api.defaults.adapter = () => { throw new Error('Transporte no simulado'); };
const mime = { PDF: 'application/pdf', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', CSV: 'text/csv' };
const servicios = [
  ['ventas', reportes.exportarReporteVentas, reportes.getEstadisticasVentas],
  ['compras', reportes.exportarReporteCompras, reportes.getEstadisticasCompras],
  ['perdidas', reportes.exportarReportePerdidas, reportes.getEstadisticasPerdidas],
  ['movimientos', inventario.exportarMovimientos]
];
const opciones = { fuente: 'ventas', formato: 'PDF', presentacion: 'TABULAR' };
const response = (formato = 'PDF', overrides = {}) => ({
  status: 200, data: new Blob(['archivo simulado, no documento real'], { type: mime[formato] }),
  headers: { 'content-type': mime[formato] }, ...overrides
});
const simular = (t, fn) => t.mock.method(api.defaults, 'adapter', async config => {
  assert.equal(config.withCredentials, true);
  assert.equal(config.baseURL, 'https://api.invalid/api');
  assert.equal(config.method, 'get');
  return { ...await fn(config), config };
});
const recibir = (extra = {}) => recibirArchivo('/reportes/ventas/exportar', new URLSearchParams(), { ...opciones, ...extra });

test('21 variantes de descarga: paths, credenciales, params, blob/timeout/signal; sin efectos DOM', async t => {
  let total = 0;
  for (const [fuente, servicio] of servicios) {
    for (const presentacion of fuente === 'movimientos' ? ['TABULAR'] : ['TABULAR', 'ESTADISTICA']) {
      for (const formato of ['PDF', 'XLSX', 'CSV']) {
        await t.test(`${fuente}/${presentacion}/${formato}`, async t => {
          const signal = new AbortController().signal;
          const filtros = fuente === 'movimientos' ? { desde: '1000-01-01', motivo: 'AJUSTE LIBRE' }
            : { mes: '9999-12', ...(fuente === 'perdidas' ? { motivo: 'DAÑO' } : { estadoOperacion: 'ANULADA' }) };
          const params = { ...filtros, presentacion, formato,
            ...(presentacion === 'ESTADISTICA' ? { granularidad: 'MES', ...(formato === 'CSV' ? {} : {
              grafico: 'SECTORES', metrica: fuente === 'perdidas' ? 'PERDIDA' : 'IMPORTE'
            }) } : {}) };
          const archivo = response(formato);
          const mock = simular(t, async config => {
            assert.equal(config.url, fuente === 'movimientos' ? '/inventario/movimientos/exportar' : `/reportes/${fuente}/exportar`);
            assert.equal(config.responseType, 'blob');
            assert.equal(config.timeout, 270000);
            assert.equal(config.signal, signal);
            assert.deepEqual(Object.fromEntries(config.params), params);
            if (fuente === 'perdidas') assert.match(config.params.toString(), /DA%C3%91O/);
            return archivo;
          });
          const resultado = await servicio(Object.freeze(params), { signal });
          assert.equal(resultado.blob, archivo.data);
          assert.equal(resultado.nombre, `cadefar-${fuente}-${presentacion.toLowerCase()}.${formato.toLowerCase()}`);
          assert.equal(resultado.nombreServidor, false);
          assert.equal(mock.mock.callCount(), 1);
          total++;
        });
      }
    }
  }
  assert.equal(total, 21);
  assert.equal(TIMEOUT_EXPORTACION_MS, 270000);
});

test('Tres estadísticas: JSON exacto, strings enormes/null intactos, sin defaults HTTP ni cálculos', async t => {
  for (const [fuente, , servicio] of servicios.slice(0, 3)) {
    await t.test(fuente, async t => {
      const data = Object.freeze({ data: Object.freeze({ fuente: fuente.toUpperCase(), periodo: { desde: '1000-01-01', hasta: '1000-01-01' },
        filtros: { [fuente === 'perdidas' ? 'motivo' : 'estadoOperacion']: null }, granularidad: 'DIA', sinDatos: false,
        resumen: { importe: '900719925474099312345.02', cantidadRetirada: '900719925474099312345', referencia: null },
        intervalos: [{ etiqueta: '1000-01-01', desde: '1000-01-01', hasta: '1000-01-01', parcial: false }],
        series: [{ categoria: 'CONFIRMADA', metrica: 'IMPORTE', unidad: 'IMPORTE_MONETARIO', valores: ['900719925474099312345.02'], total: '900719925474099312345.02' }],
        distribuciones: [{ total: '900719925474099312345.02', categorias: [{ valor: '900719925474099312345.02' }] }] }) });
      const original = JSON.stringify(data);
      const signal = new AbortController().signal;
      const params = { dia: '1000-01-01', granularidad: 'DIA' };
      simular(t, async config => {
        assert.equal(config.url, `/reportes/${fuente}/estadisticas`);
        assert.deepEqual(Object.fromEntries(config.params), params);
        assert.equal(config.signal, signal);
        assert.notEqual(config.responseType, 'blob');
        return { status: 200, data, headers: {} };
      });
      assert.equal(await servicio(params, { signal }), data);
      assert.equal(JSON.stringify(data), original);
    });
  }
});

test('Nuevos Services rechazan consultas inválidas antes del transporte; ordinarios conservan su forma', async t => {
  const mock = simular(t, async () => ({ status: 200, data: { data: [] }, headers: {} }));
  for (const [fuente, exportar, estadisticas] of servicios) {
    const temporal = fuente === 'movimientos' ? {} : { dia: '2026-11-20' };
    for (const extra of [{ pagina: '1' }, { limite: '25' }, { desconocido: 'x' }]) {
      await assert.rejects(async () => exportar({ ...temporal, formato: 'CSV', presentacion: 'TABULAR', ...extra }));
      if (estadisticas) await assert.rejects(async () => estadisticas({ ...temporal, granularidad: 'DIA', ...extra }));
    }
  }
  assert.equal(mock.mock.callCount(), 0);
  const resultado = await inventario.getMovimientos({ idMedicamento: '7', desde: '1000-01-01', motivo: ' AJUSTE LIBRE ' });
  assert.deepEqual(resultado, { data: [] });
  const config = mock.mock.calls[0].arguments[0];
  assert.equal(config.url, '/inventario/movimientos');
  assert.deepEqual(Object.fromEntries(config.params), { idMedicamento: '7', desde: '1000-01-01', motivo: 'AJUSTE LIBRE' });
  assert.equal(config.responseType, undefined);
});

test('Blob JSON de errores: preserva estado, sobre seguro y distingue los tres 503; sin reintento', async t => {
  const casos = [[400, 'Datos inválidos'], [401, 'No autorizado'], [403, 'Prohibido'],
    [413, 'La exportación supera el límite técnico; reduzca los filtros o utilice otro formato'],
    [503, 'Generación de exportaciones ocupada; reintente más tarde'], [503, 'Formato no disponible'],
    [503, 'Se agotó el tiempo de generación; reduzca los filtros o reintente'], [500, 'Error interno del servidor']];
  for (const [status, message] of casos) {
    await t.test(`${status} ${message}`, async t => {
      const mock = simular(t, async () => {
        throw Object.assign(new Error('detalle privado no propagado'), { response: { status,
          headers: { 'content-type': 'application/json', 'retry-after': '5' },
          data: new Blob([JSON.stringify({ message, errors: [{ path: ['formato'], message: 'Formato inválido' }], stack: 'privado' })], { type: 'application/json' }) } });
      });
      await assert.rejects(recibir, error => {
        assert.equal(error.status, status);
        assert.equal(error.response.status, status);
        assert.equal(error.response.data.message, error.message);
        if (![401, 403].includes(status)) assert.equal(error.message, message);
        assert.deepEqual(error.errors, [{ path: ['formato'], message: 'Formato inválido' }]);
        assert.equal(error.retryAfter, '5');
        assert.equal(error.response.data.stack, undefined);
        return true;
      });
      assert.equal(mock.mock.callCount(), 1);
    });
  }
});

test('Errores no confiables/malformados/JSON 200 nunca se devuelven como archivos', async t => {
  const mock = simular(t, async () => response());
  for (const body of [JSON.stringify({ message: 'SQL privado C:/secreto', errors: [{ path: ['formato'], message: 'SQL interno' }] }), '{invalido', 'x'.repeat(65537)]) {
    mock.mock.mockImplementation(async config => ({ config, status: 400, headers: { 'content-type': 'application/json' }, data: new Blob([body], { type: 'application/json' }) }));
    await assert.rejects(recibir, error => error.status === 400 && error.message === 'Datos inválidos' && error.errors.length === 0);
  }
  mock.mock.mockImplementation(async config => ({ config, ...response('PDF', { data: new Blob(['{"message":"Formato no disponible"}'], { type: 'application/json' }) }) }));
  await assert.rejects(recibir, error => error.status === 200 && error.message === 'Formato no disponible');
});

test('Blobs inválidos, MIME incompatible/ausente y 204; vacío de datos válido no es Blob de cero bytes', async t => {
  const mock = simular(t, async () => response());
  for (const overrides of [{ data: {} }, { data: 'texto' }, { data: new Blob([], { type: mime.PDF }) },
    { data: new Blob(['archivo'], { type: 'text/html' }) }, { data: new Blob(['archivo']) },
    { headers: { 'content-type': 'text/html' } }, { headers: {} }, { status: 204 }]) {
    mock.mock.mockImplementation(async config => ({ config, ...response('PDF', overrides) }));
    await assert.rejects(recibir, error => ['ARCHIVO_INVALIDO', 'HTTP_EXPORTACION'].includes(error.code));
  }
  mock.mock.mockImplementation(async config => ({ config, ...response('CSV', { data: new Blob(['\uFEFF"id"\r\n'], { type: 'text/csv;charset=utf-8' }), headers: { 'content-type': 'text/csv; charset=utf-8' } }) }));
  assert.ok((await recibir({ formato: 'CSV' })).blob.size > 0);
});

test('Nombres accesibles seguros, hostiles/ambiguos/incompatibles y fallback ASCII', async t => {
  // Axios normaliza controles en headers; ejercitar también el valor crudo recibido por el helper.
  const mock = t.mock.method(api, 'get', async () => response());
  for (const nombre of ['cadefar-ventas-tabular-20261120-103000-0123456789abcdef.pdf', 'informe.pdf']) {
    mock.mock.mockImplementation(async config => ({ config, ...response('PDF', { headers: { 'Content-Type': mime.PDF, 'Content-Disposition': `attachment; filename="${nombre}"` } }) }));
    const resultado = await recibir();
    assert.equal(resultado.nombre, nombre);
    assert.equal(resultado.nombreServidor, true);
  }
  for (const nombre of ['../secreto.pdf', 'C:\\secreto.pdf', '/tmp/secreto.pdf', 'x\u0000.pdf', 'x\r\n.pdf', 'x.xlsx', 'x.csv.pdf', 'x.pdf.exe', 'con.pdf', '.pdf', 'á.pdf', 'a/b.pdf', 'a%2fb.pdf', 'x'.repeat(200) + '.pdf']) {
    mock.mock.mockImplementation(async config => ({ config, ...response('PDF', { headers: { 'content-type': mime.PDF, 'content-disposition': `attachment; filename="${nombre}"` } }) }));
    assert.equal((await recibir()).nombre, 'cadefar-ventas-tabular.pdf', nombre);
  }
  for (const disposition of [undefined, "attachment; filename*=UTF-8''x.pdf", 'attachment; filename=x.pdf; filename=y.pdf']) {
    mock.mock.mockImplementation(async config => ({ config, ...response('PDF', { headers: { 'content-type': mime.PDF, ...(disposition ? { 'content-disposition': disposition } : {}) } }) }));
    assert.equal((await recibir()).nombreServidor, false);
  }
});

test('Cabeceras inaccesibles, longitud comparable, compresión y ausencia de evidencia de identidad', async t => {
  const archivo = response();
  const mock = simular(t, async () => archivo);
  for (const [encoding, longitud, valida, verificada] of [
    ['identity', String(archivo.data.size), true, true], ['identity', '1', false],
    ['gzip', '1', true, false], [undefined, '1', true, false], [undefined, undefined, true, false],
    ['identity', 'invalido', false], ['identity', '900719925474099312345', false]
  ]) {
    mock.mock.mockImplementation(async config => ({ config, ...archivo, headers: {
      'content-type': mime.PDF, ...(encoding ? { 'content-encoding': encoding } : {}), ...(longitud ? { 'content-length': longitud } : {})
    } }));
    if (valida) assert.equal((await recibir()).longitudVerificada, verificada);
    else await assert.rejects(recibir, error => error.code === 'LONGITUD_INVALIDA' && error.status === 200);
  }
  // Prueba el getter inaccesible sin que Axios lo normalice antes del helper.
  t.mock.method(api, 'get', async () => ({ ...archivo, headers: { get(nombre) {
    if (nombre === 'Content-Type') return mime.PDF;
    if (nombre === 'Content-Length') return String(archivo.data.size);
    throw new Error('Cabecera no expuesta');
  } } }));
  const resultado = await recibir();
  assert.equal(resultado.nombreServidor, false);
  assert.equal(resultado.longitudVerificada, false);
});

test('Mismo origen comprobado con URL final permite comparar longitud sin Content-Encoding', async t => {
  const anterior = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { origin: 'https://front.invalid' }, configurable: true });
  t.after(() => {
    if (anterior) Object.defineProperty(globalThis, 'location', anterior);
    else delete globalThis.location;
  });
  simular(t, async () => response('PDF', { request: { responseURL: 'https://front.invalid/api/reportes/ventas/exportar' },
    headers: { 'content-type': mime.PDF, 'content-length': '1' } }));
  await assert.rejects(recibir, error => error.code === 'LONGITUD_INVALIDA');
});

test('Red, transporte truncado, timeout y cancelación previa/durante/tardía: nunca reintentos', async t => {
  const mock = simular(t, async () => response());
  const antes = new AbortController(); antes.abort();
  await assert.rejects(() => recibir({ signal: antes.signal }), error => error.code === 'ERR_CANCELED');
  assert.equal(mock.mock.callCount(), 0);
  for (const [code, esperado] of [['ERR_NETWORK', 'RED'], ['ERR_BAD_RESPONSE', 'RED'], ['ECONNABORTED', 'TIEMPO_AGOTADO'], ['ETIMEDOUT', 'TIEMPO_AGOTADO'], ['ERR_CANCELED', 'ERR_CANCELED']]) {
    mock.mock.mockImplementation(async () => { throw Object.assign(new Error('No propagar'), { code }); });
    const antes = mock.mock.callCount();
    await assert.rejects(recibir, error => error.code === esperado && !error.message.includes('No propagar'));
    assert.equal(mock.mock.callCount(), antes + 1);
  }
  const durante = new AbortController();
  mock.mock.mockImplementation(async config => { durante.abort(); return { ...response(), config }; });
  await assert.rejects(() => recibir({ signal: durante.signal }), error => error.code === 'ERR_CANCELED');
  // Incluso si un transporte ignora AbortSignal, el helper invalida su respuesta.
  const tardia = new AbortController();
  t.mock.method(api, 'get', async () => { tardia.abort(); return response(); });
  await assert.rejects(() => recibir({ signal: tardia.signal }), error => error.code === 'ERR_CANCELED');
});

test('Cancelación durante lectura de Blob JSON y Retry-After ausente/inaccesible', async t => {
  const controller = new AbortController();
  const blob = new Blob(['{"message":"Datos inválidos"}'], { type: 'application/json' });
  t.mock.method(blob, 'text', async () => { controller.abort(); return '{"message":"Datos inválidos"}'; });
  const mock = t.mock.method(api, 'get', async () => {
    throw { response: { status: 400, data: blob, headers: {} } };
  });
  await assert.rejects(() => recibir({ signal: controller.signal }), error => error.code === 'ERR_CANCELED');
  for (const headers of [{}, { get() { throw new Error('No expuesta'); } }]) {
    mock.mock.mockImplementation(async () => {
      throw { response: { status: 503, data: { message: 'Generación de exportaciones ocupada; reintente más tarde' }, headers } };
    });
    await assert.rejects(recibir, error => error.status === 503 && error.retryAfter === null && /ocupada/.test(error.message));
  }
  assert.equal(mock.mock.callCount(), 3);
});

test('Estadísticas propagan errores y cancelación sin reintentos ni respuestas fabricadas', async t => {
  const mock = simular(t, async () => response());
  for (const [, , servicio] of servicios.slice(0, 3)) {
    for (const status of [400, 401, 403, 413, 503, 500, undefined]) {
      const fallo = Object.assign(new Error('Error simulado'), status ? { response: { status, data: { message: 'Error simulado' } } } : {});
      mock.mock.mockImplementation(async () => { throw fallo; });
      const antes = mock.mock.callCount();
      await assert.rejects(() => servicio({ dia: '2026-11-20', granularidad: 'DIA' }), error => error === fallo);
      assert.equal(mock.mock.callCount(), antes + 1);
    }
    const controller = new AbortController(); controller.abort();
    const antes = mock.mock.callCount();
    await assert.rejects(() => servicio({ dia: '2026-11-20', granularidad: 'DIA' }, { signal: controller.signal }), error => error.code === 'ERR_CANCELED');
    assert.equal(mock.mock.callCount(), antes);
  }
});
