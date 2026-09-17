import { usuarioService } from '../../business/services/usuario.service.js';

export class usuarioController {
    static async createUsuario(req, res) {
        try {
            let { idRol, nombre, password } = req.body;

            let usuario = await usuarioService.createUsuario({ idRol, nombre, password });

            res.status(201).json({
                message: 'Usuario creado exitosamente',
                nombre: usuario.nombre_usuario,
                contraseña: usuario.password_hash
            });
        }
        catch (error) {
            console.error('Error al crear el usuario:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}