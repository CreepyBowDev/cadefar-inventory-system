import db from '../models/index.js';

const { Usuario } = db;

export class usuarioRepository {
    static async findByNombreUsuario(nombreUsuario) {
        return Usuario.findOne({
            where: {
                nombre_usuario: nombreUsuario
            }
        });
    }

    static async createUsuario({ idRol, nombreUsuario, hashedPassword }) {
        return Usuario.create({
            id_rol: idRol,
            nombre_usuario: nombreUsuario,
            password_hash: hashedPassword
        });
    }
}