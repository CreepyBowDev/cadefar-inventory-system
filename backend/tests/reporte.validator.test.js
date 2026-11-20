import test from 'node:test';
import assert from 'node:assert/strict';
import { reporteValidator } from '../src/business/validators/reporte.validator.js';

const validadores = [
    ['ventas', reporteValidator.validateVentas],
    ['compras', reporteValidator.validateCompras],
    ['perdidas', reporteValidator.validatePerdidas]
];

for (const [reporte, validar] of validadores) {
    test(`Reportes ${reporte}: día normalizado, sin filtros implícitos ni mutación de entrada`, () => {
        const query = Object.freeze({ dia: '2026-11-19' });
        const resultado = validar(query);
        assert.equal(resultado.success, true);
        assert.deepEqual(resultado.data, {
            periodo: { modalidad: 'DIA', desde: '2026-11-19', hasta: '2026-11-19', zonaHoraria: 'America/La_Paz' },
            desdeFechaHora: '2026-11-19 00:00:00',
            hastaFechaHora: '2026-11-19 23:59:59.999999',
            pagina: 1, limite: 25
        });
        assert.deepEqual(query, { dia: '2026-11-19' });
    });

    test(`Reportes ${reporte}: meses completos, bisiestos gregorianos y años extremos`, () => {
        const meses = [
            ['1000-01', '31'], ['1000-02', '28'], ['1900-02', '28'], ['2000-02', '29'],
            ['2026-02', '28'], ['2028-02', '29'], ['2100-02', '28'], ['2400-02', '29'],
            ['2026-04', '30'], ['2026-06', '30'], ['2026-09', '30'], ['2026-11', '30'],
            ['2026-03', '31'], ['2026-05', '31'], ['2026-07', '31'], ['2026-08', '31'],
            ['2026-10', '31'], ['9999-12', '31']
        ];
        for (const [mes, ultimoDia] of meses) {
            const resultado = validar({ mes });
            assert.equal(resultado.success, true, mes);
            assert.deepEqual(resultado.data.periodo, { modalidad: 'MES', desde: `${mes}-01`,
                hasta: `${mes}-${ultimoDia}`, zonaHoraria: 'America/La_Paz' });
            assert.equal(resultado.data.desdeFechaHora, `${mes}-01 00:00:00`);
            assert.equal(resultado.data.hastaFechaHora, `${mes}-${ultimoDia} 23:59:59.999999`);
        }
    });

    test(`Reportes ${reporte}: rangos inclusivos sin máximo, futuros y día único`, () => {
        for (const [desde, hasta] of [
            ['1000-01-01', '9999-12-31'], ['9999-12-31', '9999-12-31'],
            ['2000-02-29', '2028-02-29'], ['2099-01-01', '2100-03-01']
        ]) {
            const resultado = validar({ desde, hasta });
            assert.equal(resultado.success, true);
            assert.deepEqual(resultado.data.periodo, { modalidad: 'PERIODO', desde, hasta, zonaHoraria: 'America/La_Paz' });
            assert.equal(resultado.data.desdeFechaHora, `${desde} 00:00:00`);
            assert.equal(resultado.data.hastaFechaHora, `${hasta} 23:59:59.999999`);
        }
        for (const dia of ['1000-01-01', '9999-12-31', '2000-02-29', '2028-02-29']) {
            assert.equal(validar({ dia }).success, true, dia);
        }
    });

    test(`Reportes ${reporte}: período obligatorio, excluyente y cerrado`, () => {
        for (const query of [
            {}, { pagina: '1', limite: '25' }, { desde: '2026-01-01' }, { hasta: '2026-01-01' },
            { dia: '2026-01-01', mes: '2026-01' },
            ...['dia', 'mes'].flatMap(campo => [
                { [campo]: campo === 'dia' ? '2026-01-01' : '2026-01', desde: '2026-01-01' },
                { [campo]: campo === 'dia' ? '2026-01-01' : '2026-01', hasta: '2026-01-31' },
                { [campo]: campo === 'dia' ? '2026-01-01' : '2026-01', desde: '2026-01-01', hasta: '2026-01-31' }
            ]),
            { dia: '2026-01-01', mes: '2026-01', desde: '2026-01-01', hasta: '2026-01-31' },
            { desde: '2026-02-01', hasta: '2026-01-31' }
        ]) {
            const resultado = validar(query);
            assert.equal(resultado.success, false, JSON.stringify(query));
            assert.ok(resultado.error.issues.length > 0);
        }
    });

    test(`Reportes ${reporte}: fechas reales y formato exacto sin recortes`, () => {
        for (const fecha of ['0999-12-31', '0000-01-01', '10000-01-01', '1900-02-29', '2100-02-29',
            '2026-02-29', '2026-02-30', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00',
            '2026-01-32', '2026-1-01', '2026-01-1', '26-01-01', '2026/01/01',
            ' 2026-01-01', '2026-01-01 ', '2026-01-01\n', '2026-01-01T00:00:00Z']) {
            for (const query of [{ dia: fecha }, { desde: fecha, hasta: '9999-12-31' },
                { desde: '1000-01-01', hasta: fecha }]) {
                assert.equal(validar(query).success, false, JSON.stringify(query));
            }
        }
        for (const mes of ['0999-12', '10000-01', '2026-00', '2026-13', '2026-1',
            '2026-01-01', ' 2026-01', '2026-01 ', '2026-01\n', '2026/01']) {
            assert.equal(validar({ mes }).success, false, mes);
        }
    });

    test(`Reportes ${reporte}: rechaza vacíos, repetidos, estructurados y tipos no HTTP`, () => {
        const campos = { dia: '2026-01-01', mes: '2026-01', desde: '2026-01-01', hasta: '2026-01-31',
            pagina: '1', limite: '25', [reporte === 'perdidas' ? 'motivo' : 'estadoOperacion']:
                reporte === 'perdidas' ? 'DAÑO' : 'CONFIRMADA' };
        for (const [campo, valor] of Object.entries(campos)) {
            const base = campo === 'dia' || campo === 'mes' ? { [campo]: valor } :
                campo === 'desde' || campo === 'hasta' ? { desde: '2026-01-01', hasta: '2026-01-31' } :
                    { dia: '2026-01-01', [campo]: valor };
            assert.equal(validar(base).success, true);
            for (const invalido of ['', ' ', [], [valor], [valor, valor], [valor, 'otro'],
                {}, { valor }, null, 1, true]) {
                assert.equal(validar({ ...base, [campo]: invalido }).success, false,
                    `${campo}: ${JSON.stringify(invalido)}`);
            }
        }
        for (const query of [undefined, null, [], 'dia=2026-01-01', 1]) {
            assert.equal(validar(query).success, false);
        }
    });

    test(`Reportes ${reporte}: query estricta, sin filtros operativos adicionales`, () => {
        for (const campo of ['desconocido', 'tipoPeriodo', 'campoFecha', 'idMedicamento', 'idExistencia',
            'idProveedorLaboratorio', 'idUsuario', 'claveOperacion', 'fechaAnulacion', 'orden',
            'dia[]', 'dia[valor]']) {
            assert.equal(validar({ dia: '2026-01-01', [campo]: 'valor' }).success, false, campo);
        }
    });

    test(`Reportes ${reporte}: paginación decimal positiva, defaults y límites`, () => {
        for (const [pagina, limite] of [['1', '1'], ['2', '26'], ['2147483647', '100']]) {
            const resultado = validar({ dia: '2026-01-01', pagina, limite });
            assert.equal(resultado.success, true);
            assert.equal(resultado.data.pagina, Number(pagina));
            assert.equal(resultado.data.limite, Number(limite));
        }
        assert.equal(validar({ dia: '2026-01-01', pagina: '2' }).data.limite, 25);
        assert.equal(validar({ dia: '2026-01-01', limite: '26' }).data.pagina, 1);
        for (const campo of ['pagina', 'limite']) {
            for (const valor of ['0', '-1', '+1', '01', '1.0', '1.5', '1e2', '0x10', ' 1', '1 ',
                '1\n', 'NaN', 'Infinity', '9'.repeat(400), campo === 'pagina' ? '2147483648' : '101']) {
                assert.equal(validar({ dia: '2026-01-01', [campo]: valor }).success, false, `${campo}: ${valor}`);
            }
        }
    });
}

