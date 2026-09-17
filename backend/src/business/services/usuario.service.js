import { usuarioRepository } from "../../data/repositories/usuario.repository.js";
import bcrypt from 'bcrypt';

export class usuarioService {
    static async createUsuario({ idRol, nombre, password }) {
        try {
            let hashedPassword = await bcrypt.hash(password, 10);
            let usuario = await usuarioRepository.createUsuario({ idRol, nombre, password: hashedPassword });
            return usuario;
        } catch (error) {
            console.error('Error en usuarioService.createUsuario:', error);
            throw new Error('Error al crear el usuario');
        }
    }
}