import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepararTabular, prepararEstadistica } from '../src/features/reportes/utils/exportacionTabular.js';
import { activarDescarga } from '../src/utils/activarDescarga.js';

test('Cuatro fuentes × tres formatos, criterios aplicados completos sin paginación', () => {
  for (const fuente of ['ventas', 'compras', 'perdidas', 'movimientos']) for (const formato of ['PDF', 'XLSX', 'CSV']) {
    const query = fuente === 'movimientos' ? 'desde=1000-01-01&motivo=AJUSTE+LIBRE' : 'mes=2099-01&pagina=999&limite=7';
    assert.deepEqual(prepararTabular(query, fuente, formato), { ...(fuente === 'movimientos' ? { desde: '1000-01-01', motivo: 'AJUSTE LIBRE' } : { mes: '2099-01' }), presentacion: 'TABULAR', formato });
  }
  assert.deepEqual(prepararTabular('', 'movimientos', 'CSV'), { presentacion: 'TABULAR', formato: 'CSV' });
  assert.deepEqual(prepararTabular('hasta=9999-12-31&motivo=DA%C3%91O', 'movimientos', 'PDF'), { hasta: '9999-12-31', motivo: 'DAÑO', presentacion: 'TABULAR', formato: 'PDF' });
});

test('No sanea URLs inválidas ni permite período implícito o campos de otra operación', () => {
  for (const fuente of ['ventas', 'compras', 'perdidas', 'movimientos']) {
    for (const query of ['mes=2026-11&extra=x', 'desde=2026-01-01&desde=2026-01-01', 'formato=CSV', 'presentacion=TABULAR', 'granularidad=MES', 'grafico=BARRAS', 'metrica=IMPORTE', 'motivo=', 'desde=1900-02-29']) {
      assert.throws(() => prepararTabular(query, fuente, 'PDF'), `${fuente}/${query}`);
    }
    assert.throws(() => prepararTabular('mes=2026-11', fuente, ''));
  }
  for (const fuente of ['ventas', 'compras', 'perdidas']) assert.throws(() => prepararTabular('', fuente, 'PDF'));
  assert.throws(() => prepararTabular('pagina=1', 'movimientos', 'CSV'));
});

test('ESTADISTICA: contexto aplicado, tres formatos y todas las gráficas/métricas compatibles', () => {
  for (const fuente of ['ventas', 'compras', 'perdidas']) {
    const propios = fuente === 'perdidas' ? { motivo: 'DAÑO' } : { estadoOperacion: 'ANULADA' };
    const query = new URLSearchParams({ mes: '2026-11', ...propios, pagina: '99', limite: '7', vista: 'ESTADISTICAS', uiGranularidad: 'MES' });
    for (const formato of ['CSV', 'PDF', 'XLSX']) for (const grafico of ['BARRAS', 'LINEAS', 'SECTORES']) for (const metrica of fuente === 'perdidas' ? ['CANTIDAD_RETIROS', 'PERDIDA'] : ['CANTIDAD', 'IMPORTE']) {
      const seleccion = formato === 'CSV' ? undefined : Object.freeze({ grafico, metrica });
      assert.deepEqual(prepararEstadistica(query, fuente, formato, seleccion), { mes: '2026-11', ...propios, presentacion: 'ESTADISTICA', formato, granularidad: 'MES', ...seleccion });
    }
    assert.equal(query.get('pagina'), '99');
    assert.throws(() => prepararTabular(query, fuente, 'PDF'));
    for (const extra of ['&pagina=2', '&limite=01', '&uiGranularidad=DIA', '&extra=x', '&formato=CSV', '&grafico=BARRAS', '&metrica=IMPORTE', '&granularidad=MES', '&vista=CONSULTA']) {
      assert.throws(() => prepararEstadistica(query.toString() + extra, fuente, 'CSV'));
    }
    assert.throws(() => prepararEstadistica(query, fuente, 'CSV', { grafico: 'BARRAS', metrica: 'IMPORTE' }));
    for (const seleccion of [undefined, { grafico: 'BARRAS' }, { granularidad: 'DIA' }, { presentacion: 'TABULAR' }, { grafico: 'TORTA', metrica: 'IMPORTE' }, { grafico: 'LINEAS', metrica: 'CANTIDAD_RETIRADA' }, { grafico: 'BARRAS', metrica: fuente === 'perdidas' ? 'IMPORTE' : 'PERDIDA' }]) {
      assert.throws(() => prepararEstadistica(query, fuente, 'PDF', seleccion));
    }
    for (const invalida of ['', 'mes=2026-11', 'mes=2026-11&vista=ESTADISTICAS', 'mes=2026-11&vista=CONSULTA&uiGranularidad=MES', 'desde=1000-01-01&hasta=2200-01-01&vista=ESTADISTICAS&uiGranularidad=ANIO']) assert.throws(() => prepararEstadistica(invalida, fuente, 'CSV'));
  }
  assert.throws(() => prepararEstadistica('mes=2026-11&vista=ESTADISTICAS&uiGranularidad=MES', 'movimientos', 'CSV'));
});

test('Activación única, anchor retirado; URL consumible hasta limpieza diferida incluso al salir', t => {
  globalThis.document = {}; t.after(() => { delete globalThis.document; });
  const acciones = [], timers = [];
  t.mock.method(URL, 'createObjectURL', blob => { assert.ok(blob instanceof Blob); acciones.push('crear'); return 'blob:simulado'; });
  t.mock.method(URL, 'revokeObjectURL', url => { assert.equal(url, 'blob:simulado'); acciones.push('revocar'); });
  t.mock.method(globalThis, 'setTimeout', (callback, ms) => { timers.push(callback); assert.equal(ms, 60000); });
  const anchor = { click() { acciones.push('click'); }, remove() { acciones.push('retirar'); } };
  t.mock.property(globalThis, 'document', { createElement: () => anchor, body: { append: () => acciones.push('append') } });
  activarDescarga({ blob: new Blob(['simulado']), nombre: 'cadefar-ventas-tabular.pdf' });
  assert.deepEqual(acciones, ['crear', 'append', 'click', 'retirar']);
  assert.equal(anchor.download, 'cadefar-ventas-tabular.pdf');
  assert.equal(timers.length, 1); timers[0]();
  assert.deepEqual(acciones, ['crear', 'append', 'click', 'retirar', 'revocar']);
});

test('Fallo de activación también retira anchor y programa liberación', t => {
  globalThis.document = {}; t.after(() => { delete globalThis.document; });
  const timers = []; let retirado = false, liberado = false;
  t.mock.method(URL, 'createObjectURL', () => 'blob:simulado');
  t.mock.method(URL, 'revokeObjectURL', () => { liberado = true; });
  t.mock.method(globalThis, 'setTimeout', callback => timers.push(callback));
  t.mock.property(globalThis, 'document', { createElement: () => ({ click() { throw new Error('bloqueado'); }, remove() { retirado = true; } }), body: { append() {} } });
  assert.throws(() => activarDescarga({ blob: new Blob(['simulado']), nombre: 'archivo.pdf' }));
  assert.ok(retirado); assert.equal(liberado, false); timers[0](); assert.ok(liberado);
});
