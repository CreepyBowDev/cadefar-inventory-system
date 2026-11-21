import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estadisticasFuente } from './fixtures/estadisticasComprasPerdidas.mjs';
import { leerConsultaReporte, leerConsultaReporteAmpliada, serializarEstadisticasReporte } from '../src/features/reportes/utils/consultaReporte.js';
import { prepararTabular } from '../src/features/reportes/utils/exportacionTabular.js';
import { escalaSeries, panelesIntervalos, proporcionVisual } from '../src/features/reportes/utils/escalaEstadistica.js';

for (const tipo of ['compras', 'perdidas']) {
  test(`${tipo}: series, unidades, exclusiones, ceros y exactitud sin mutación`, () => {
    const data = estadisticasFuente(tipo).data, original = JSON.stringify(data);
    assert.equal(data.series.length, tipo === 'compras' ? 4 : 6);
    assert.deepEqual(data.series.map(s => s.unidad), tipo === 'compras' ? ['OPERACIONES', 'IMPORTE_MONETARIO', 'OPERACIONES', 'IMPORTE_MONETARIO'] : ['RETIROS', 'UNIDADES_INVENTARIO_HETEROGENEAS', 'IMPORTE_MONETARIO', 'RETIROS', 'UNIDADES_INVENTARIO_HETEROGENEAS', 'IMPORTE_MONETARIO']);
    const grande = estadisticasFuente(tipo, undefined, { grande: true }).data;
    const dinero = grande.series.filter(s => s.unidad === 'IMPORTE_MONETARIO');
    assert.equal(escalaSeries(dinero), 90071992547409931234501n);
    assert.equal(proporcionVisual('0.01', escalaSeries(dinero)), 0);
    const params = new URLSearchParams(tipo === 'compras' ? 'estadoOperacion=ANULADA' : 'motivo=DAÑO');
    const excluida = estadisticasFuente(tipo, params).data;
    assert.ok(excluida.series.filter(s => s.categoria === (tipo === 'compras' ? 'CONFIRMADA' : 'VENCIMIENTO')).every(s => s.valores.every(v => ['0', '0.00'].includes(v))));
    assert.equal(estadisticasFuente(tipo, undefined, { cero: true }).data.sinDatos, false);
    assert.equal(estadisticasFuente(tipo, undefined, { vacio: true }).data.sinDatos, true);
    assert.equal(panelesIntervalos(estadisticasFuente(tipo, undefined, { intervalos1200: true }).data.intervalos).flatMap(p => p.intervalos).length, 1200);
    assert.equal(JSON.stringify(data), original);
    if (tipo === 'compras') assert.notEqual(data.resumen.totalComprasRealizadas, data.distribuciones[1].total);
    else { assert.equal(data.resumen.perdidaTotal, '0.02'); assert.equal(data.resumen.cantidadRetirada, '900719925474099312347'); }
  });
  test(`${tipo}: URL completa estricta, lector opt-in, 1200/1201 y TABULAR sin UI`, () => {
    const query = 'desde=1000-01-01&hasta=2199-12-31&pagina=99&vista=ESTADISTICAS&uiGranularidad=ANIO';
    const aplicada = leerConsultaReporteAmpliada(query, tipo);
    assert.equal(leerConsultaReporte(query, tipo).estado, 'invalida');
    assert.equal(serializarEstadisticasReporte({ ...aplicada.filtrosAplicados, granularidad: 'ANIO' }, tipo), 'desde=1000-01-01&hasta=2199-12-31&granularidad=ANIO');
    assert.throws(() => serializarEstadisticasReporte({ ...aplicada.filtrosAplicados, hasta: '2200-12-31', granularidad: 'ANIO' }, tipo), /1200/);
    assert.throws(() => prepararTabular(query, tipo, 'PDF'), /Consulta/);
    for (const extra of ['&extra=x', '&pagina=2', '&vista=CONSULTA', '&uiGranularidad=MES', '&metrica=PERDIDA']) {
      assert.equal(leerConsultaReporteAmpliada(query + extra, tipo).estado, 'invalida');
      assert.throws(() => prepararTabular('mes=2026-11&vista=CONSULTA&pagina=99' + extra, tipo, 'CSV'));
    }
    assert.deepEqual(prepararTabular('mes=2026-11&vista=CONSULTA&pagina=99', tipo, 'CSV'), { mes: '2026-11', presentacion: 'TABULAR', formato: 'CSV' });
  });
}
