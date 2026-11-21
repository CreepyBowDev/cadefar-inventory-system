import assert from 'node:assert/strict';
import { test } from 'node:test';
import { magnitudExacta, proporcionVisual, escalaSeries, panelesIntervalos } from '../src/features/reportes/utils/escalaEstadistica.js';
import { leerConsultaReporteAmpliada, serializarEstadisticasReporte } from '../src/features/reportes/utils/consultaReporte.js';
import { prepararTabular } from '../src/features/reportes/utils/exportacionTabular.js';
import { estadisticasVentas, categoriasVentas } from './fixtures/estadisticasVentas.mjs';

test('Ocho series contractuales, orden, ceros y strings exactos sin mutación', () => {
  const { data } = estadisticasVentas(); const original = JSON.stringify(data);
  assert.equal(data.series.length, 8);
  assert.deepEqual(data.series.map(s => s.categoria), categoriasVentas.flatMap(c => [c, c]));
  const series = data.series.filter(s => s.metrica === 'IMPORTE');
  const max = escalaSeries(series);
  assert.equal(max, 90071992547409931234501n);
  assert.equal(proporcionVisual('900719925474099312345.01', max), 1);
  assert.equal(proporcionVisual('0.01', max), 0);
  assert.equal(proporcionVisual('0.00', 0n), 0);
  assert.equal(JSON.stringify(data), original);
  assert.equal(data.distribuciones[1].total, '900719925474099312345.02');
  assert.notEqual(data.distribuciones[1].total, data.resumen.totalVentasRealizadas);
});
test('Escala acotada: error inferior a millonésima, incluso por debajo de resolución', () => {
  for (const valor of ['0.00', '0.01', '123.45', '999999999999999999999.99']) {
    const escala = magnitudExacta('999999999999999999999.99');
    const coordenada = proporcionVisual(valor, escala);
    assert.ok(coordenada >= 0 && coordenada <= 1);
    const paso = magnitudExacta(valor) * 1000000n / escala;
    assert.equal(coordenada, Number(paso) / 1000000);
    assert.ok(magnitudExacta(valor) * 1000000n - paso * escala < escala);
  }
});
test('Paneles 60/61/1200 sin muestreo, parciales y categorías excluidas intactos', () => {
  const { data } = estadisticasVentas(new URLSearchParams('estadoOperacion=ANULADA'), { intervalos1200: true });
  const paneles = panelesIntervalos(data.intervalos);
  assert.equal(paneles.length, 20); assert.ok(paneles.every(p => p.intervalos.length === 60));
  assert.deepEqual(paneles.flatMap(p => p.intervalos), data.intervalos);
  assert.equal(paneles.at(-1).inicio, 1140);
  assert.equal(panelesIntervalos(data.intervalos.slice(0, 61)).length, 2);
  assert.ok(data.series[0].valores.every(v => v === '0'));
  assert.ok(estadisticasVentas().data.intervalos.every(i => i.parcial));
});
test('Sin operaciones difiere de operaciones con importe cero', () => {
  const cero = estadisticasVentas(undefined, { cero: true }).data;
  const vacio = estadisticasVentas(undefined, { vacio: true }).data;
  assert.equal(cero.sinDatos, false); assert.equal(vacio.sinDatos, true);
  assert.equal(cero.distribuciones[1].total, '0.00'); assert.equal(vacio.distribuciones[1].total, '0.00');
});
test('UI opt-in estricta separa HTTP, TABULAR solo Consulta y 1200/1201 no se reparan', () => {
  const query = 'desde=1000-01-01&hasta=2199-12-31&pagina=99&limite=7&vista=ESTADISTICAS&uiGranularidad=ANIO';
  const leida = leerConsultaReporteAmpliada(query, 'ventas');
  assert.equal(serializarEstadisticasReporte({ ...leida.filtrosAplicados, granularidad: leida.ui.uiGranularidad }, 'ventas'), 'desde=1000-01-01&hasta=2199-12-31&granularidad=ANIO');
  assert.throws(() => serializarEstadisticasReporte({ ...leida.filtrosAplicados, hasta: '2200-12-31', granularidad: 'ANIO' }, 'ventas'), /1200/);
  for (const extra of ['&extra=x', '&vista=CONSULTA', '&uiGranularidad=DIA', '&metrica=IMPORTE']) assert.equal(leerConsultaReporteAmpliada(query + extra, 'ventas').habilitada, false);
  assert.throws(() => prepararTabular(query, 'ventas', 'PDF'), /Consulta/);
  assert.deepEqual(prepararTabular('mes=2026-11&vista=CONSULTA&pagina=99', 'ventas', 'CSV'), { mes: '2026-11', presentacion: 'TABULAR', formato: 'CSV' });
});
