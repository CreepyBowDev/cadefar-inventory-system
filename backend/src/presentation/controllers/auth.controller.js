import { authService } from '../../business/services/auth.service.js';
import { authValidator } from '../../business/validators/auth.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { AUTH_COOKIE_OPTIONS, AUTH_COOKIE_MAX_AGE } from '../../shared/constants/auth-cookie.js';
import { recuperacionPasswordService } from '../../business/services/recuperacion-password.service.js';
import { recuperacionPasswordValidator } from '../../business/validators/recuperacion-password.validator.js';
import { exigirRecuperacionHabilitada } from '../../shared/utils/recuperacion-config.js';
import { bitacoraAuditoriaService } from '../../business/services/bitacora-auditoria.service.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';

export class authController {
    static async solicitarRecuperacion(req, res, next) {
        try {
            exigirRecuperacionHabilitada();
            const result = recuperacionPasswordValidator.validateSolicitud(req.body);
            if (!result.success) throw anotarErrorAuditoria(new AppError('Datos de recuperación inválidos', 400),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            return res.status(200).json(await recuperacionPasswordService.solicitarRecuperacion(
                result.data, req.socket.remoteAddress, {}, req.contextoAuditoria));
        } catch (error) { next(error); }
    }

    static async restablecerPassword(req, res, next) {
        try {
            exigirRecuperacionHabilitada();
            const result = recuperacionPasswordValidator.validateRestablecimiento(req.body);
            if (!result.success) throw anotarErrorAuditoria(new AppError('Datos de recuperación inválidos', 400),
                { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            const resultado = await recuperacionPasswordService.restablecerPassword(result.data, req.socket.remoteAddress, req.contextoAuditoria);
            req.resultadoAuditoriaAuth = { efecto: 'CONFIRMADO', etapa: 'RESPUESTA' };
            return res.status(200).json(resultado);
        } catch (error) { next(error); }
    }

    static async login(req, res, next) {
        try {
            const validationResult = authValidator.validateLogin(req.body);

            if (!validationResult.success) {
                throw anotarErrorAuditoria(new AppError(
                    'Datos de inicio de sesión inválidos',
                    400,
                    validationResult.error.issues
                ), { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
            }

            const resultado = await authService.login(validationResult.data, req.contextoAuditoria);

            req.resultadoAuditoriaAuth = { efecto: 'CONFIRMADO', responsable: resultado.usuario, etapa: 'COOKIE' };

            res.cookie('token', resultado.token, {
                ...AUTH_COOKIE_OPTIONS,
                maxAge: AUTH_COOKIE_MAX_AGE
            });

            req.resultadoAuditoriaAuth.etapa = 'RESPUESTA';
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
            const responsable = { idUsuario: req.usuario.idUsuario,
                nombreUsuario: req.usuario.nombreUsuario, idRol: req.usuario.idRol };
            req.resultadoAuditoriaAuth = { efecto: 'NO_APLICA', responsable, etapa: 'COOKIE' };
            res.clearCookie('token', AUTH_COOKIE_OPTIONS);
            req.resultadoAuditoriaAuth.efecto = 'CONFIRMADO';
            req.resultadoAuditoriaAuth.etapa = 'RESPUESTA';
            await bitacoraAuditoriaService.intentarRegistrar({
                contexto: req.contextoAuditoria, tipoEvento: 'LOGOUT', resultado: 'EXITO',
                responsable, registro: { tipo: 'USUARIO', id: responsable.idUsuario },
                metadatos: { efecto: 'CONFIRMADO' }
            });

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
