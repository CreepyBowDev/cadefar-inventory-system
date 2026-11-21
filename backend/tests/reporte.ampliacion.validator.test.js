import test from 'node:test';
import assert from 'node:assert/strict';
import { reporteValidator as v, contarIntervalosEstadisticos } from '../src/business/validators/reporte.validator.js';
import { inventarioValidator } from '../src/business/validators/inventario.validator.js';

const fuentes = [
    ['ventas', v.validateVentas, v.validateEstadisticasVentas, v.validateExportacionVentas,
        { estadoOperacion: 'ANULADA' }, ['CANTIDAD', 'IMPORTE']],
    ['compras', v.validateCompras, v.validateEstadisticasCompras, v.validateExportacionCompras,
        { estadoOperacion: 'CONFIRMADA' }, ['CANTIDAD', 'IMPORTE']],
    ['perdidas', v.validatePerdidas, v.validateEstadisticasPerdidas, v.validateExportacionPerdidas,
        { motivo: 'DAÑO' }, ['CANTIDAD_RETIROS', 'PERDIDA']]
];
const base = { desde: '2026-11-15', hasta: '2026-12-05' };
const invalido = (validar, query) => assert.equal(validar(query).success, false, JSON.stringify(query));

for (const [fuente, ordinario, estadisticas, exportar, filtro, metricas] of fuentes) {
    test(`Fase 2 ${fuente}: modalidades compartidas, sin paginación ni defaults nuevos`, () => {
        for (const periodo of [{ dia: '9999-12-31' }, { mes: '2000-02' }, base]) {
            for (const granularidad of ['DIA', 'MES', 'ANIO']) {
                const query = Object.freeze({ ...periodo, ...filtro, granularidad });
                const resultado = estadisticas(query);
                assert.equal(resultado.success, true);
                const { pagina, limite, ...anterior } = ordinario({ ...periodo, ...filtro }).data;
                assert.deepEqual(resultado.data, { ...anterior, granularidad });
                assert.equal('pagina' in resultado.data, false);
                assert.equal('limite' in resultado.data, false);
            }
        }
        for (const query of [{}, { ...base }, { dia: '2026-02-29', granularidad: 'DIA' },
            { ...base, mes: '2026-11', granularidad: 'MES' }, { desde: base.desde, granularidad: 'DIA' },
            { desde: base.hasta, hasta: base.desde, granularidad: 'DIA' }]) invalido(estadisticas, query);
    });

    test(`Fase 2 ${fuente}: matriz completa formato/presentación/gráfico/métrica`, () => {
        for (const formato of ['CSV', 'PDF', 'XLSX']) {
            const tabular = { ...base, ...filtro, formato, presentacion: 'TABULAR' };
            assert.equal(exportar(tabular).success, true);
            assert.equal('pagina' in exportar(tabular).data, false);
            for (const campo of ['granularidad', 'grafico', 'metrica']) {
                invalido(exportar, { ...tabular, [campo]: { granularidad: 'DIA', grafico: 'BARRAS', metrica: metricas[0] }[campo] });
            }
            for (const granularidad of ['DIA', 'MES', 'ANIO']) {
                const estadistica = { ...tabular, presentacion: 'ESTADISTICA', granularidad };
                if (formato === 'CSV') {
                    assert.equal(exportar(estadistica).success, true);
                    invalido(exportar, { ...estadistica, grafico: 'BARRAS' });
                    invalido(exportar, { ...estadistica, metrica: metricas[0] });
                } else {
                    invalido(exportar, estadistica);
                    for (const grafico of ['BARRAS', 'LINEAS', 'SECTORES']) {
                        for (const metrica of metricas) {
                            const query = { ...estadistica, grafico, metrica };
                            assert.equal(exportar(query).success, true, JSON.stringify(query));
                            invalido(exportar, { ...query, metrica: 'CANTIDAD_RETIRADA' });
                            invalido(exportar, { ...query, metrica: fuente === 'perdidas' ? 'IMPORTE' : 'PERDIDA' });
                        }
                    }
                    invalido(exportar, { ...estadistica, grafico: 'BARRAS' });
                    invalido(exportar, { ...estadistica, metrica: metricas[0] });
                }
            }
        }
        for (const query of [{ ...base }, { ...base, formato: 'PDF' }, { ...base, presentacion: 'TABULAR' }]) {
            invalido(exportar, query);
        }
    });

    test(`Fase 2 ${fuente}: allowlists, repetidos, desconocidos y exportación completa`, () => {
        const casos = [
            [estadisticas, { ...base, ...filtro, granularidad: 'DIA' }],
            [exportar, { ...base, ...filtro, formato: 'CSV', presentacion: 'TABULAR' }],
            [exportar, { ...base, ...filtro, formato: 'XLSX', presentacion: 'ESTADISTICA',
                granularidad: 'MES', grafico: 'LINEAS', metrica: metricas[0] }]
        ];
        for (const [validar, query] of casos) {
            for (const entrada of [undefined, null, [], 'query', 1]) invalido(validar, entrada);
            for (const [campo, valor] of Object.entries(query)) {
                for (const otro of ['', ' ', null, 1, true, {}, [valor], [valor, valor],
                    'DESCONOCIDO', valor.toLowerCase(), `${valor} `, `${valor}\n`]) {
                    // Fechas y enums de filtro pueden no cambiar con toLowerCase.
                    if (otro === valor) continue;
                    invalido(validar, { ...query, [campo]: otro });
                }
            }
            for (const campo of ['pagina', 'limite', 'desconocido', 'porcentaje', 'periodoAnterior',
                'promedio', 'ruta', 'titulo', 'granularidad[]']) {
                invalido(validar, { ...query, [campo]: '1' });
            }
        }
        for (const [campo, valor] of Object.entries({ formato: 'CSV', presentacion: 'TABULAR',
            granularidad: 'DIA', grafico: 'BARRAS', metrica: metricas[0] })) {
            invalido(ordinario, { dia: '2026-11-20', [campo]: valor });
        }
        invalido(estadisticas, { ...base, granularidad: 'dia' });
        invalido(exportar, { ...base, formato: 'csv', presentacion: 'TABULAR' });
        invalido(exportar, { ...base, formato: 'CSV', presentacion: 'tabular' });
    });

    test(`Fase 2 ${fuente}: 1200 intervalos exactos; límite solo estadístico`, () => {
        for (const [granularidad, desde, hasta, exceso] of [
            ['DIA', '2000-01-01', '2003-04-14', '2003-04-15'],
            ['MES', '1000-01-31', '1099-12-01', '1100-01-01'],
            ['ANIO', '1000-12-31', '2199-01-01', '2200-01-01']
        ]) {
            assert.equal(contarIntervalosEstadisticos({ desde, hasta }, granularidad), 1200);
            assert.equal(estadisticas({ desde, hasta, granularidad }).success, true);
            const resultado = estadisticas({ desde, hasta: exceso, granularidad });
            assert.equal(resultado.success, false);
            assert.equal(resultado.error.issues[0].params.limiteIntervalos, true);
            assert.equal(resultado.error.issues[0].message,
                'La consulta supera 1200 intervalos; elija otra granularidad o un período menor');
            for (const formato of ['CSV', 'PDF', 'XLSX']) {
                const extra = formato === 'CSV' ? {} : { grafico: 'BARRAS', metrica: metricas[0] };
                assert.equal(exportar({ desde, hasta, granularidad, formato, presentacion: 'ESTADISTICA', ...extra }).success, true);
                const rechazado = exportar({ desde, hasta: exceso, granularidad, formato,
                    presentacion: 'ESTADISTICA', ...extra });
                assert.equal(rechazado.success, false);
                assert.equal(rechazado.error.issues[0].params.limiteIntervalos, true);
                assert.equal(exportar({ desde: '1000-01-01', hasta: '9999-12-31',
                    formato, presentacion: 'TABULAR' }).success, true);
            }
        }
        invalido(estadisticas, { desde: '1000-01-01', hasta: '9999-12-31', granularidad: 'ANIO' });
    });
}