test('Reportes: enums específicos sin equivalencias ni filtros cruzados', () => {
    for (const [reporte, validar] of validadores) {
        const campo = reporte === 'perdidas' ? 'motivo' : 'estadoOperacion';
        const valores = reporte === 'ventas' ? ['CONFIRMADA', 'PENDIENTE', 'ANULADA'] :
            reporte === 'compras' ? ['CONFIRMADA', 'ANULADA'] : ['VENCIMIENTO', 'DAÑO'];
        for (const valor of valores) {
            const resultado = validar({ dia: '2026-01-01', [campo]: valor });
            assert.equal(resultado.success, true);
            assert.equal(resultado.data[campo], valor);
        }
        for (const valor of ['TODAS', 'confirmada', 'anulada', 'ANULADA_CONFIRMADA', 'ANULADA_SIN_CONFIRMAR',
            'DANO', 'DA%C3%91O', 'daño', 'Vencimiento', 'AJUSTE', ' CONFIRMADA', 'DAÑO ',
            ...(reporte === 'compras' ? ['PENDIENTE'] : [])]) {
            assert.equal(validar({ dia: '2026-01-01', [campo]: valor }).success, false, `${reporte}: ${valor}`);
        }
        const prohibido = reporte === 'perdidas' ? { estadoOperacion: 'CONFIRMADA' } : { motivo: 'DAÑO' };
        assert.equal(validar({ dia: '2026-01-01', ...prohibido }).success, false);
    }
});
