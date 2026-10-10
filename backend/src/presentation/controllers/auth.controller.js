import { authService } from '../../business/services/auth.service.js';
import { authValidator } from '../../business/validators/auth.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { AUTH_COOKIE_OPTIONS, AUTH_COOKIE_MAX_AGE } from '../../shared/constants/auth-cookie.js';
import { recuperacionPasswordService } from '../../business/services/recuperacion-password.service.js';
import { recuperacionPasswordValidator } from '../../business/validators/recuperacion-password.validator.js';
import { exigirRecuperacionHabilitada } from '../../shared/utils/recuperacion-config.js';

export class authController {
    static async solicitarRecuperacion(req, res, next) {
        try {
            exigirRecuperacionHabilitada();
            const result = recuperacionPasswordValidator.validateSolicitud(req.body);
            if (!result.success) throw new AppError('Datos de recuperación inválidos', 400);
            return res.status(200).json(await recuperacionPasswordService.solicitarRecuperacion(result.data, req.socket.remoteAddress));
        } catch (error) { next(error); }
    }

    static async restablecerPassword(req, res, next) {
        try {
            exigirRecuperacionHabilitada();
            const result = recuperacionPasswordValidator.validateRestablecimiento(req.body);
            if (!result.success) throw new AppError('Datos de recuperación inválidos', 400);
            return res.status(200).json(await recuperacionPasswordService.restablecerPassword(result.data, req.socket.remoteAddress));
        } catch (error) { next(error); }
    }

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
                ...AUTH_COOKIE_OPTIONS,
                maxAge: AUTH_COOKIE_MAX_AGE
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
            res.clearCookie('token', AUTH_COOKIE_OPTIONS);

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
                req.usuario.idUsuario,
                req.usuario.versionCredenciales
            );

            return res.status(200).json({ data: usuario });
        } catch (error) {
            next(error);
        }
    }
}
