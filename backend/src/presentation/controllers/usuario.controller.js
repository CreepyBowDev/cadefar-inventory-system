import { usuarioService } from '../../business/services/usuario.service.js';
import { usuarioValidator } from '../../business/validators/usuario.validator.js';
import { AppError } from '../../shared/errors/app-error.js';

const getValidatedData = (result) => {
    if (!result.success) {
        throw new AppError('Datos inválidos', 400, result.error.issues);
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
            const usuario = await usuarioService.createUsuario(data);

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
            const usuarios = await usuarioService.getUsuarios();

            return res.status(200).json({ data: usuarios });
        } catch (error) {
            next(error);
        }
    }

    static async getUsuarioById(req, res, next) {
        try {
            const idUsuario = getIdUsuario(req.params);
            const usuario = await usuarioService.getUsuarioById(idUsuario);

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
            const usuario = await usuarioService.updateUsuario(idUsuario, data);

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
            const usuario = await usuarioService.updateEstado(idUsuario, data);

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

            await usuarioService.updatePassword(idUsuario, data);

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

            await usuarioService.updateOwnPassword(
                req.usuario.idUsuario,
                data
            );

            return res.status(200).json({
                message: 'Contraseña modificada exitosamente'
            });
        } catch (error) {
            next(error);
        }
    }
}
