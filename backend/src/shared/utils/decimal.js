// Límite del coeficiente entero de DECIMAL(14,6) y DECIMAL(14,2).
// Los cálculos intermedios pueden superarlo; el consumidor valida al persistir.
export const MAXIMO_COEFICIENTE_DECIMAL_14 = 99999999999999n;

const validarEscala = (escala) => {
    if (!Number.isInteger(escala) || escala < 0 || escala > 6) {
        throw new RangeError('La escala debe ser un entero entre cero y seis');
    }
};

const validarEnteroNoNegativo = (valor) => {
    if (typeof valor !== 'bigint') throw new TypeError('El valor debe ser BigInt');
    if (valor < 0n) throw new RangeError('El valor no puede ser negativo');
};

export const decimalAEntero = (valor, escala) => {
    validarEscala(escala);
    if (typeof valor !== 'string') throw new TypeError('El decimal debe ser una cadena');
    if (valor !== valor.trim() || !/^\d+(?:\.\d+)?$/.test(valor)) {
        throw new RangeError('Formato decimal no válido');
    }

    const [entero, fraccion = ''] = valor.split('.');
    if (fraccion.length > escala) throw new RangeError('El decimal excede la escala permitida');
    return BigInt(entero) * 10n ** BigInt(escala) + BigInt(fraccion.padEnd(escala, '0') || '0');
};

export const enteroADecimal = (valor, escala) => {
    validarEscala(escala);
    validarEnteroNoNegativo(valor);
    if (escala === 0) return valor.toString();

    const divisor = 10n ** BigInt(escala);
    return `${valor / divisor}.${String(valor % divisor).padStart(escala, '0')}`;
};

// División de enteros no negativos: al más cercano, empate hacia arriba.
// Sirve tanto para promedios como para pasar de millonésimas a centavos.
export const dividirYRedondear = (numerador, denominador) => {
    validarEnteroNoNegativo(numerador);
    validarEnteroNoNegativo(denominador);
    if (denominador === 0n) throw new RangeError('El denominador debe ser positivo');

    const cociente = numerador / denominador;
    const resto = numerador % denominador;
    return cociente + (resto * 2n >= denominador ? 1n : 0n);
};
