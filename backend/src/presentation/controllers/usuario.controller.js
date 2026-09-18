import { usuarioService } from '../../business/services/usuario.service.js';
import { usuarioValidator } from '../../business/validators/usuario.validator.js';

export class usuarioController {
    static async createUsuario(req, res, next) {
        try {
            const resultado = usuarioValidator.validateCreateUsuario(req.body);

            if (!resultado.success) {
                return res.status(400).json({
                    message: 'Datos inválidos',
                    errors: resultado.error.issues
                });
            }

            let usuario = await usuarioService.createUsuario(resultado.data);

            return res.status(201).json({
                message: 'Usuario creado exitosamente',
                nombre: usuario.nombre_usuario,
                contraseña: usuario.password_hash
            });
        }
        catch (error) {
            next(error);
        }
    }
}