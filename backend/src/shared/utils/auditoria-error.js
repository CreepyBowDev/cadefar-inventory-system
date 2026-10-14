// Información privada: no se agrega a AppError.details ni se serializa al
// cliente. Permite distinguir causas y su dueño sin analizar mensajes/HTTP.
const contextos = new WeakMap();

export const anotarErrorAuditoria = (error, datos) => {
    if (error && (typeof error === 'object' || typeof error === 'function')) {
        contextos.set(error, Object.freeze({ ...contextos.get(error), ...datos }));
    }
    return error;
};

export const obtenerErrorAuditoria = error => contextos.get(error);
export const marcarErrorAuditoriaGestionado = error => anotarErrorAuditoria(error, { gestionado: true });

export const clasificarErrorTecnicoAuditoria = error => {
    const conexiones = ['SequelizeConnectionError', 'SequelizeConnectionRefusedError',
        'SequelizeConnectionAcquireTimeoutError', 'SequelizeHostNotFoundError',
        'SequelizeHostNotReachableError', 'SequelizeInvalidConnectionError',
        'SequelizeConnectionTimedOutError'];
    if (conexiones.includes(error?.name)) return 'ERROR_CONEXION';
    const persistencia = ['SequelizeDatabaseError', 'SequelizeUniqueConstraintError',
        'SequelizeForeignKeyConstraintError', 'SequelizeValidationError'];
    if (persistencia.includes(error?.name)) return 'ERROR_PERSISTENCIA';
    return 'ERROR_INTERNO';
};
