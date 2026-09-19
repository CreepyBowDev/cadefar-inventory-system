import { AppError } from '../../shared/errors/app-error.js';

export const requireRole = (...rolesPermitidos) => {

    return (req, res, next) => {

        if (!req.usuario) {
            return next(
                new AppError(
                    'Usuario no autenticado',
                    401
                )
            );
        }

        const { idRol } = req.usuario;

        if (!rolesPermitidos.includes(idRol)) {
            return next(
                new AppError(
                    'No tiene permisos para realizar esta acción',
                    403
                )
            );
        }

        next();
    };
};