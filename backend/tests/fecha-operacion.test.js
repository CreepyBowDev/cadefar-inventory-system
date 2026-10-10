import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { obtenerFechaOperacion } from '../src/shared/utils/fecha-operacion.js';

test('Operación: fecha y hora civil cambian juntas a medianoche de America/La_Paz', () => {
    for (const [utc, fechaComercial, fechaHoraComercial] of [
        ['2026-11-01T03:59:59.999Z', '2026-10-31', '2026-10-31 23:59:59'],
        ['2026-11-01T04:00:00.000Z', '2026-11-01', '2026-11-01 00:00:00'],
        ['2026-11-01T04:15:00.000Z', '2026-11-01', '2026-11-01 00:15:00']
    ]) assert.deepEqual(obtenerFechaOperacion(new Date(utc)), {
        fechaComercial, fechaHoraComercial, zonaHoraria: 'America/La_Paz'
    });
});

test('Operación: conserva calendario bisiesto y cambios de año', () => {
    for (const [utc, esperado] of [
        ['2028-03-01T03:59:59Z', '2028-02-29 23:59:59'],
        ['2027-01-01T03:00:00Z', '2026-12-31 23:00:00'],
        ['2027-01-01T04:00:00Z', '2027-01-01 00:00:00']
    ]) assert.equal(obtenerFechaOperacion(new Date(utc)).fechaHoraComercial, esperado);
});

test('Operación: devuelve texto a segundos sin Z y no modifica el instante', () => {
    const instante = new Date('2026-10-10T21:19:43.987Z');
    const before = instante.getTime();
    const resultado = obtenerFechaOperacion(instante);
    assert.equal(resultado.fechaHoraComercial, '2026-10-10 17:19:43');
    assert.equal(resultado.fechaComercial, '2026-10-10');
    assert.equal(instante.getTime(), before);
    assert.equal(Object.values(resultado).some((valor) => valor instanceof Date), false);
    assert.equal(resultado.fechaHoraComercial.endsWith('Z'), false);
});

test('Operación: exige un instante válido y fecha civil dentro del rango MySQL', () => {
    for (const instante of ['2026-11-01T04:15:00Z', 0, null, {}]) {
        assert.throws(() => obtenerFechaOperacion(instante), TypeError);
    }
    assert.throws(() => obtenerFechaOperacion(new Date('invalid')), RangeError);
    assert.throws(() => obtenerFechaOperacion(new Date('0999-01-01T12:00:00Z')), RangeError);
    assert.throws(() => obtenerFechaOperacion(new Date('+010000-01-01T12:00:00Z')), RangeError);
    assert.equal(obtenerFechaOperacion(new Date('1000-01-01T12:00:00Z')).fechaComercial, '1000-01-01');
    assert.equal(obtenerFechaOperacion(new Date('9999-12-31T12:00:00Z')).fechaComercial, '9999-12-31');
});

test('Operación: el resultado no depende de la zona horaria del proceso', () => {
    const moduleURL = new URL('../src/shared/utils/fecha-operacion.js', import.meta.url).href;
    const codigo = `import { obtenerFechaOperacion } from ${JSON.stringify(moduleURL)};
        console.log(JSON.stringify(obtenerFechaOperacion(new Date('2026-11-01T04:15:00Z'))));`;
    for (const TZ of ['UTC', 'Asia/Tokyo', 'America/New_York']) {
        const child = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], {
            env: { ...process.env, TZ }, encoding: 'utf8', timeout: 10000
        });
        assert.equal(child.status, 0, child.stderr || String(child.error));
        assert.deepEqual(JSON.parse(child.stdout), {
            fechaComercial: '2026-11-01', fechaHoraComercial: '2026-11-01 00:15:00',
            zonaHoraria: 'America/La_Paz'
        });
    }
});
