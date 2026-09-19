import { verificarToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authService } from '../../business/services/auth.service.js';

export const authMiddleware = async (req, res, next) => {

    try {

        const token = req.cookies?.token;

        if (!token) {
            throw new AppError(
                'No autenticado',
                401
            );
        }

        const payload = verificarToken(token);

        const usuario = await authService.getSessionUsuario(
            payload.idUsuario
        );

        req.usuario = {
            idUsuario: usuario.idUsuario,
            idRol: usuario.idRol
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
                new AppError(
                    'Token inválido o expirado',
                    401
                )
            );
        }

        next(error);

    }
};
