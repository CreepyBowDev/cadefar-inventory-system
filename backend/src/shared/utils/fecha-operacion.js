import { esFechaCivilValida, obtenerFechaComercial,
    ZONA_HORARIA_COMERCIAL } from './vencimiento.js';

const formatoHora = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_HORARIA_COMERCIAL,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

// Un solo instante para el día de validación y las horas de compra/movimientos.
// Devuelve texto civil: no representa una cadena UTC y no debe agregarse Z.
export const obtenerFechaOperacion = (instante = new Date()) => {
    if (!(instante instanceof Date)) throw new TypeError('El instante debe ser Date');
    const fechaComercial = obtenerFechaComercial(instante);
    if (!esFechaCivilValida(fechaComercial)) {
        throw new RangeError('La fecha comercial está fuera del rango de MySQL');
    }
    const partes = Object.fromEntries(formatoHora.formatToParts(instante)
        .map(({ type, value }) => [type, value]));
    return {
        fechaComercial,
        fechaHoraComercial: `${fechaComercial} ${partes.hour}:${partes.minute}:${partes.second}`,
        zonaHoraria: ZONA_HORARIA_COMERCIAL
    };
};
