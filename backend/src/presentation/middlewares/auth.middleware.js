import { verificarToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/errors/app-error.js';

export const authMiddleware = (req, res, next) => {

    try {

        const token = req.cookies.token;

        if (!token) {
            throw new AppError(
                'No autenticado',
                401
            );
        }

        const payload = verificarToken(token);

        req.usuario = {
            idUsuario: payload.idUsuario,
            idRol: payload.idRol
        };

        next();

    } catch (error) {

        if (error instanceof AppError) {
            return next(error);
        }

        next(
            new AppError(
                'Token inválido o expirado',
                401
            )
        );

    }
};