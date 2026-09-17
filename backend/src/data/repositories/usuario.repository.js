import db from '../models/index.js';

const { Usuario } = db;

export class usuarioRepository {
    static async createUsuario({ idRol, nombre, password }) {
        try {
            let usuario = await Usuario.create({
                id_rol: idRol,
                nombre_usuario: nombre,
                password_hash: password
            });
            return usuario;
        } catch (error) {
            throw new Error('Error al crear el usuario');
        }
    }
}