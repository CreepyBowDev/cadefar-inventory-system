import { usuarioRepository } from "../../data/repositories/usuario.repository.js";
import { AppError } from "../../shared/errors/app-error.js";
import bcrypt from 'bcrypt';

export class usuarioService {
    static async createUsuario({ idRol, nombreUsuario, password }) {
        let usuarioExistente = await usuarioRepository.findByNombreUsuario(nombreUsuario);
        if (usuarioExistente) {
            throw new AppError('El nombre de usuario ya está en uso', 409);
        }
        let hashedPassword = await bcrypt.hash(password, 10);
        let usuario = await usuarioRepository.createUsuario({ idRol, nombreUsuario, hashedPassword });
        if (!usuario) {
            throw new AppError('Error al crear el usuario', 500);
        }
        return usuario;
    }
}