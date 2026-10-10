export const ZONA_HORARIA_COMERCIAL = 'America/La_Paz';

const formatoComercial = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_COMERCIAL,
    year: 'numeric', month: '2-digit', day: '2-digit'
});

export const obtenerFechaComercial = (instante = new Date()) => {
    const partes = Object.fromEntries(formatoComercial.formatToParts(instante)
        .map(({ type, value }) => [type, value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
};

export const esFechaCivilValida = (fecha) => {
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
    const [anio, mes, dia] = fecha.split('-').map(Number);
    if (anio < 1000 || mes < 1 || mes > 12 || dia < 1) return false;
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return dia <= diasDelMes;
};

export const sumarMesesCalendario = (fecha, meses) => {
    if (!esFechaCivilValida(fecha) || !Number.isInteger(meses) || meses < 0) {
        throw new RangeError('Fecha o cantidad de meses inválida');
    }
    const [anio, mes, dia] = fecha.split('-').map(Number);
    // UTC se utiliza solo para aritmética civil, no para convertir históricos.
    const destino = new Date(Date.UTC(anio, mes - 1 + meses, 1));
    const anioDestino = destino.getUTCFullYear();
    const mesDestino = destino.getUTCMonth() + 1;
    const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino, 0)).getUTCDate();
    return `${anioDestino}-${String(mesDestino).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
};

export const obtenerFechaEtiquetaNormalizada = (fechaVencimiento, precisionVencimiento) => {
    if (!esFechaCivilValida(fechaVencimiento)) throw new RangeError('Fecha de vencimiento inválida');
    if (precisionVencimiento === 'DIA') return fechaVencimiento;
    if (precisionVencimiento !== 'MES') throw new RangeError('Precisión de vencimiento inválida');
    const [anio, mes] = fechaVencimiento.split('-').map(Number);
    const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    // Información calculada para el intervalo de alerta; no reemplaza el DATE guardado.
    return `${fechaVencimiento.slice(0, 8)}${String(ultimoDia).padStart(2, '0')}`;
};

export const obtenerFechaEfectivaVencimiento = (fechaVencimiento, precisionVencimiento) => {
    if (!esFechaCivilValida(fechaVencimiento)) throw new RangeError('Fecha de vencimiento inválida');
    if (precisionVencimiento === 'DIA') return fechaVencimiento;
    if (precisionVencimiento !== 'MES') throw new RangeError('Precisión de vencimiento inválida');

    // Calcular el corte mensual sin modificar la fecha guardada, incluso si un
    // registro histórico no utiliza el último día del mes. Su corrección es aparte.
    const [anio, mes] = fechaVencimiento.split('-').map(Number);
    return `${mes === 12 ? anio + 1 : anio}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01`;
};

export const calcularVencimiento = (fechaVencimiento, precisionVencimiento, fechaComercial) => {
    if (!esFechaCivilValida(fechaComercial)) throw new RangeError('Fecha comercial inválida');
    const fechaEfectivaVencimiento = obtenerFechaEfectivaVencimiento(fechaVencimiento, precisionVencimiento);
    // Comparar fechas civiles, sin interpretar DATEONLY como un instante local.
    const numeroFecha = (fecha) => Number(fecha.replaceAll('-', ''));
    return {
        fechaEfectivaVencimiento,
        vencida: numeroFecha(fechaComercial) >= numeroFecha(fechaEfectivaVencimiento)
    };
};
