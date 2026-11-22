import entorno from '../../shared/utils/pagos-entorno.cjs';
import { AppError } from '../../shared/errors/app-error.js';

export const conexionLocal = direccion => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(direccion);
export const pagosLocalMiddleware = (req, res, next) => {
    if (!entorno.esSimulacion() || (entorno.esPruebaLocal() && !conexionLocal(req.socket.remoteAddress))) {
        return next(new AppError('Recurso no disponible', 404));
    }
    next();
};
