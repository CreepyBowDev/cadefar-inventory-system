import { generarToken } from '../../shared/utils/jwt.js';
import { usuarioRepository } from '../../data/repositories/usuario.repository.js';
import bcrypt from 'bcrypt';
import { AppError } from '../../shared/errors/app-error.js';

export class authService {
    static async login({ nombreUsuario, password }) {

        const usuario = await usuarioRepository.findByNombreUsuario({ nombreUsuario });

        if (!usuario) {
            throw new AppError('Usuario o constraseña incorrectos', 401);
        }

        if (!usuario.estado) {
            throw new AppError('Usuario inactivo', 403);
        }

        const passwordCorrecta =
            await bcrypt.compare(
                password,
                usuario.password_hash
            );

        if (!passwordCorrecta) {
            throw new AppError(
                'Usuario o contraseña incorrectos',
                401
            );
        }

        const token = generarToken({
            idUsuario: usuario.id_usuario,
            idRol: usuario.id_rol
        });

        return {
            // token,
            usuario: {
                idUsuario: usuario.id_usuario,
                idRol: usuario.id_rol,
                nombreUsuario: usuario.nombre_usuario
            }
        };

    }

    static async logout(req, res, next) {

        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });

        return res.status(200).json({
            message: 'Sesión cerrada correctamente'
        });
    }

}