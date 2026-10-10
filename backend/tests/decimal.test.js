import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalAEntero, enteroADecimal, dividirYRedondear,
    MAXIMO_COEFICIENTE_DECIMAL_14 } from '../src/shared/utils/decimal.js';

test('Decimales: convierte y normaliza sin redondear ni pasar por Number', () => {
    for (const [valor, entero, normalizado] of [
        ['0', 0n, '0.000000'], ['0.000001', 1n, '0.000001'],
        ['0.7', 700000n, '0.700000'], ['0001.050', 1050000n, '1.050000'],
        ['99999999.999999', MAXIMO_COEFICIENTE_DECIMAL_14, '99999999.999999']
    ]) {
        assert.equal(decimalAEntero(valor, 6), entero);
        assert.equal(enteroADecimal(entero, 6), normalizado);
    }
    assert.equal(decimalAEntero('999999999999.99', 2), MAXIMO_COEFICIENTE_DECIMAL_14);
    assert.equal(enteroADecimal(MAXIMO_COEFICIENTE_DECIMAL_14, 2), '999999999999.99');
    assert.equal(decimalAEntero('12', 0), 12n);
    assert.equal(enteroADecimal(12n, 0), '12');
});

test('Decimales: rechaza formatos ambiguos, signos, espacios y precisión adicional', () => {
    for (const valor of ['', ' ', ' 1', '1 ', '1\n', '1\r\n', '1\t', '+1', '-1', '-0',
        '.7', '1.', '0,7', '1e2', '0x10', 'NaN', 'Infinity', '0.7000000', '0.0000001']) {
        assert.throws(() => decimalAEntero(valor, 6), RangeError, valor);
    }
    for (const valor of [0.7, 1n, null, undefined, true]) {
        assert.throws(() => decimalAEntero(valor, 6), TypeError);
    }
    assert.throws(() => decimalAEntero('0.001', 2), RangeError);
    assert.throws(() => decimalAEntero('1.0', 0), RangeError);
});

test('Decimales: rechaza escalas y coeficientes inválidos', () => {
    for (const escala of [-1, 7, 1.5, '6', NaN, undefined]) {
        assert.throws(() => decimalAEntero('1', escala), RangeError);
        assert.throws(() => enteroADecimal(1n, escala), RangeError);
    }
    assert.throws(() => enteroADecimal(-1n, 6), RangeError);
    assert.throws(() => enteroADecimal(1, 6), TypeError);
});

test('División: redondea al más cercano y los empates hacia arriba', () => {
    for (const [numerador, denominador, resultado] of [
        [0n, 2n, 0n], [1n, 3n, 0n], [2n, 3n, 1n], [1n, 2n, 1n],
        [3n, 2n, 2n], [4n, 2n, 2n], [4999n, 10000n, 0n],
        [5000n, 10000n, 1n], [9999n, 10000n, 1n], [15000n, 10000n, 2n]
    ]) assert.equal(dividirYRedondear(numerador, denominador), resultado);
    assert.throws(() => dividirYRedondear(1n, 0n), RangeError);
    assert.throws(() => dividirYRedondear(-1n, 2n), RangeError);
    assert.throws(() => dividirYRedondear(1n, -2n), RangeError);
    assert.throws(() => dividirYRedondear(1, 2n), TypeError);
    assert.throws(() => dividirYRedondear(1n, 2), TypeError);
});

test('Importes: subtotales pequeños y total como suma de centavos redondeados', () => {
    const centavosMinimos = dividirYRedondear(decimalAEntero('0.000001', 6), 10000n);
    assert.equal(enteroADecimal(centavosMinimos, 2), '0.00');
    const linea = dividirYRedondear(decimalAEntero('0.005000', 6), 10000n);
    assert.equal(enteroADecimal(linea, 2), '0.01');
    assert.equal(enteroADecimal(linea + linea + linea, 2), '0.03');
    assert.equal(enteroADecimal(dividirYRedondear(15000n, 10000n), 2), '0.02');
});

test('Promedios: las primitivas soportan las fórmulas aprobadas y saldo inicial cero', () => {
    const costo = (valor) => decimalAEntero(valor, 6);
    assert.equal(enteroADecimal(dividirYRedondear(
        100n * costo('0.5') + 100n * costo('0.7'), 200n), 6), '0.600000');
    assert.equal(enteroADecimal(dividirYRedondear(
        0n * costo('5') + 20n * costo('8'), 20n), 6), '8.000000');
    const lineas = [[100n, costo('0.7')], [50n, costo('0.9')]];
    for (const orden of [lineas, [...lineas].reverse()]) {
        const valor = 100n * costo('0.5') + orden.reduce((suma, [q, p]) => suma + q * p, 0n);
        const saldo = 100n + orden.reduce((suma, [q]) => suma + q, 0n);
        assert.equal(enteroADecimal(dividirYRedondear(valor, saldo), 6), '0.660000');
    }
});

test('Precisión: conserva productos por encima del rango entero seguro de Number', () => {
    const valor = 2147483647n * decimalAEntero('99999999.999999', 6);
    assert.equal(enteroADecimal(valor, 6), '214748364699997852.516353');
    assert.ok(valor > BigInt(Number.MAX_SAFE_INTEGER));
    assert.ok(dividirYRedondear(valor, 10000n) > MAXIMO_COEFICIENTE_DECIMAL_14);
    assert.equal(dividirYRedondear(valor, 2147483647n), MAXIMO_COEFICIENTE_DECIMAL_14);
});

test('Diseño de valoración: mantiene el residuo de redondeo y detecta numeradores negativos', () => {
    const promedio = dividirYRedondear(5000000n, 3n);
    assert.equal(enteroADecimal(promedio, 6), '1.666667');
    assert.equal(3n * promedio - 5000000n, 1n);
    const residual = 150n * decimalAEntero('0.6', 6) - 100n * decimalAEntero('0.7', 6);
    assert.equal(enteroADecimal(dividirYRedondear(residual, 50n), 6), '0.400000');
    const negativo = 15n * decimalAEntero('11', 6) - 10n * decimalAEntero('20', 6);
    assert.equal(negativo, -35000000n);
    assert.throws(() => dividirYRedondear(negativo, 5n), RangeError);
});
