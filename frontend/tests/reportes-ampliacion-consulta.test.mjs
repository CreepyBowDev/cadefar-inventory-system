import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerConsultaReporte, leerConsultaReporteAmpliada, serializarConsultaReporte, serializarEstadisticasReporte as estadisticas, serializarExportacionReporte as exportar } from '../src/features/reportes/utils/consultaReporte.js';
import { serializarExportacionMovimientos as movimientos } from '../src/features/inventario/utils/consultaExportacionMovimientos.js';

const tipos = ['ventas', 'compras', 'perdidas'];
const base = { dia: '2026-11-20' };
const estadistica = { ...base, granularidad: 'DIA' };
const tabular = { ...base, formato: 'PDF', presentacion: 'TABULAR' };

test('Estadísticas: modalidades civiles, bisiestos, extremos y futuros; no paginación implícita', () => {
  for (const tipo of tipos) {
    for (const periodo of [{ dia: '1000-01-01' }, { mes: '9999-12' }, { dia: '2000-02-29' },
      { dia: '2400-02-29' }, { desde: '2099-12-15', hasta: '2100-01-05' }]) {
      for (const granularidad of ['DIA', 'MES', 'ANIO']) {
        const params = { ...periodo, granularidad };
        assert.deepEqual(Object.fromEntries(new URLSearchParams(estadisticas(params, tipo))), params);
      }
    }
    for (const periodo of [{}, { dia: '1900-02-29' }, { dia: '2100-02-29' }, { dia: '0999-12-31' },
      { dia: '10000-01-01' }, { mes: '2026-13' }, { desde: '2026-01-01' }, { hasta: '2026-01-01' },
      { dia: '2026-01-01', mes: '2026-01' }, { desde: '2026-02-01', hasta: '2026-01-31' }]) {
      assert.throws(() => estadisticas({ ...periodo, granularidad: 'ANIO' }, tipo));
    }
    assert.throws(() => estadisticas(base, tipo), /granularidad/);
  }
});

test('Intervalos inclusivos parciales 1200/1201 por DIA, MES y ANIO sin recortar ni cambiar selección', () => {
  for (const [granularidad, desde, hasta1200, hasta1201] of [
    ['DIA', '2000-01-01', '2003-04-14', '2003-04-15'],
    ['MES', '2000-01-31', '2099-12-01', '2100-01-01'],
    ['ANIO', '1000-12-31', '2199-01-01', '2200-01-01']
  ]) {
    const valido = Object.freeze({ desde, hasta: hasta1200, granularidad });
    assert.ok(estadisticas(valido, 'ventas'));
    const invalido = { ...valido, hasta: hasta1201 };
    assert.throws(() => estadisticas(invalido, 'ventas'), /1200 intervalos/);
    assert.throws(() => exportar({ ...invalido, formato: 'CSV', presentacion: 'ESTADISTICA' }, 'ventas'), /1200 intervalos/);
  }
  assert.ok(estadisticas({ desde: '2026-11-15', hasta: '2026-12-05', granularidad: 'MES' }, 'ventas'));
  assert.ok(estadisticas({ mes: '2000-02', granularidad: 'DIA' }, 'ventas'));
  assert.ok(serializarConsultaReporte({ desde: '1000-01-01', hasta: '9999-12-31' }, 'ventas'));
  assert.ok(exportar({ desde: '1000-01-01', hasta: '9999-12-31', formato: 'CSV', presentacion: 'TABULAR' }, 'ventas'));
});

test('Matriz estricta: formatos, gráficos y métricas compatibles; nunca CANTIDAD_RETIRADA', () => {
  for (const tipo of tipos) {
    for (const formato of ['PDF', 'XLSX', 'CSV']) {
      assert.ok(exportar({ ...base, formato, presentacion: 'TABULAR' }, tipo));
      const params = { ...base, formato, presentacion: 'ESTADISTICA', granularidad: 'MES' };
      if (formato === 'CSV') {
        assert.ok(exportar(params, tipo));
        for (const extra of [{ grafico: 'BARRAS' }, { metrica: 'IMPORTE' }]) assert.throws(() => exportar({ ...params, ...extra }, tipo));
      } else {
        for (const grafico of ['BARRAS', 'LINEAS', 'SECTORES']) {
          for (const metrica of tipo === 'perdidas' ? ['CANTIDAD_RETIROS', 'PERDIDA'] : ['CANTIDAD', 'IMPORTE']) {
            assert.ok(exportar({ ...params, grafico, metrica }, tipo));
          }
        }
        for (const extra of [{}, { grafico: 'BARRAS' }, { metrica: 'IMPORTE' }, { grafico: 'TORTA', metrica: 'IMPORTE' },
          { grafico: 'BARRAS', metrica: 'CANTIDAD_RETIRADA' }, { grafico: 'BARRAS', metrica: tipo === 'perdidas' ? 'IMPORTE' : 'PERDIDA' }]) {
          assert.throws(() => exportar({ ...params, ...extra }, tipo));
        }
      }
    }
    for (const extra of [{ granularidad: 'DIA' }, { grafico: 'LINEAS' }, { metrica: 'CANTIDAD' }, { formato: 'pdf' }, { presentacion: '' }]) {
      assert.throws(() => exportar({ ...tabular, ...extra }, tipo));
    }
    for (const campo of ['formato', 'presentacion']) {
      const params = { ...tabular }; delete params[campo];
      assert.throws(() => exportar(params, tipo));
    }
  }
});

