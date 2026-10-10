import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularVencimiento, esFechaCivilValida, obtenerFechaComercial,
    obtenerFechaEfectivaVencimiento, obtenerFechaEtiquetaNormalizada,
    sumarMesesCalendario, ZONA_HORARIA_COMERCIAL } from '../src/shared/utils/vencimiento.js';

test('Día comercial: el cambio de fecha ocurre a las 04:00 UTC en La Paz', () => {
    assert.equal(ZONA_HORARIA_COMERCIAL, 'America/La_Paz');
    assert.equal(obtenerFechaComercial(new Date('2026-11-01T03:59:59.999Z')), '2026-10-31');
    assert.equal(obtenerFechaComercial(new Date('2026-11-01T04:00:00.000Z')), '2026-11-01');
    assert.equal(obtenerFechaComercial(new Date('2027-01-01T03:00:00.000Z')), '2026-12-31');
});

test('DIA: no es vendible desde el inicio de la fecha indicada', () => {
    for (const [fechaComercial, vencida] of [['2026-10-14', false], ['2026-10-15', true], ['2026-10-16', true]]) {
        assert.deepEqual(calcularVencimiento('2026-10-15', 'DIA', fechaComercial), {
            fechaEfectivaVencimiento: '2026-10-15', vencida
        });
    }
});

test('MES: conserva todo el último día; el corte es el primer día del mes siguiente', () => {
    for (const [fechaComercial, vencida] of [['2026-10-30', false], ['2026-10-31', false], ['2026-11-01', true]]) {
        assert.deepEqual(calcularVencimiento('2026-10-31', 'MES', fechaComercial), {
            fechaEfectivaVencimiento: '2026-11-01', vencida
        });
    }
});

test('Corte mensual: febrero bisiesto/no bisiesto, meses cortos y cambio de año', () => {
    for (const [etiqueta, corte] of [
        ['2028-02-29', '2028-03-01'], ['2027-02-28', '2027-03-01'],
        ['2026-04-30', '2026-05-01'], ['2026-12-31', '2027-01-01']
    ]) {
        assert.equal(obtenerFechaEfectivaVencimiento(etiqueta, 'MES'), corte);
        assert.equal(calcularVencimiento(etiqueta, 'MES', etiqueta).vencida, false);
        assert.equal(calcularVencimiento(etiqueta, 'MES', corte).vencida, true);
    }
});

test('FEFO mixto: DIA del último día vence antes que MES del mismo mes', () => {
    const dia = obtenerFechaEfectivaVencimiento('2026-10-31', 'DIA');
    const mes = obtenerFechaEfectivaVencimiento('2026-10-31', 'MES');
    assert.equal(dia < mes, true);
    assert.equal(mes, obtenerFechaEfectivaVencimiento('2026-11-01', 'DIA'));
});

test('Fechas civiles rechazan días inexistentes y fechas con hora o formato ambiguo', () => {
    for (const fecha of ['2028-02-29', '2026-04-30', '1000-01-01', '9999-12-31']) {
        assert.equal(esFechaCivilValida(fecha), true, fecha);
    }
    for (const fecha of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01',
        '2026-01-00', '2026-1-01', '15/10/2026', '2026-10-15T00:00:00Z', '0000-01-01', null]) {
        assert.equal(esFechaCivilValida(fecha), false, String(fecha));
    }
    assert.throws(() => obtenerFechaEfectivaVencimiento('2026-02-29', 'DIA'), RangeError);
    assert.throws(() => obtenerFechaEfectivaVencimiento('2026-10-31', 'ANIO'), RangeError);
    assert.throws(() => calcularVencimiento('2026-10-31', 'DIA', '2026-10-32'), RangeError);
});

test('Un MES histórico no canónico no se modifica al calcular su corte comercial', () => {
    const registro = { fechaVencimiento: '2026-10-01', precisionVencimiento: 'MES' };
    const before = structuredClone(registro);
    assert.deepEqual(calcularVencimiento(registro.fechaVencimiento, registro.precisionVencimiento, '2026-10-31'), {
        fechaEfectivaVencimiento: '2026-11-01', vencida: false
    });
    assert.deepEqual(registro, before);
});

test('Tres meses calendario conservan el día o ajustan al último día del mes destino', () => {
    for (const [fecha, limite] of [
        ['2026-10-31', '2027-01-31'], ['2026-01-31', '2026-04-30'],
        ['2026-11-30', '2027-02-28'], ['2027-11-30', '2028-02-29'],
        ['2028-02-29', '2028-05-29'], ['2026-12-15', '2027-03-15']
    ]) assert.equal(sumarMesesCalendario(fecha, 3), limite);
    assert.equal(sumarMesesCalendario('2026-10-31', 0), '2026-10-31');
    assert.throws(() => sumarMesesCalendario('2026-02-29', 3), RangeError);
    assert.throws(() => sumarMesesCalendario('2026-10-31', 1.5), RangeError);
});

test('Etiqueta normalizada MES usa fin de mes, no el corte comercial del mes siguiente', () => {
    for (const [fecha, etiqueta] of [
        ['2026-10-01', '2026-10-31'], ['2028-02-01', '2028-02-29'],
        ['2027-02-28', '2027-02-28'], ['2026-04-01', '2026-04-30']
    ]) assert.equal(obtenerFechaEtiquetaNormalizada(fecha, 'MES'), etiqueta);
    assert.equal(obtenerFechaEtiquetaNormalizada('2026-10-15', 'DIA'), '2026-10-15');
    assert.throws(() => obtenerFechaEtiquetaNormalizada('2026-02-29', 'MES'), RangeError);
    assert.throws(() => obtenerFechaEtiquetaNormalizada('2026-10-31', 'ANIO'), RangeError);
});
