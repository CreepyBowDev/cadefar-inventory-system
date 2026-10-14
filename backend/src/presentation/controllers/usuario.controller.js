import { usuarioService } from '../../business/services/usuario.service.js';
import { usuarioValidator } from '../../business/validators/usuario.validator.js';
import { AppError } from '../../shared/errors/app-error.js';
import { AUTH_COOKIE_OPTIONS, AUTH_COOKIE_MAX_AGE } from '../../shared/constants/auth-cookie.js';
import { anotarErrorAuditoria } from '../../shared/utils/auditoria-error.js';
import { ejecutarConAuditoria } from '../../shared/utils/auditoria-http.js';

const contextoSeguridad = req => ({ contexto: req.contextoAuditoria,
    responsable: { idUsuario: req.usuario.idUsuario, idRol: req.usuario.idRol,
        nombreUsuario: req.usuario.nombreUsuario } });

const getValidatedData = (result) => {
    if (!result.success) {
        throw anotarErrorAuditoria(new AppError('Datos inválidos', 400, result.error.issues),
            { tipoEvento: 'VALIDACION_RECHAZADA', causa: 'ENTRADA_INVALIDA' });
    }

    return result.data;
};

const getIdUsuario = (params) => {
    const data = getValidatedData(
        usuarioValidator.validateIdUsuario(params)
    );

    return data.idUsuario;
};

export class usuarioController {
    static async createUsuario(req, res, next) {
        try {
            const data = getValidatedData(
                usuarioValidator.validateCreateUsuario(req.body)
            );
            const usuario = await ejecutarConAuditoria(req, auditoria => usuarioService.createUsuario(data, auditoria));

            return res.status(201).json({
                message: 'Usuario creado exitosamente',
                data: usuario
            });
        } catch (error) {
            next(error);
        }
    }

    static async getUsuarios(req, res, next) {
        try {
            const usuarios = await ejecutarConAuditoria(req, auditoria => usuarioService.getUsuarios(auditoria));

            return res.status(200).json({ data: usuarios });
        } catch (error) {
            next(error);
        }
    }

    static async getUsuarioById(req, res, next) {
        try {
            const idUsuario = getIdUsuario(req.params);
            const usuario = await ejecutarConAuditoria(req, auditoria => usuarioService.getUsuarioById(idUsuario, undefined, auditoria));

            return res.status(200).json({ data: usuario });
        } catch (error) {
            next(error);
        }
    }

    static async updateUsuario(req, res, next) {
        try {
            const idUsuario = getIdUsuario(req.params);
            const data = getValidatedData(
                usuarioValidator.validateUpdateUsuario(req.body)
            );
            const usuario = await ejecutarConAuditoria(req, auditoria => usuarioService.updateUsuario(idUsuario, data, auditoria));

            return res.status(200).json({
                message: 'Usuario modificado exitosamente',
                data: usuario
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateEstado(req, res, next) {
        try {
            const idUsuario = getIdUsuario(req.params);
            const data = getValidatedData(
                usuarioValidator.validateUpdateEstado(req.body)
            );
            const usuario = await ejecutarConAuditoria(req, auditoria => usuarioService.updateEstado(idUsuario, data, auditoria));

            return res.status(200).json({
                message: data.estado
                    ? 'Usuario activado exitosamente'
                    : 'Usuario desactivado exitosamente',
                data: usuario
            });
        } catch (error) {
            next(error);
        }
    }

    static async updatePassword(req, res, next) {
        try {
            const idUsuario = getIdUsuario(req.params);
            const data = getValidatedData(
                usuarioValidator.validateUpdatePassword(req.body)
            );

            const resultado = await usuarioService.updatePassword(idUsuario, data, contextoSeguridad(req));
            req.resultadoAuditoriaAuth = { efecto: 'CONFIRMADO', etapa: 'RESPUESTA',
                responsable: contextoSeguridad(req).responsable, cuentaObjetivo: resultado.cuentaObjetivo };

            return res.status(200).json({
                message: 'Contraseña modificada exitosamente'
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateOwnPassword(req, res, next) {
        try {
            const data = getValidatedData(
                usuarioValidator.validateUpdateOwnPassword(req.body)
            );

            const resultado = await usuarioService.updateOwnPassword(
                req.usuario.idUsuario,
                data,
                req.usuario.versionCredenciales,
                contextoSeguridad(req)
            );

            req.resultadoAuditoriaAuth = { efecto: 'CONFIRMADO', etapa: 'COOKIE',
                responsable: contextoSeguridad(req).responsable, cuentaObjetivo: resultado.cuentaObjetivo };
            res.cookie('token', resultado.token, {
                ...AUTH_COOKIE_OPTIONS,
                maxAge: AUTH_COOKIE_MAX_AGE
            });

            req.resultadoAuditoriaAuth.etapa = 'RESPUESTA';
            return res.status(200).json({
                message: 'Contraseña modificada exitosamente'
            });
        } catch (error) {
            next(error);
        }
    }
}