test('Sin saneamiento silencioso: repetidos, desconocidos, vacíos, no strings y filtros cruzados', () => {
  for (const tipo of tipos) {
    for (const [serializar, params] of [[estadisticas, estadistica], [exportar, tabular]]) {
      for (const extra of [{ pagina: '1' }, { limite: '25' }, { desconocido: 'x' }, { vista: 'CONSULTA' },
        { uiGranularidad: 'MES' }, { [tipo === 'perdidas' ? 'estadoOperacion' : 'motivo']: 'DAÑO' },
        { dia: '' }, { dia: ['2026-11-20'] }, { dia: null }, { dia: 1 }, { dia: ' 2026-11-20' }]) {
        assert.throws(() => serializar({ ...params, ...extra }, tipo));
      }
      const query = new URLSearchParams(params).toString();
      for (const campo of Object.keys(params)) assert.throws(() => serializar(`${query}&${campo}=${params[campo]}`, tipo), /repetidos/);
      assert.throws(() => serializar(`${query}&%64ia=2026-11-20`, tipo), /repetidos/);
      assert.throws(() => serializar(`${query}&dia[]=2026-11-20`, tipo));
    }
    for (const campo of ['formato', 'presentacion', 'grafico', 'metrica']) assert.throws(() => estadisticas({ ...estadistica, [campo]: 'x' }, tipo));
  }
  assert.match(estadisticas({ ...estadistica, motivo: 'DAÑO' }, 'perdidas'), /motivo=DA%C3%91O/);
  assert.throws(() => estadisticas({ ...estadistica, estadoOperacion: 'PENDIENTE' }, 'compras'));
  assert.throws(() => estadisticas(estadistica, '__proto__'));
});

test('CU40 abierto: filtros propios textuales, sin exigir período ni limitar motivo a pérdidas', () => {
  const opciones = { formato: 'CSV', presentacion: 'TABULAR' };
  for (const filtros of [{}, { desde: '1000-01-01' }, { hasta: '9999-12-31' },
    { desde: '2000-02-29', hasta: '2400-02-29', idMedicamento: '2147483647', idExistencia: '1', direccion: 'ENTRADA', motivo: 'AJUSTE LIBRE' },
    { motivo: 'DAÑO' }, { motivo: 'x'.repeat(40) }]) {
    assert.deepEqual(Object.fromEntries(new URLSearchParams(movimientos({ ...opciones, ...filtros }))), { ...opciones, ...filtros });
  }
  assert.equal(new URLSearchParams(movimientos({ ...opciones, motivo: ' AJUSTE LIBRE ' })).get('motivo'), 'AJUSTE LIBRE');
  for (const filtros of [{ idMedicamento: '01' }, { idExistencia: '2147483648' }, { idExistencia: 1 },
    { desde: '1900-02-29' }, { hasta: '10000-01-01' }, { desde: '2026-02-01', hasta: '2026-01-01' },
    { motivo: '' }, { motivo: '   ' }, { motivo: 'x'.repeat(41) }, { direccion: 'salida' },
    ...['pagina', 'limite', 'dia', 'mes', 'granularidad', 'grafico', 'metrica', 'estadoOperacion', 'extra'].map(campo => ({ [campo]: '1' })),
    { presentacion: 'ESTADISTICA' }, { formato: 'TXT' }]) assert.throws(() => movimientos({ ...opciones, ...filtros }));
  assert.throws(() => movimientos('formato=CSV&presentacion=TABULAR&motivo=DAÑO&motivo=DAÑO'), /repetidos/);
  const completos = { ...opciones, idMedicamento: '1', idExistencia: '2', desde: '1000-01-01', hasta: '9999-12-31', direccion: 'SALIDA', motivo: 'DAÑO' };
  for (const [campo, valor] of Object.entries(completos)) {
    assert.throws(() => movimientos(`${new URLSearchParams(completos)}&${campo}=${encodeURIComponent(valor)}`), /repetidos/);
  }
});

test('URL ampliada opt-in: UI separada, filtros aplicados sin página y HTTP estricto anterior intacto', () => {
  const anterior = 'mes=2026-11&estadoOperacion=ANULADA&pagina=3&limite=7';
  const normal = leerConsultaReporte(anterior, 'ventas');
  const ampliada = leerConsultaReporteAmpliada(anterior, 'ventas');
  assert.deepEqual(ampliada.filtros, normal.filtros);
  assert.deepEqual(ampliada.ui, { vista: 'CONSULTA' });
  const url = `${anterior}&vista=ESTADISTICAS&uiGranularidad=MES`;
  const resultado = leerConsultaReporteAmpliada(url, 'ventas');
  assert.deepEqual(resultado.filtrosAplicados, { mes: '2026-11', estadoOperacion: 'ANULADA' });
  assert.deepEqual(resultado.ui, { vista: 'ESTADISTICAS', uiGranularidad: 'MES' });
  assert.equal(leerConsultaReporte(url, 'ventas').estado, 'invalida');
  assert.ok(!serializarConsultaReporte(resultado.filtros, 'ventas').includes('vista'));
  for (const extra of ['&extra=x', '&vista=ESTADISTICAS', '&granularidad=MES', '&uiGranularidad=ANIO']) {
    assert.equal(leerConsultaReporteAmpliada(url + extra, 'ventas').estado, 'invalida');
  }
  for (const query of ['vista=ESTADISTICAS', 'vista=CONSULTA&uiGranularidad=MES', 'vista=', 'uiGranularidad=dia']) {
    assert.equal(leerConsultaReporteAmpliada(query, 'ventas').estado, 'invalida');
  }
  assert.equal(leerConsultaReporteAmpliada('', 'ventas').estado, 'sinPeriodo');
});
