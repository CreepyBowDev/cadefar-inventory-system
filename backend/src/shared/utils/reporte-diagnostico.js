// No se adjuntan datos técnicos al error HTTP/auditoría. Solo etiquetas
// internas en memoria; jamás serializar Error, SQL, parámetros o resultados.
const detalles = new WeakMap();
const registrados = new WeakSet();
const etapas = new Set(['TEMPORALES', 'APERTURA_SNAPSHOT', 'CONTROL_SQL', 'LIMITES_SQL', 'RESTAURACION_SQL',
    'EXTRACCION', 'CIERRE_SNAPSHOT', 'GENERACION', 'VERIFICACION_ARCHIVO', 'ENTREGA']);
const causas = new Set(['RESPUESTA_CONTROL_SQL_INVALIDA', 'MOTOR_NO_ADMITIDO', 'VALORES_SESION_INVALIDOS',
    'CONSULTA_CONTROL_SQL_FALLIDA', 'CONFIGURACION_LIMITES_FALLIDA', 'RESTAURACION_SESION_FALLIDA',
    'SQL_VARIABLE_NO_ADMITIDA', 'SQL_PERMISO_DENEGADO', 'SQL_SINTAXIS_RECHAZADA', 'SQL_CONEXION_PERDIDA',
    'SQL_CONSULTA_FALLIDA', 'ARCHIVO_SIN_ESPACIO', 'ARCHIVO_PERMISO_DENEGADO', 'ARCHIVO_NO_ENCONTRADO', 'FALLO_NO_CLASIFICADO']);

export const marcarDiagnosticoReporte = (error, etapa, causa) => {
    if (error && typeof error === 'object' && etapas.has(etapa) && causas.has(causa)) detalles.set(error, { etapa, causa });
    return error;
};

const causaTecnica = error => {
    const errno = error?.original?.errno;
    if (errno === 1193) return 'SQL_VARIABLE_NO_ADMITIDA';
    if ([1044, 1045, 1142, 1227].includes(errno)) return 'SQL_PERMISO_DENEGADO';
    if (errno === 1064) return 'SQL_SINTAXIS_RECHAZADA';
    if ([2006, 2013].includes(errno)) return 'SQL_CONEXION_PERDIDA';
    if (error?.original && typeof error.original === 'object') return 'SQL_CONSULTA_FALLIDA';
    if (error?.code === 'ENOSPC') return 'ARCHIVO_SIN_ESPACIO';
    if (['EACCES', 'EPERM'].includes(error?.code)) return 'ARCHIVO_PERMISO_DENEGADO';
    if (error?.code === 'ENOENT') return 'ARCHIVO_NO_ENCONTRADO';
    return null;
};

export function diagnosticarErrorReporte(error, etapa, registrar = evento => console.error(evento)) {
    if (!error || typeof error !== 'object' || registrados.has(error)) return;
    // No convertir rechazos/cancelaciones esperadas en defectos 500.
    if (error.statusCode && error.statusCode !== 500) return;
    const detalle = detalles.get(error);
    const evento = { codigo: 'EXPORTACION_RAILWAY_ERROR',
        etapa: detalle?.etapa || (etapas.has(etapa) ? etapa : 'EXTRACCION'),
        causa: causaTecnica(error) || detalle?.causa || 'FALLO_NO_CLASIFICADO' };
    registrados.add(error);
    try { registrar(Object.freeze(evento)); } catch { /* Logging no altera entrega/cleanup. */ }
}
