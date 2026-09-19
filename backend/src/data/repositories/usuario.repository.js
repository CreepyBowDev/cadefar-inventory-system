import db from '../models/index.js';

const { Usuario, Rol } = db;

const usuarioPublicAttributes = [
    'id_usuario',
    'id_rol',
    'nombre_usuario',
    'estado'
];

const rolInclude = {
    model: Rol,
    as: 'rol',
    attributes: ['id_rol', 'nombre', 'descripcion', 'estado']
};

export class usuarioRepository {
    static async findByNombreUsuario({ nombreUsuario }) {
        return Usuario.findOne({
            where: {
                nombre_usuario: nombreUsuario
            },
            include: [rolInclude]
        });
    }

    static async findAllUsuarios() {
        return Usuario.findAll({
            attributes: usuarioPublicAttributes,
            include: [rolInclude],
            order: [['id_usuario', 'ASC']]
        });
    }

    static async findById({ idUsuario }) {
        return Usuario.findByPk(idUsuario, {
            attributes: usuarioPublicAttributes,
            include: [rolInclude]
        });
    }

    static async findByIdWithPassword({ idUsuario }) {
        return Usuario.findByPk(idUsuario, {
            attributes: [
                'id_usuario',
                'password_hash'
            ]
        });
    }

    static async findRolById({ idRol }) {
        return Rol.findByPk(idRol);
    }

    static async createUsuario({ idRol, nombreUsuario, passwordHash }) {
        return Usuario.create({
            id_rol: idRol,
            nombre_usuario: nombreUsuario,
            password_hash: passwordHash
        });
    }

    static async updateUsuario({ idUsuario, idRol, nombreUsuario }) {
        const values = {};

        if (idRol !== undefined) {
            values.id_rol = idRol;
        }

        if (nombreUsuario !== undefined) {
            values.nombre_usuario = nombreUsuario;
        }

        return Usuario.update(values, {
            where: { id_usuario: idUsuario }
        });
    }

    static async updateEstado({ idUsuario, estado }) {
        return Usuario.update(
            { estado },
            { where: { id_usuario: idUsuario } }
        );
    }

    static async updatePassword({ idUsuario, passwordHash }) {
        return Usuario.update(
            { password_hash: passwordHash },
            { where: { id_usuario: idUsuario } }
        );
    }
}
