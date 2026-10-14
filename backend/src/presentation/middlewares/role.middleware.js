import { AppError } from '../../shared/errors/app-error.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';

export const requireRole = (...rolesPermitidos) => {

    return (req, res, next) => {

        if (!req.usuario) {
            return next(
                anotarErrorAuditoria(new AppError(
                    'Usuario no autenticado',
                    401
                ), { tipoEvento: 'SESION_AUSENTE', causa: 'SESION_AUSENTE' })
            );
        }

        const { idRol } = req.usuario;

        if (!rolesPermitidos.includes(idRol)) {
            return next(
                anotarErrorAuditoria(new AppError(
                    'No tiene permisos para realizar esta acción',
                    403
                ), { tipoEvento: 'ACCESO_DENEGADO', causa: 'ROL_NO_PERMITIDO' })
            );
        }

        next();
    };
};