test('Fase 2: conteo civil parcial, bisiestos y extremos sin listas ni año 10000', () => {
    for (const [desde, hasta, granularidad, cantidad] of [
        ['2026-11-15', '2026-12-05', 'MES', 2], ['2026-12-31', '2027-01-01', 'ANIO', 2],
        ['2000-02-28', '2000-03-01', 'DIA', 3], ['1900-02-28', '1900-03-01', 'DIA', 2],
        ['9999-12-31', '9999-12-31', 'DIA', 1], ['1000-01-01', '1000-01-01', 'ANIO', 1],
        ['1000-01-01', '9999-12-31', 'ANIO', 9000]
    ]) assert.equal(contarIntervalosEstadisticos({ desde, hasta }, granularidad), cantidad);
    for (const periodo of [{ desde: '0999-12-31', hasta: '1000-01-01' },
        { desde: '9999-12-31', hasta: '10000-01-01' }, { desde: '2026-02-29', hasta: '2026-03-01' },
        { desde: '2026-01-02', hasta: '2026-01-01' }]) {
        assert.throws(() => contarIntervalosEstadisticos(periodo, 'DIA'), RangeError);
    }
    assert.throws(() => contarIntervalosEstadisticos(base, 'HORA'), RangeError);
});

test('Fase 2 CU40: reutiliza filtros abiertos exactamente, sin cambiar GET ni admitir observaciones', () => {
    const opciones = { formato: 'CSV', presentacion: 'TABULAR' };
    for (const filtro of [{}, { desde: '1000-01-01' }, { hasta: '9999-12-31' },
        { idMedicamento: '1', idExistencia: '2147483647', direccion: 'ENTRADA', motivo: '  Ajuste libre  ' },
        { desde: '2000-02-29', hasta: '9999-12-31', direccion: 'SALIDA', motivo: 'DAÑO' }]) {
        for (const formato of ['PDF', 'XLSX', 'CSV']) {
            const resultado = v.validateExportacionMovimientos({ ...filtro, ...opciones, formato });
            assert.equal(resultado.success, true);
            assert.deepEqual(resultado.data, { ...inventarioValidator.validateFiltrosMovimientos(filtro).data,
                ...opciones, formato });
        }
        assert.equal(inventarioValidator.validateFiltrosMovimientos(filtro).success, true);
    }
    for (const filtro of [{ idMedicamento: '01' }, { idExistencia: '2147483648' }, { idExistencia: 1 },
        { direccion: 'salida' }, { motivo: '' }, { motivo: ' ' }, { motivo: 'x'.repeat(41) },
        { motivo: ['DAÑO', 'DAÑO'] }, { desde: '2026-02-29' }, { hasta: '10000-01-01' },
        { desde: '2026-02-01', hasta: '2026-01-01' }]) {
        invalido(v.validateExportacionMovimientos, { ...filtro, ...opciones });
        invalido(inventarioValidator.validateFiltrosMovimientos, filtro);
    }
    for (const campo of ['pagina', 'limite', 'dia', 'mes', 'granularidad', 'grafico', 'metrica', 'observacion']) {
        invalido(v.validateExportacionMovimientos, { ...opciones, [campo]: '1' });
    }
    for (const campo of ['formato', 'presentacion']) {
        for (const valor of ['', null, 1, [], [opciones[campo]], [opciones[campo], opciones[campo]], {}, 'otro']) {
            invalido(v.validateExportacionMovimientos, { ...opciones, [campo]: valor });
        }
    }
    invalido(v.validateExportacionMovimientos, { formato: 'CSV', presentacion: 'ESTADISTICA' });
    invalido(v.validateExportacionMovimientos, {});
});
