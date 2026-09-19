import { authService } from '../../business/services/auth.service.js';
import { authValidator } from '../../business/validators/auth.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const authCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
};

export class authController {
    static async login(req, res, next) {
        try {
            const validationResult = authValidator.validateLogin(req.body);

            if (!validationResult.success) {
                throw new AppError(
                    'Datos de inicio de sesión inválidos',
                    400,
                    validationResult.error.issues
                );
            }

            const resultado = await authService.login(validationResult.data);

            res.cookie('token', resultado.token, {
                ...authCookieOptions,
                maxAge: 8 * 60 * 60 * 1000
            });

            return res.status(200).json({
                message: 'Inicio de sesión exitoso',
                data: resultado.usuario
            });
        } catch (error) {
            next(error);
        }
    }

    static async logout(req, res, next) {
        try {
            res.clearCookie('token', authCookieOptions);

            return res.status(200).json({
                message: 'Sesión cerrada correctamente'
            });
        } catch (error) {
            next(error);
        }
    }

    static async me(req, res, next) {
        try {
            const usuario = await authService.getSessionUsuario(
                req.usuario.idUsuario
            );

            return res.status(200).json({ data: usuario });
        } catch (error) {
            next(error);
        }
    }
}
