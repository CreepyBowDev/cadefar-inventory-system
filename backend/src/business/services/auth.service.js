import bcrypt from 'bcrypt';
import { generarToken } from '../../shared/utils/jwt.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

const toSessionUsuario = (usuario) => ({
    idUsuario: usuario.id_usuario,
    idRol: usuario.id_rol,
    nombreUsuario: usuario.nombre_usuario
});

export class authService {
    static async login({ nombreUsuario, password }) {
        const usuario = await usuarioRepository.findByNombreUsuario({ nombreUsuario });

        if (!usuario) {
            throw new AppError('Usuario o contraseña incorrectos', 401);
        }

        if (!usuario.estado) {
            throw new AppError('Usuario inactivo', 403);
        }

        const passwordCorrecta = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordCorrecta) {
            throw new AppError('Usuario o contraseña incorrectos', 401);
        }

        const token = generarToken({
            idUsuario: usuario.id_usuario,
            idRol: usuario.id_rol
        });

        return {
            token,
            usuario: toSessionUsuario(usuario)
        };
    }

    static async getSessionUsuario(idUsuario) {
        const usuario = await usuarioRepository.findById({ idUsuario });

        if (!usuario || !usuario.estado) {
            throw new AppError('Sesión no válida', 401);
        }

        return toSessionUsuario(usuario);
    }
}
