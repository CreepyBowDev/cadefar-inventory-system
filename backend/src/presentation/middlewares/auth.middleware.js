import { verificarToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authService } from '../../business/services/auth.service.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';

export const authMiddleware = async (req, res, next) => {

    try {

        const token = req.cookies?.token;

        if (!token) {
            throw anotarErrorAuditoria(new AppError(
                'No autenticado',
                401
            ), { tipoEvento: 'SESION_AUSENTE', causa: 'SESION_AUSENTE' });
        }

        const payload = verificarToken(token);

        const usuario = await authService.getSessionUsuario(
            payload.idUsuario,
            payload.versionCredenciales
        );

        req.usuario = {
            idUsuario: usuario.idUsuario,
            idRol: usuario.idRol,
            nombreUsuario: usuario.nombreUsuario,
            versionCredenciales: payload.versionCredenciales
        };

        next();

    } catch (error) {

        if (error instanceof AppError) {
            return next(error);
        }

        const jwtErrorNames = [
            'JsonWebTokenError',
            'TokenExpiredError',
            'NotBeforeError'
        ];

        if (jwtErrorNames.includes(error.name)) {
            return next(
                anotarErrorAuditoria(new AppError(
                    'Token inválido o expirado',
                    401
                ), { tipoEvento: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
                    causa: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO' })
            );
        }

        next(error);

    }
};
