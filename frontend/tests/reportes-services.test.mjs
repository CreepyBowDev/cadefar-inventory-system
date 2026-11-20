import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { leerConsultaReporte } from '../src/features/reportes/utils/consultaReporte.js';

// Solo sustituye api.js. Ninguna importación backend ni conexión de red/DB.
const apiUrl = new URL('../src/api/api.js', import.meta.url).href;
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url === apiUrl) return {
      format: 'module', shortCircuit: true,
      source: 'export const api = { get() { throw new Error("HTTP no simulado"); } };'
    };
    return nextLoad(url, context);
  }
});
const { api } = await import('../src/api/api.js');
const { getReporteVentas, getReporteCompras, getReportePerdidas } = await import('../src/features/reportes/services/reporte.service.js');
hooks.deregister();

const servicios = [
  ['ventas', getReporteVentas, { dia: '2000-02-29', estadoOperacion: 'PENDIENTE' }],
  ['compras', getReporteCompras, { mes: '9999-12', estadoOperacion: 'ANULADA', pagina: '2', limite: '7' }],
  ['perdidas', getReportePerdidas, { desde: '1000-01-01', hasta: '9999-12-31', motivo: 'DAÑO' }]
];

test('Transporte simulado: paths y params exactos, respuesta anidada intacta sin cálculos', async t => {
  for (const [tipo, servicio, filtros] of servicios) {
    await t.test(tipo, async t => {
      const periodo = Object.freeze({ modalidad: 'PERIODO', desde: '1000-01-01', hasta: '9999-12-31', zonaHoraria: 'America/La_Paz' });
      const resumen = Object.freeze(tipo === 'perdidas'
        ? { vencimiento: Object.freeze({ cantidadRetiros: 0, cantidadRetirada: '0', perdida: '0.00' }),
          dano: Object.freeze({ cantidadRetiros: 2, cantidadRetirada: '900719925474099312345', perdida: '900719925474099312345.02' }),
          cantidadRetiros: 2, cantidadRetirada: '900719925474099312345', perdidaTotal: '900719925474099312345.02' }
        : { confirmadas: Object.freeze({ cantidad: 2, importe: '900719925474099312345.02' }),
          [tipo === 'ventas' ? 'totalVentasRealizadas' : 'totalComprasRealizadas']: '900719925474099312345.02' });
      const detalle = Object.freeze([Object.freeze(tipo === 'perdidas'
        ? { idMovimiento: 1, cantidad: 1, costoUnitarioAplicado: '0.000000', perdida: '0.00', idMovimientoReversion: null, fechaReferencia: '1000-01-01 00:00:00' }
        : { [tipo === 'ventas' ? 'idVenta' : 'idCompra']: 1, total: '900719925474099312345.01', fechaVenta: null, fechaAnulacion: null, fechaReferencia: '9999-12-31 23:59:59' })]);
      const respuesta = Object.freeze({ data: Object.freeze({ periodo, resumen, detalle }),
        paginacion: Object.freeze({ pagina: 2, limite: 7, total: 8, totalPaginas: 2 }) });
      const copia = JSON.stringify(respuesta);
      const get = t.mock.method(api, 'get', async () => ({ data: respuesta }));
      assert.equal(await servicio(Object.freeze(filtros)), respuesta);
      assert.equal(JSON.stringify(respuesta), copia);
      assert.equal(get.mock.callCount(), 1);
      const [path, config] = get.mock.calls[0].arguments;
      assert.equal(path, `/reportes/${tipo}`);
      assert.deepEqual(Object.keys(config), ['params']);
      assert.ok(config.params instanceof URLSearchParams);
      assert.deepEqual(Object.fromEntries(config.params), { pagina: '1', limite: '25', ...filtros });
      if (tipo === 'perdidas') assert.ok(config.params.toString().includes('motivo=DA%C3%91O'));
      assert.equal(config.params.has('tipoPeriodo'), false);
    });
  }
});

test('Servicios no emiten GET sin período ni ante filtros inválidos; utilidades mantienen la guarda del futuro coordinador', async t => {
  const get = t.mock.method(api, 'get', async () => ({ data: {} }));
  for (const [tipo, servicio] of servicios) {
    for (const query of ['', 'pagina=1&limite=25', 'desde=2026-01-01', 'dia=2026-02-30',
      'dia=2026-01-01&tipoPeriodo=DIA', 'dia=2026-01-01&dia=2026-01-01']) {
      const consulta = leerConsultaReporte(query, tipo);
      assert.equal(consulta.habilitada, false);
      // Contrato que deberá usar la Fase 2 como cuarto argumento de useConsulta.
      if (consulta.habilitada) await servicio(consulta.filtros);
    }
    await assert.rejects(() => servicio(), /período/);
    for (const filtros of [{}, { dia: '2026-02-30' }, { dia: ['2026-01-01'] },
      { dia: '2026-01-01', tipoPeriodo: 'DIA' }, { mes: '2026-01', limite: '0' }]) {
      await assert.rejects(() => servicio(filtros));
    }
  }
  assert.equal(get.mock.callCount(), 0);
});

test('Vacíos y páginas lejanas conservan resumen y paginación del servidor sin reajuste', async t => {
  const get = t.mock.method(api, 'get');
  for (const [, servicio, filtros] of servicios) {
    for (const total of [0, 8]) {
      const respuesta = { data: { periodo: { desde: '2026-01-01', hasta: '2026-01-01' },
        resumen: { importe: total ? '123.00' : '0.00' }, detalle: [] },
        paginacion: { pagina: 2147483647, limite: 7, total, totalPaginas: total ? 2 : 0 } };
      get.mock.mockImplementation(async () => ({ data: respuesta }));
      assert.equal(await servicio({ ...filtros, pagina: '2147483647', limite: '7' }), respuesta);
    }
  }
  assert.equal(get.mock.callCount(), 6);
});

test('Errores HTTP y de red se propagan intactos, sin reintentos ni resultados fabricados', async t => {
  const get = t.mock.method(api, 'get');
  for (const status of [400, 401, 403, 500, undefined]) {
    const failure = status ? { response: { status, data: { message: 'Error simulado' } } } : new Error('Sin conexión');
    get.mock.mockImplementation(async () => { throw failure; });
    for (const [, servicio, filtros] of servicios) {
      const antes = get.mock.callCount();
      await assert.rejects(() => servicio(filtros), error => error === failure);
      assert.equal(get.mock.callCount(), antes + 1);
    }
  }
});
